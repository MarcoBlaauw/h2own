import { db as dbClient } from '../db/index.js';
import * as schema from '../db/schema/index.js';
import { and, eq, gte, lte, desc, inArray } from 'drizzle-orm';
import { env } from '../env.js';
import { integrationService, type IntegrationRuntimeUpdate } from './integrations.js';

export type WeatherGranularity = 'day';

export type WeatherRecord = {
  recordedAt: Date;
  sunriseTime?: Date | null;
  sunsetTime?: Date | null;
  visibilityMi?: number | null;
  cloudCoverPercent?: number | null;
  cloudBaseKm?: number | null;
  cloudCeilingKm?: number | null;
  airTempF?: number | null;
  temperatureApparentF?: number | null;
  uvIndex?: number | null;
  uvHealthConcern?: number | null;
  ezHeatStressIndex?: number | null;
  rainfallIn?: number | null;
  windSpeedMph?: number | null;
  windDirectionDeg?: number | null;
  windGustMph?: number | null;
  humidityPercent?: number | null;
  pressureInhg?: number | null;
};

type LocationRow = {
  locationId: string;
  userId: string;
  latitude: string | number | null;
  longitude: string | number | null;
  isActive: boolean | null;
};

type FetchDailyOptions = {
  from?: Date;
  to?: Date;
  apiKey?: string;
  baseUrl?: string;
};

export interface WeatherProvider {
  fetchDailyWeather: (lat: number, lon: number, options: FetchDailyOptions) => Promise<WeatherRecord[]>;
}

export class WeatherProviderRequestError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'WeatherProviderRequestError';
  }
}

export class WeatherProviderRateLimitError extends WeatherProviderRequestError {
  constructor(
    message: string,
    public readonly retryAfterSeconds?: number
  ) {
    super(message, 429);
    this.name = 'WeatherProviderRateLimitError';
  }
}

const toNullableNumber = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return null;
  return numeric;
};

const formatDecimal = (value?: number | null, precision = 2) => {
  if (value === null || value === undefined) return undefined;
  if (Number.isNaN(value)) return undefined;
  return value.toFixed(precision);
};

const formatInteger = (value?: number | null) => {
  if (value === null || value === undefined) return undefined;
  if (Number.isNaN(value)) return undefined;
  return Math.round(value);
};

type TomorrowTimeline = {
  time: string;
  values: Record<string, string | number | null | undefined>;
};

type TomorrowResponse = {
  timelines?: {
    daily?: TomorrowTimeline[];
  };
};

const parseRetryAfterSeconds = (value: string | null) => {
  if (!value) return undefined;
  const asSeconds = Number(value);
  if (Number.isFinite(asSeconds) && asSeconds > 0) {
    return Math.round(asSeconds);
  }

  const retryAt = new Date(value);
  if (Number.isNaN(retryAt.getTime())) {
    return undefined;
  }

  const diffSeconds = Math.ceil((retryAt.getTime() - Date.now()) / 1000);
  return diffSeconds > 0 ? diffSeconds : undefined;
};

export class TomorrowIoProvider implements WeatherProvider {
  constructor(
    private readonly apiKey: string | undefined = env.TOMORROW_API_KEY,
    private readonly baseUrl: string = env.TOMORROW_API_BASE ?? 'https://api.tomorrow.io/v4'
  ) {}

  async fetchDailyWeather(lat: number, lon: number, options: FetchDailyOptions) {
    const apiKey = options.apiKey ?? this.apiKey;
    const baseUrl = options.baseUrl ?? this.baseUrl;

    if (!apiKey) {
      throw new Error('Weather provider not configured');
    }

    const params = new URLSearchParams();
    params.set('location', `${lat},${lon}`);
    params.set(
      'fields',
      [
        'temperatureAvg',
        'temperatureMin',
        'temperatureMax',
        'temperatureApparentAvg',
        'uvIndexAvg',
        'uvHealthConcernAvg',
        'ezHeatStressIndexAvg',
        'sunriseTime',
        'sunsetTime',
        'visibilityAvg',
        'cloudCoverAvg',
        'cloudBaseAvg',
        'cloudCeilingAvg',
        'precipitationAccumulation',
        'precipitationIntensityAvg',
        'windSpeedAvg',
        'windDirectionAvg',
        'windGustAvg',
        'humidityAvg',
        'pressureSurfaceLevelAvg',
      ].join(',')
    );
    params.set('timesteps', '1d');
    params.set('units', 'imperial');
    if (options.from) {
      params.set('startTime', options.from.toISOString());
    }
    if (options.to) {
      params.set('endTime', options.to.toISOString());
    }
    params.set('apikey', apiKey);

    const response = await fetch(`${baseUrl}/weather/forecast?${params.toString()}`);
    if (!response.ok) {
      if (response.status === 429) {
        throw new WeatherProviderRateLimitError(
          'Tomorrow.io request failed (429)',
          parseRetryAfterSeconds(response.headers.get('retry-after'))
        );
      }
      throw new WeatherProviderRequestError(
        `Tomorrow.io request failed (${response.status})`,
        response.status
      );
    }
    const payload = (await response.json()) as TomorrowResponse;
    const daily = payload.timelines?.daily ?? [];

    return daily.map((entry) => {
      const values = entry.values ?? {};
      const precipitation =
        values.precipitationAccumulation ??
        (values.precipitationIntensityAvg != null ? values.precipitationIntensityAvg * 24 : null);
      const temperature =
        values.temperatureAvg ?? values.temperatureMax ?? values.temperatureMin ?? null;

      return {
        recordedAt: new Date(entry.time),
        sunriseTime:
          typeof values.sunriseTime === 'string' && values.sunriseTime
            ? new Date(values.sunriseTime)
            : null,
        sunsetTime:
          typeof values.sunsetTime === 'string' && values.sunsetTime
            ? new Date(values.sunsetTime)
            : null,
        visibilityMi:
          typeof values.visibilityAvg === 'number'
            ? values.visibilityAvg
            : typeof values.visibility === 'number'
              ? values.visibility
              : null,
        cloudCoverPercent:
          typeof values.cloudCoverAvg === 'number'
            ? values.cloudCoverAvg
            : typeof values.cloudCover === 'number'
              ? values.cloudCover
              : null,
        cloudBaseKm:
          typeof values.cloudBaseAvg === 'number'
            ? values.cloudBaseAvg
            : typeof values.cloudBase === 'number'
              ? values.cloudBase
              : null,
        cloudCeilingKm:
          typeof values.cloudCeilingAvg === 'number'
            ? values.cloudCeilingAvg
            : typeof values.cloudCeiling === 'number'
              ? values.cloudCeiling
              : null,
        airTempF: typeof temperature === 'number' ? temperature : null,
        temperatureApparentF:
          typeof values.temperatureApparentAvg === 'number'
            ? values.temperatureApparentAvg
            : typeof values.temperatureApparent === 'number'
              ? values.temperatureApparent
              : null,
        uvIndex: typeof values.uvIndexAvg === 'number' ? values.uvIndexAvg : null,
        uvHealthConcern:
          typeof values.uvHealthConcernAvg === 'number'
            ? values.uvHealthConcernAvg
            : typeof values.uvHealthConcern === 'number'
              ? values.uvHealthConcern
              : null,
        ezHeatStressIndex:
          typeof values.ezHeatStressIndexAvg === 'number'
            ? values.ezHeatStressIndexAvg
            : typeof values.ezHeatStressIndex === 'number'
              ? values.ezHeatStressIndex
              : null,
        rainfallIn: typeof precipitation === 'number' ? precipitation : null,
        windSpeedMph: typeof values.windSpeedAvg === 'number' ? values.windSpeedAvg : null,
        windDirectionDeg:
          typeof values.windDirectionAvg === 'number'
            ? values.windDirectionAvg
            : typeof values.windDirection === 'number'
              ? values.windDirection
              : null,
        windGustMph:
          typeof values.windGustAvg === 'number'
            ? values.windGustAvg
            : typeof values.windGust === 'number'
              ? values.windGust
              : null,
        humidityPercent: typeof values.humidityAvg === 'number' ? values.humidityAvg : null,
        pressureInhg:
          typeof values.pressureSurfaceLevelAvg === 'number' ? values.pressureSurfaceLevelAvg : null,
      };
    });
  }
}

export class WeatherService {
  constructor(
    private readonly db = dbClient,
    private readonly provider: WeatherProvider = new TomorrowIoProvider(),
    private readonly cacheTtlMs: number = env.WEATHER_CACHE_TTL_MINUTES * 60 * 1000,
    private readonly rateLimitCooldownMs: number = env.WEATHER_RATE_LIMIT_COOLDOWN_SECONDS * 1000,
    private readonly integrations: Pick<
      typeof integrationService,
      'getIntegration' | 'updateRuntimeStatus'
    > = integrationService
  ) {}

  private async getLocation(locationId: string) {
    const [location] = await this.db
      .select({
        locationId: schema.userLocations.locationId,
        userId: schema.userLocations.userId,
        latitude: schema.userLocations.latitude,
        longitude: schema.userLocations.longitude,
        isActive: schema.userLocations.isActive,
      })
      .from(schema.userLocations)
      .where(eq(schema.userLocations.locationId, locationId));

    return (location as LocationRow | undefined) ?? null;
  }

  private async ensureLocationAccess(locationId: string, userId: string, role?: string) {
    const location = await this.getLocation(locationId);
    if (!location) {
      throw new Error('Location not found');
    }
    if (role === 'admin') {
      return location;
    }
    if (location.userId !== userId) {
      throw new Error('Forbidden');
    }
    if (location.isActive === false) {
      throw new Error('Location inactive');
    }
    return location;
  }

  private async listWeather(
    locationId: string,
    options: { from?: Date; to?: Date; granularity: WeatherGranularity }
  ) {
    let whereClause = eq(schema.weatherData.locationId, locationId);

    if (options.from) {
      whereClause = and(whereClause, gte(schema.weatherData.recordedAt, options.from));
    }
    if (options.to) {
      whereClause = and(whereClause, lte(schema.weatherData.recordedAt, options.to));
    }

    const items = await this.db
      .select()
      .from(schema.weatherData)
      .where(whereClause)
      .orderBy(desc(schema.weatherData.recordedAt));

    return { items };
  }

  private async getLatestWeatherFetchAt(locationId: string) {
    const [latest] = await this.db
      .select({
        createdAt: schema.weatherData.createdAt,
      })
      .from(schema.weatherData)
      .where(eq(schema.weatherData.locationId, locationId))
      .orderBy(desc(schema.weatherData.createdAt))
      .limit(1);

    return latest?.createdAt ?? null;
  }

  private isLocationWeatherCacheFresh(lastFetchAt: Date | null, cacheTtlMs: number) {
    if (!lastFetchAt) return false;
    return Date.now() - lastFetchAt.getTime() < cacheTtlMs;
  }

  private throwIfRateLimited(nextAllowedRequestAt: Date | null) {
    if (!nextAllowedRequestAt) return;
    const retryAfterSeconds = Math.ceil((nextAllowedRequestAt.getTime() - Date.now()) / 1000);
    if (retryAfterSeconds <= 0) return;

    throw new WeatherProviderRateLimitError(
      'Tomorrow.io request failed (429)',
      retryAfterSeconds
    );
  }

  private async getTomorrowIoRuntimeConfig() {
    try {
      const integration = await this.integrations.getIntegration('tomorrow_io');
      const credentials = integration.credentials ?? {};
      const config = integration.config ?? {};

      return {
        enabled: integration.enabled,
        apiKey:
          typeof credentials.apiKey === 'string' && credentials.apiKey.trim().length > 0
            ? credentials.apiKey.trim()
            : undefined,
        baseUrl:
          typeof config.baseUrl === 'string' && config.baseUrl.trim().length > 0
            ? config.baseUrl.trim().replace(/\/$/, '')
            : undefined,
        cacheTtlMs: (integration.cacheTtlSeconds ?? Math.round(this.cacheTtlMs / 1000)) * 1000,
        rateLimitCooldownMs:
          (integration.rateLimitCooldownSeconds ?? Math.round(this.rateLimitCooldownMs / 1000)) *
          1000,
        nextAllowedRequestAt: integration.nextAllowedRequestAt ?? null,
      };
    } catch {
      return {
        enabled: true,
        apiKey: undefined,
        baseUrl: undefined,
        cacheTtlMs: this.cacheTtlMs,
        rateLimitCooldownMs: this.rateLimitCooldownMs,
        nextAllowedRequestAt: null,
      };
    }
  }

  private async safeUpdateRuntimeStatus(status: IntegrationRuntimeUpdate) {
    try {
      await this.integrations.updateRuntimeStatus('tomorrow_io', status);
    } catch {
      // Avoid blocking user requests if integration status persistence fails.
    }
  }

  private async fetchAndStoreWeather(
    locationId: string,
    latitude: number,
    longitude: number,
    options: {
      from?: Date;
      to?: Date;
      apiKey?: string;
      baseUrl?: string;
      rateLimitCooldownMs: number;
      nextAllowedRequestAt: Date | null;
    }
  ) {
    this.throwIfRateLimited(options.nextAllowedRequestAt);

    try {
      const records = await this.provider.fetchDailyWeather(latitude, longitude, {
        from: options.from,
        to: options.to,
        apiKey: options.apiKey,
        baseUrl: options.baseUrl,
      });
      await this.storeWeather(locationId, records);
      await this.safeUpdateRuntimeStatus({
        lastResponseCode: 200,
        lastResponseText: 'ok',
        lastResponseAt: new Date(),
        lastSuccessAt: new Date(),
        nextAllowedRequestAt: null,
      });
    } catch (error) {
      if (error instanceof WeatherProviderRateLimitError) {
        const retryAfterMs = (error.retryAfterSeconds ?? 0) * 1000;
        const cooldownMs = Math.max(options.rateLimitCooldownMs, retryAfterMs);
        const nextAllowedRequestAt = new Date(Date.now() + cooldownMs);
        await this.safeUpdateRuntimeStatus({
          lastResponseCode: 429,
          lastResponseText: error.message,
          lastResponseAt: new Date(),
          nextAllowedRequestAt,
        });
      } else if (error instanceof WeatherProviderRequestError) {
        await this.safeUpdateRuntimeStatus({
          lastResponseCode: error.statusCode,
          lastResponseText: error.message,
          lastResponseAt: new Date(),
        });
      } else if (error instanceof Error) {
        await this.safeUpdateRuntimeStatus({
          lastResponseCode: 500,
          lastResponseText: error.message,
          lastResponseAt: new Date(),
        });
      }
      throw error;
    }
  }

  private async storeWeather(locationId: string, records: WeatherRecord[]) {
    if (records.length === 0) {
      return;
    }

    const recordedAtValues = records.map((record) => record.recordedAt);
    const existing = await this.db
      .select({
        recordedAt: schema.weatherData.recordedAt,
      })
      .from(schema.weatherData)
      .where(
        and(
          eq(schema.weatherData.locationId, locationId),
          inArray(schema.weatherData.recordedAt, recordedAtValues)
        )
      );

    const existingTimes = new Set(existing.map((row) => row.recordedAt.toISOString()));
    const inserts = records.filter(
      (record) => !existingTimes.has(record.recordedAt.toISOString())
    );

    if (inserts.length === 0) {
      return;
    }

    await this.db.insert(schema.weatherData).values(
      inserts.map((record) => ({
        locationId,
        recordedAt: record.recordedAt,
        sunriseTime: record.sunriseTime ?? undefined,
        sunsetTime: record.sunsetTime ?? undefined,
        visibilityMi: formatDecimal(record.visibilityMi),
        cloudCoverPercent: formatDecimal(record.cloudCoverPercent),
        cloudBaseKm: formatDecimal(record.cloudBaseKm),
        cloudCeilingKm: formatDecimal(record.cloudCeilingKm),
        airTempF: formatInteger(record.airTempF),
        temperatureApparentF: formatInteger(record.temperatureApparentF),
        uvIndex: formatInteger(record.uvIndex),
        uvHealthConcern: formatInteger(record.uvHealthConcern),
        ezHeatStressIndex: formatInteger(record.ezHeatStressIndex),
        rainfallIn: formatDecimal(record.rainfallIn),
        windSpeedMph: formatInteger(record.windSpeedMph),
        windDirectionDeg: formatInteger(record.windDirectionDeg),
        windGustMph: formatInteger(record.windGustMph),
        humidityPercent: formatInteger(record.humidityPercent),
        pressureInhg: formatDecimal(record.pressureInhg),
      }))
    );
  }

  async getWeatherForLocation(options: {
    locationId: string;
    userId: string;
    role?: string;
    from?: Date;
    to?: Date;
    granularity: WeatherGranularity;
    refresh?: boolean;
  }) {
    const location = await this.ensureLocationAccess(options.locationId, options.userId, options.role);
    const latitude = toNullableNumber(location.latitude);
    const longitude = toNullableNumber(location.longitude);

    if (latitude === null || longitude === null) {
      throw new Error('Location is missing coordinates');
    }

    let weather = await this.listWeather(options.locationId, {
      from: options.from,
      to: options.to,
      granularity: options.granularity,
    });

    const runtimeConfig = await this.getTomorrowIoRuntimeConfig();
    if (!runtimeConfig.enabled) {
      return weather;
    }

    const latestFetchAt = await this.getLatestWeatherFetchAt(options.locationId);
    const cacheIsFresh = this.isLocationWeatherCacheFresh(latestFetchAt, runtimeConfig.cacheTtlMs);
    const shouldFetch = !cacheIsFresh;

    if (shouldFetch) {
      try {
        await this.fetchAndStoreWeather(options.locationId, latitude, longitude, {
          from: options.from,
          to: options.to,
          apiKey: runtimeConfig.apiKey,
          baseUrl: runtimeConfig.baseUrl,
          rateLimitCooldownMs: runtimeConfig.rateLimitCooldownMs,
          nextAllowedRequestAt: runtimeConfig.nextAllowedRequestAt,
        });
        weather = await this.listWeather(options.locationId, {
          from: options.from,
          to: options.to,
          granularity: options.granularity,
        });
      } catch (error) {
        if (error instanceof WeatherProviderRateLimitError && weather.items.length > 0) {
          return weather;
        }
        throw error;
      }
    }

    return weather;
  }
}

export const weatherService = new WeatherService();
