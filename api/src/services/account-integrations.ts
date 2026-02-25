import { and, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db as dbClient } from '../db/index.js';
import * as schema from '../db/schema/index.js';
import { PoolCoreService } from './pools/core.js';
import { getIntegrationAdapter } from './integration-adapters.js';

type JsonRecord = Record<string, unknown>;

type ConnectInput = {
  payload?: JsonRecord;
};

type CallbackInput = {
  payload?: JsonRecord;
};

type LinkPoolInput = {
  poolId: string;
};

type WebhookInput = {
  headers: Record<string, string | undefined>;
  payload?: JsonRecord;
};

type IngestionFailureStatus = 'pending' | 'resolved' | 'dead';

type IngestionFailureRecord = {
  failureId: number;
  provider: string;
  headers: Record<string, string | undefined> | null;
  payload: JsonRecord | null;
  status: IngestionFailureStatus;
  attempts: number;
  lastError: string | null;
};

function toError(code: string, message: string) {
  const error = new Error(message) as Error & { code?: string };
  error.code = code;
  return error;
}

const WEATHER_PROVIDER = 'weather_station';
const MIN_POLL_INTERVAL_MINUTES = 30;
const DEFAULT_POLL_INTERVAL_MINUTES = 45;
const MAX_POLL_INTERVAL_MINUTES = 60;
const POLL_INTERVAL_COOLDOWN_MS = 6 * 60 * 60 * 1000;

const weatherCredentialsSchema = z.object({
  apiKey: z.string().trim().min(1).max(512).optional(),
  pollIntervalMinutes: z
    .number()
    .int()
    .min(MIN_POLL_INTERVAL_MINUTES)
    .max(MAX_POLL_INTERVAL_MINUTES)
    .optional(),
});

const maskApiKey = (apiKey: string) => {
  const trimmed = apiKey.trim();
  if (trimmed.length <= 6) return '******';
  return `${trimmed.slice(0, 4)}****${trimmed.slice(-2)}`;
};

export class AccountIntegrationsService {
  constructor(
    private readonly db = dbClient,
    private readonly core: PoolCoreService = new PoolCoreService(db)
  ) {}

  private ensureProviderEnabled(provider: string) {
    if (provider === 'govee') {
      throw toError('ProviderRemoved', 'Provider govee has been removed');
    }
  }

  private nextRetryAt(attempts: number) {
    const baseSeconds = 30;
    const maxSeconds = 15 * 60;
    const seconds = Math.min(maxSeconds, baseSeconds * Math.pow(2, Math.max(0, attempts - 1)));
    return new Date(Date.now() + seconds * 1000);
  }

  private mergeWeatherStationCredentials(
    payload?: JsonRecord,
    existingCredentials?: JsonRecord | null,
  ) {
    const rawCredentials =
      payload && typeof payload.credentials === 'object' && payload.credentials
        ? (payload.credentials as JsonRecord)
        : {};
    const parsed = weatherCredentialsSchema.safeParse(rawCredentials);
    if (!parsed.success) {
      throw toError('ValidationError', parsed.error.errors[0]?.message ?? 'Invalid credentials');
    }

    const now = new Date();
    const existingApiKey =
      typeof existingCredentials?.apiKey === 'string' ? existingCredentials.apiKey.trim() : '';
    const existingPollInterval =
      typeof existingCredentials?.pollIntervalMinutes === 'number' &&
      Number.isInteger(existingCredentials.pollIntervalMinutes)
        ? existingCredentials.pollIntervalMinutes
        : null;
    const existingUpdatedAt =
      typeof existingCredentials?.pollIntervalUpdatedAt === 'string'
        ? new Date(existingCredentials.pollIntervalUpdatedAt)
        : null;

    const requestedPollInterval = parsed.data.pollIntervalMinutes;
    if (
      typeof requestedPollInterval === 'number' &&
      existingPollInterval !== null &&
      requestedPollInterval < existingPollInterval &&
      existingUpdatedAt instanceof Date &&
      !Number.isNaN(existingUpdatedAt.getTime()) &&
      now.getTime() - existingUpdatedAt.getTime() < POLL_INTERVAL_COOLDOWN_MS
    ) {
      throw toError(
        'ValidationError',
        'Poll interval can only be reduced once every 6 hours.',
      );
    }

    const pollIntervalMinutes =
      requestedPollInterval ?? existingPollInterval ?? DEFAULT_POLL_INTERVAL_MINUTES;
    const apiKey = (parsed.data.apiKey ?? existingApiKey) || undefined;

    return {
      ...payload,
      credentials: {
        ...(apiKey ? { apiKey } : {}),
        pollIntervalMinutes,
        pollIntervalUpdatedAt:
          typeof requestedPollInterval === 'number'
            ? now.toISOString()
            : typeof existingCredentials?.pollIntervalUpdatedAt === 'string'
              ? existingCredentials.pollIntervalUpdatedAt
              : now.toISOString(),
      },
    };
  }

  private normalizeProviderConnectPayload(
    provider: string,
    payload?: JsonRecord,
    existingCredentials?: JsonRecord | null,
  ) {
    if (provider === WEATHER_PROVIDER) {
      return this.mergeWeatherStationCredentials(payload, existingCredentials);
    }
    return payload;
  }

  private summarizeCredentials(provider: string, credentials: unknown) {
    if (provider !== WEATHER_PROVIDER || !credentials || typeof credentials !== 'object') {
      return { hasApiKey: false, apiKeyPreview: null, pollIntervalMinutes: null };
    }

    const row = credentials as JsonRecord;
    const apiKey = typeof row.apiKey === 'string' ? row.apiKey.trim() : '';
    const pollIntervalMinutes =
      typeof row.pollIntervalMinutes === 'number' && Number.isInteger(row.pollIntervalMinutes)
        ? row.pollIntervalMinutes
        : DEFAULT_POLL_INTERVAL_MINUTES;
    const pollIntervalUpdatedAt =
      typeof row.pollIntervalUpdatedAt === 'string' ? row.pollIntervalUpdatedAt : null;
    const pollIntervalDecreaseAllowedAt = pollIntervalUpdatedAt
      ? new Date(new Date(pollIntervalUpdatedAt).getTime() + POLL_INTERVAL_COOLDOWN_MS).toISOString()
      : null;

    return {
      hasApiKey: Boolean(apiKey),
      apiKeyPreview: apiKey ? maskApiKey(apiKey) : null,
      pollIntervalMinutes,
      pollIntervalUpdatedAt,
      pollIntervalDecreaseAllowedAt,
    };
  }

  private toPublicIntegration(
    row: {
      integrationId: string;
      userId: string;
      provider: string;
      status: string;
      scopes: unknown;
      externalAccountId: string | null;
      credentials: unknown;
      createdAt: Date;
      updatedAt: Date;
    },
  ) {
    return {
      integrationId: row.integrationId,
      userId: row.userId,
      provider: row.provider,
      status: row.status,
      scopes: row.scopes,
      externalAccountId: row.externalAccountId,
      ...this.summarizeCredentials(row.provider, row.credentials),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async listIntegrations(userId: string) {
    return this.db
      .select({
        integrationId: schema.integrations.integrationId,
        userId: schema.integrations.userId,
        provider: schema.integrations.provider,
        status: schema.integrations.status,
        scopes: schema.integrations.scopes,
        externalAccountId: schema.integrations.externalAccountId,
        credentials: schema.integrations.credentials,
        createdAt: schema.integrations.createdAt,
        updatedAt: schema.integrations.updatedAt,
      })
      .from(schema.integrations)
      .where(eq(schema.integrations.userId, userId))
      .orderBy(desc(schema.integrations.createdAt))
      .then((rows) => rows.map((row) => this.toPublicIntegration(row)));
  }

  async connect(userId: string, provider: string, input: ConnectInput = {}) {
    this.ensureProviderEnabled(provider);
    const adapter = getIntegrationAdapter(provider);
    const [existing] = await this.db
      .select({
        integrationId: schema.integrations.integrationId,
        credentials: schema.integrations.credentials,
      })
      .from(schema.integrations)
      .where(and(eq(schema.integrations.userId, userId), eq(schema.integrations.provider, provider)))
      .limit(1);

    const normalizedPayload = this.normalizeProviderConnectPayload(
      provider,
      input.payload,
      (existing?.credentials as JsonRecord | null | undefined) ?? null,
    );
    const connected = await adapter.connect({
      userId,
      provider,
      payload: normalizedPayload,
    });
    const now = new Date();

    const normalizedScopes = connected.scopes ?? null;
    const normalizedCredentials = connected.credentials ?? null;

    if (existing) {
      const [updated] = await this.db
        .update(schema.integrations)
        .set({
          status: 'connected',
          scopes: normalizedScopes,
          externalAccountId: connected.externalAccountId ?? null,
          credentials: normalizedCredentials,
          updatedAt: now,
        })
        .where(eq(schema.integrations.integrationId, existing.integrationId))
        .returning();
      return this.toPublicIntegration(updated);
    }

    const [created] = await this.db
      .insert(schema.integrations)
      .values({
        userId,
        provider,
        status: 'connected',
        scopes: normalizedScopes,
        externalAccountId: connected.externalAccountId ?? null,
        credentials: normalizedCredentials,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return this.toPublicIntegration(created);
  }

  async callback(userId: string, provider: string, input: CallbackInput = {}) {
    this.ensureProviderEnabled(provider);
    const adapter = getIntegrationAdapter(provider);
    const [existing] = await this.db
      .select({
        credentials: schema.integrations.credentials,
      })
      .from(schema.integrations)
      .where(and(eq(schema.integrations.userId, userId), eq(schema.integrations.provider, provider)))
      .limit(1);

    const normalizedPayload = this.normalizeProviderConnectPayload(
      provider,
      input.payload,
      (existing?.credentials as JsonRecord | null | undefined) ?? null,
    );
    const callbackResult = await adapter.callback({
      userId,
      provider,
      payload: normalizedPayload,
    });

    return this.connect(userId, provider, {
      payload: {
        ...normalizedPayload,
        externalAccountId: callbackResult.externalAccountId ?? input.payload?.externalAccountId,
        scopes: callbackResult.scopes ?? input.payload?.scopes,
        credentials: callbackResult.credentials ?? input.payload?.credentials,
      },
    });
  }

  async disconnect(userId: string, integrationId: string) {
    const [deleted] = await this.db
      .delete(schema.integrations)
      .where(
        and(eq(schema.integrations.integrationId, integrationId), eq(schema.integrations.userId, userId))
      )
      .returning({ integrationId: schema.integrations.integrationId });
    return Boolean(deleted);
  }

  async listDevices(userId: string, integrationId: string) {
    const [integration] = await this.db
      .select({ integrationId: schema.integrations.integrationId })
      .from(schema.integrations)
      .where(
        and(eq(schema.integrations.integrationId, integrationId), eq(schema.integrations.userId, userId))
      )
      .limit(1);

    if (!integration) {
      return null;
    }

    const devices = await this.db
      .select()
      .from(schema.integrationDevices)
      .where(eq(schema.integrationDevices.integrationId, integrationId))
      .orderBy(desc(schema.integrationDevices.createdAt));

    return devices;
  }

  async discoverDevices(userId: string, integrationId: string, payload?: JsonRecord) {
    const [integration] = await this.db
      .select({
        integrationId: schema.integrations.integrationId,
        provider: schema.integrations.provider,
        credentials: schema.integrations.credentials,
      })
      .from(schema.integrations)
      .where(
        and(eq(schema.integrations.integrationId, integrationId), eq(schema.integrations.userId, userId))
      )
      .limit(1);
    if (!integration) return null;
    this.ensureProviderEnabled(integration.provider);

    const adapter = getIntegrationAdapter(integration.provider);
    const discovered = await adapter.discoverDevices({
      userId,
      provider: integration.provider,
      payload,
      credentials: (integration.credentials as JsonRecord | null) ?? null,
    });

    if (discovered.length === 0) {
      return [];
    }

    for (const device of discovered) {
      const [existing] = await this.db
        .select({ deviceId: schema.integrationDevices.deviceId })
        .from(schema.integrationDevices)
        .where(
          and(
            eq(schema.integrationDevices.integrationId, integration.integrationId),
            eq(schema.integrationDevices.providerDeviceId, device.providerDeviceId)
          )
        )
        .limit(1);

      if (existing) {
        await this.db
          .update(schema.integrationDevices)
          .set({
            deviceType: device.deviceType,
            label: device.label ?? null,
            metadata: device.metadata ?? null,
            status: 'discovered',
            updatedAt: new Date(),
          })
          .where(eq(schema.integrationDevices.deviceId, existing.deviceId));
      } else {
        await this.db.insert(schema.integrationDevices).values({
          integrationId: integration.integrationId,
          providerDeviceId: device.providerDeviceId,
          deviceType: device.deviceType,
          label: device.label ?? null,
          metadata: device.metadata ?? null,
          status: 'discovered',
        });
      }
    }

    return this.listDevices(userId, integrationId);
  }

  async linkDeviceToPool(userId: string, integrationId: string, deviceId: string, input: LinkPoolInput) {
    await this.core.ensurePoolAccess(input.poolId, userId);

    const [integration] = await this.db
      .select({ integrationId: schema.integrations.integrationId })
      .from(schema.integrations)
      .where(
        and(eq(schema.integrations.integrationId, integrationId), eq(schema.integrations.userId, userId))
      )
      .limit(1);
    if (!integration) return null;

    const [updated] = await this.db
      .update(schema.integrationDevices)
      .set({
        poolId: input.poolId,
        status: 'linked',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.integrationDevices.integrationId, integrationId),
          eq(schema.integrationDevices.deviceId, deviceId)
        )
      )
      .returning();
    return updated ?? null;
  }

  async listPoolSensorReadings(poolId: string, userId: string, limit = 100) {
    await this.core.ensurePoolAccess(poolId, userId);
    return this.db
      .select()
      .from(schema.sensorReadings)
      .where(eq(schema.sensorReadings.poolId, poolId))
      .orderBy(desc(schema.sensorReadings.recordedAt))
      .limit(limit);
  }

  private async ingestNormalizedReadings(
    provider: string,
    readings: Array<{
      integrationId: string;
      deviceId: string;
      poolId: string;
      metric: string;
      value: number;
      unit?: string | null;
      recordedAt?: Date;
      quality?: number | null;
      rawPayload?: unknown;
    }>
  ) {
    if (readings.length === 0) {
      return 0;
    }

    const readingRows = readings
      .map((reading) => ({
        poolId: reading.poolId,
        integrationId: reading.integrationId,
        deviceId: reading.deviceId,
        metric: reading.metric,
        value: reading.value.toFixed(4),
        unit: reading.unit ?? null,
        recordedAt: reading.recordedAt ?? new Date(),
        source: provider,
        quality: reading.quality ?? null,
        rawPayload: reading.rawPayload ?? null,
      }));

    if (readingRows.length === 0) {
      return 0;
    }

    await this.db.insert(schema.sensorReadings).values(readingRows);
    return readingRows.length;
  }

  private async processWebhook(provider: string, input: WebhookInput) {
    this.ensureProviderEnabled(provider);
    const adapter = getIntegrationAdapter(provider);
    await adapter.verifyWebhook({
      provider,
      headers: input.headers,
      payload: input.payload,
    });
    const result = await adapter.webhook({
      provider,
      headers: input.headers,
      payload: input.payload,
    });

    if (!result.accepted) {
      return { accepted: false, ingested: 0 };
    }

    const providerIntegrations = await this.db
      .select({
        integrationId: schema.integrations.integrationId,
      })
      .from(schema.integrations)
      .where(eq(schema.integrations.provider, provider));

    if (providerIntegrations.length === 0 || (result.readings?.length ?? 0) === 0) {
      return { accepted: true, ingested: 0 };
    }

    const integrationIds = providerIntegrations.map((row) => row.integrationId);
    const knownDevices = await this.db
      .select({
        deviceId: schema.integrationDevices.deviceId,
        integrationId: schema.integrationDevices.integrationId,
        providerDeviceId: schema.integrationDevices.providerDeviceId,
        poolId: schema.integrationDevices.poolId,
      })
      .from(schema.integrationDevices)
      .where(inArray(schema.integrationDevices.integrationId, integrationIds));

    const normalizedReadings = result.readings
      ?.map((reading) => {
        const matchedDevice = knownDevices.find(
          (device) => device.providerDeviceId === reading.providerDeviceId
        );
        if (!matchedDevice?.poolId) return null;
        return {
          poolId: matchedDevice.poolId,
          integrationId: matchedDevice.integrationId,
          deviceId: matchedDevice.deviceId,
          metric: reading.metric,
          value: reading.value,
          unit: reading.unit,
          recordedAt: reading.recordedAt ?? new Date(),
          quality: reading.quality,
          rawPayload: reading.rawPayload,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    const ingested = await this.ingestNormalizedReadings(provider, normalizedReadings ?? []);

    return { accepted: true, ingested };
  }

  private async createIngestionFailure(
    provider: string,
    input: WebhookInput,
    error: unknown,
    attempts = 1
  ) {
    const message = error instanceof Error ? error.message : 'Unknown integration ingestion failure';
    const now = new Date();
    const [created] = await this.db
      .insert(schema.integrationIngestionFailures)
      .values({
        provider,
        headers: input.headers,
        payload: input.payload ?? null,
        status: 'pending',
        attempts,
        lastError: message.slice(0, 1000),
        nextAttemptAt: this.nextRetryAt(attempts),
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return created;
  }

  private async markFailureResolved(failureId: number, attempts: number) {
    await this.db
      .update(schema.integrationIngestionFailures)
      .set({
        status: 'resolved',
        attempts,
        lastError: null,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.integrationIngestionFailures.failureId, failureId));
  }

  private async markFailureRetryPending(
    failureId: number,
    attempts: number,
    error: unknown,
    nextAttemptAt: Date
  ) {
    const message = error instanceof Error ? error.message : 'Unknown integration ingestion failure';
    await this.db
      .update(schema.integrationIngestionFailures)
      .set({
        status: 'pending',
        attempts,
        lastError: message.slice(0, 1000),
        nextAttemptAt,
        updatedAt: new Date(),
      })
      .where(eq(schema.integrationIngestionFailures.failureId, failureId));
  }

  private async markFailureDead(failureId: number, attempts: number, error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown integration ingestion failure';
    await this.db
      .update(schema.integrationIngestionFailures)
      .set({
        status: 'dead',
        attempts,
        lastError: message.slice(0, 1000),
        updatedAt: new Date(),
      })
      .where(eq(schema.integrationIngestionFailures.failureId, failureId));
  }

  async ingestWebhook(provider: string, input: WebhookInput) {
    try {
      return await this.processWebhook(provider, input);
    } catch (error) {
      const failure = await this.createIngestionFailure(provider, input, error, 1);
      return {
        accepted: false,
        ingested: 0,
        queuedForRetry: true,
        failureId: failure.failureId,
      };
    }
  }

  async retryPendingIngestionFailures(limit = 50, maxAttempts = 5) {
    const pending = await this.db
      .select()
      .from(schema.integrationIngestionFailures)
      .where(eq(schema.integrationIngestionFailures.status, 'pending'))
      .orderBy(schema.integrationIngestionFailures.nextAttemptAt)
      .limit(limit);

    const now = Date.now();
    let processed = 0;
    let resolved = 0;
    let dead = 0;
    let stillPending = 0;

    for (const failure of pending) {
      const dueAt = failure.nextAttemptAt?.getTime() ?? 0;
      if (dueAt > now) continue;
      processed += 1;
      const nextAttempt = Number(failure.attempts ?? 0) + 1;

      try {
        await this.processWebhook(failure.provider, {
          headers: (failure.headers as Record<string, string | undefined> | null) ?? {},
          payload: (failure.payload as JsonRecord | null) ?? undefined,
        });
        await this.markFailureResolved(failure.failureId, nextAttempt);
        resolved += 1;
      } catch (error) {
        if (nextAttempt >= maxAttempts) {
          await this.markFailureDead(failure.failureId, nextAttempt, error);
          dead += 1;
        } else {
          await this.markFailureRetryPending(
            failure.failureId,
            nextAttempt,
            error,
            this.nextRetryAt(nextAttempt)
          );
          stillPending += 1;
        }
      }
    }

    return { processed, resolved, dead, pending: stillPending };
  }

  async listIngestionFailures(status?: IngestionFailureStatus, limit = 100): Promise<IngestionFailureRecord[]> {
    const rows = status
      ? await this.db
          .select()
          .from(schema.integrationIngestionFailures)
          .where(eq(schema.integrationIngestionFailures.status, status))
          .orderBy(desc(schema.integrationIngestionFailures.createdAt))
          .limit(limit)
      : await this.db
          .select()
          .from(schema.integrationIngestionFailures)
          .orderBy(desc(schema.integrationIngestionFailures.createdAt))
          .limit(limit);

    return rows.map((row) => ({
      failureId: row.failureId,
      provider: row.provider,
      headers: (row.headers as Record<string, string | undefined> | null) ?? null,
      payload: (row.payload as JsonRecord | null) ?? null,
      status: (row.status as IngestionFailureStatus) ?? 'pending',
      attempts: row.attempts ?? 0,
      lastError: row.lastError ?? null,
    }));
  }

}

export const accountIntegrationsService = new AccountIntegrationsService();
