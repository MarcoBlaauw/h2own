import { timingSafeEqual } from 'node:crypto';
import { env } from '../env.js';

export type AdapterConnectInput = {
  userId: string;
  provider: string;
  payload?: Record<string, unknown>;
};

export type AdapterCallbackInput = {
  userId: string;
  provider: string;
  payload?: Record<string, unknown>;
};

export type AdapterWebhookInput = {
  provider: string;
  headers: Record<string, string | undefined>;
  payload?: Record<string, unknown>;
};

export type AdapterPollInput = {
  provider: string;
  credentials?: Record<string, unknown> | null;
  device: {
    providerDeviceId: string;
    deviceType?: string | null;
    metadata?: Record<string, unknown> | null;
  };
};

export type NormalizedSensorReading = {
  providerDeviceId: string;
  metric: string;
  value: number;
  unit?: string | null;
  recordedAt?: Date;
  quality?: number | null;
  rawPayload?: unknown;
};

export type IntegrationAdapter = {
  provider: string;
  connect(input: AdapterConnectInput): Promise<{
    externalAccountId?: string | null;
    scopes?: string[] | null;
    credentials?: Record<string, unknown> | null;
  }>;
  callback(input: AdapterCallbackInput): Promise<{
    externalAccountId?: string | null;
    scopes?: string[] | null;
    credentials?: Record<string, unknown> | null;
  }>;
  discoverDevices(input: {
    userId: string;
    provider: string;
    payload?: Record<string, unknown>;
    credentials?: Record<string, unknown> | null;
  }): Promise<
    Array<{
      providerDeviceId: string;
      deviceType: string;
      label?: string | null;
      metadata?: Record<string, unknown> | null;
    }>
  >;
  webhook(input: AdapterWebhookInput): Promise<{
    accepted: boolean;
    readings?: NormalizedSensorReading[];
  }>;
  pollReadings(input: AdapterPollInput): Promise<NormalizedSensorReading[]>;
  verifyWebhook(input: AdapterWebhookInput): Promise<void>;
};

type DiscoveredDevice = {
  providerDeviceId: string;
  deviceType: string;
  label?: string | null;
  metadata?: Record<string, unknown> | null;
};

class DefaultAdapter implements IntegrationAdapter {
  constructor(public readonly provider: string) {}

  async connect(input: AdapterConnectInput) {
    return {
      externalAccountId:
        typeof input.payload?.externalAccountId === 'string'
          ? input.payload.externalAccountId
          : null,
      scopes: Array.isArray(input.payload?.scopes)
        ? input.payload?.scopes.filter((value): value is string => typeof value === 'string')
        : null,
      credentials:
        input.payload && typeof input.payload.credentials === 'object'
          ? (input.payload.credentials as Record<string, unknown>)
          : null,
    };
  }

  async callback(input: AdapterCallbackInput) {
    return this.connect(input);
  }

  async discoverDevices(input: {
    userId: string;
    provider: string;
    payload?: Record<string, unknown>;
    credentials?: Record<string, unknown> | null;
  }) {
    const rows = Array.isArray(input.payload?.devices) ? input.payload.devices : [];
    const devices: DiscoveredDevice[] = [];
    for (const row of rows) {
      const candidate = row as Record<string, unknown>;
      const providerDeviceId =
        typeof candidate.providerDeviceId === 'string' ? candidate.providerDeviceId : null;
      if (!providerDeviceId) continue;
      devices.push({
        providerDeviceId,
        deviceType: typeof candidate.deviceType === 'string' ? candidate.deviceType : 'sensor',
        label: typeof candidate.label === 'string' ? candidate.label : null,
        metadata: candidate,
      });
    }
    return devices;
  }

  async webhook(input: AdapterWebhookInput) {
    const readingsRaw = Array.isArray(input.payload?.readings) ? input.payload.readings : [];
    const readings: NormalizedSensorReading[] = [];
    for (const reading of readingsRaw) {
      const row = reading as Record<string, unknown>;
      const providerDeviceId =
        typeof row.providerDeviceId === 'string' ? row.providerDeviceId : null;
      const metric = typeof row.metric === 'string' ? row.metric : null;
      const value = typeof row.value === 'number' ? row.value : Number(row.value);
      if (!providerDeviceId || !metric || Number.isNaN(value)) {
        continue;
      }

      readings.push({
        providerDeviceId,
        metric,
        value,
        unit: typeof row.unit === 'string' ? row.unit : null,
        recordedAt: row.recordedAt ? new Date(String(row.recordedAt)) : undefined,
        quality:
          row.quality === null || row.quality === undefined
            ? null
            : Number.isNaN(Number(row.quality))
              ? null
              : Number(row.quality),
        rawPayload: row.rawPayload ?? row,
      });
    }

    return { accepted: true, readings };
  }

  async verifyWebhook(input: AdapterWebhookInput) {
    const signature = input.headers['x-integration-signature'] ?? '';
    if (!signature) {
      const error = new Error('Missing webhook signature') as Error & { code?: string };
      error.code = 'Unauthorized';
      throw error;
    }

    if (!env.INTEGRATION_WEBHOOK_SHARED_SECRET || env.NODE_ENV === 'test') {
      return;
    }

    const provided = Buffer.from(signature);
    const expected = Buffer.from(env.INTEGRATION_WEBHOOK_SHARED_SECRET);
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      const error = new Error('Invalid webhook signature') as Error & { code?: string };
      error.code = 'Unauthorized';
      throw error;
    }
  }

  async pollReadings(_input: AdapterPollInput) {
    return [] as NormalizedSensorReading[];
  }
}

class WeatherStationAdapter extends DefaultAdapter {
  constructor() {
    super('weather_station');
  }

  async webhook(input: AdapterWebhookInput) {
    const result = await super.webhook(input);
    const normalized = (result.readings ?? [])
      .map((reading) => {
        const metric = reading.metric.toLowerCase();
        if (metric === 'temperature' || metric === 'temp_f' || metric === 'air_temperature_f') {
          return { ...reading, metric: 'air_temp_f', unit: 'F' };
        }
        if (metric === 'humidity') {
          return { ...reading, metric: 'humidity_percent', unit: '%' };
        }
        if (metric === 'wind_speed' || metric === 'wind_mph') {
          return { ...reading, metric: 'wind_speed_mph', unit: 'mph' };
        }
        if (metric === 'uv') {
          return { ...reading, metric: 'uv_index', unit: null };
        }
        return reading;
      })
      .filter((reading) => !Number.isNaN(reading.value));

    return {
      accepted: true,
      readings: normalized,
    };
  }

  async verifyWebhook(input: AdapterWebhookInput) {
    const signature = input.headers['x-integration-signature'] ?? '';
    if (!signature) {
      const error = new Error('Missing webhook signature') as Error & { code?: string };
      error.code = 'Unauthorized';
      throw error;
    }

    if (env.NODE_ENV === 'test') {
      return;
    }

    if (!env.WEATHER_STATION_WEBHOOK_SECRET) {
      const error = new Error('Webhook secret is not configured for weather_station') as Error & {
        code?: string;
      };
      error.code = 'ValidationError';
      throw error;
    }

    const provided = Buffer.from(signature);
    const expected = Buffer.from(env.WEATHER_STATION_WEBHOOK_SECRET);
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      const error = new Error('Invalid webhook signature') as Error & { code?: string };
      error.code = 'Unauthorized';
      throw error;
    }
  }
}

const adapters = new Map<string, IntegrationAdapter>();

export function getIntegrationAdapter(provider: string): IntegrationAdapter {
  const existing = adapters.get(provider);
  if (existing) return existing;
  const created =
    provider === 'weather_station'
        ? new WeatherStationAdapter()
        : new DefaultAdapter(provider);
  adapters.set(provider, created);
  return created;
}
