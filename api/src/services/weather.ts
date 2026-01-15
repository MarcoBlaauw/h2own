import { db as dbClient } from '../db/index.js';
import * as schema from '../db/schema/index.js';
import { and, eq, gte, lte, desc, inArray } from 'drizzle-orm';
import { env } from '../env.js';

export type WeatherGranularity = 'day';

export type WeatherRecord = {
  recordedAt: Date;
  airTempF?: number | null;
  uvIndex?: number | null;
  rainfallIn?: number | null;
  windSpeedMph?: number | null;
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
};

export interface WeatherProvider {
  fetchDailyWeather: (lat: number, lon: number, options: FetchDailyOptions) => Promise<WeatherRecord[]>;
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

type TomorrowTimeline = {
  time: string;
  values: Record<string, number | null | undefined>;
};

type TomorrowResponse = {
  timelines?: {
    daily?: TomorrowTimeline[];
  };
};

export class TomorrowIoProvider implements WeatherProvider {
  constructor(
    private readonly apiKey: string | undefined = env.TOMORROW_API_KEY,
    private readonly baseUrl: string = env.TOMORROW_API_BASE ?? 'https://api.tomorrow.io/v4'
  ) {}

  async fetchDailyWeather(lat: number, lon: number, options: FetchDailyOptions) {
    if (!this.apiKey) {
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
        'uvIndexAvg',
        'precipitationAccumulation',
        'precipitationIntensityAvg',
        'windSpeedAvg',
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
    params.set('apikey', this.apiKey);

    const response = await fetch(`${this.baseUrl}/weather/forecast?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Tomorrow.io request failed (${response.status})`);
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
        airTempF: typeof temperature === 'number' ? temperature : null,
        uvIndex: typeof values.uvIndexAvg === 'number' ? values.uvIndexAvg : null,
        rainfallIn: typeof precipitation === 'number' ? precipitation : null,
        windSpeedMph: typeof values.windSpeedAvg === 'number' ? values.windSpeedAvg : null,
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
    private readonly provider: WeatherProvider = new TomorrowIoProvider()
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
        airTempF: record.airTempF ?? undefined,
        uvIndex: record.uvIndex ?? undefined,
        rainfallIn: formatDecimal(record.rainfallIn),
        windSpeedMph: record.windSpeedMph ?? undefined,
        humidityPercent: record.humidityPercent ?? undefined,
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

    if (options.refresh) {
      const records = await this.provider.fetchDailyWeather(latitude, longitude, {
        from: options.from,
        to: options.to,
      });
      await this.storeWeather(options.locationId, records);
    }

    let weather = await this.listWeather(options.locationId, {
      from: options.from,
      to: options.to,
      granularity: options.granularity,
    });

    if (!options.refresh && weather.items.length === 0) {
      const records = await this.provider.fetchDailyWeather(latitude, longitude, {
        from: options.from,
        to: options.to,
      });
      await this.storeWeather(options.locationId, records);
      weather = await this.listWeather(options.locationId, {
        from: options.from,
        to: options.to,
        granularity: options.granularity,
      });
    }

    return weather;
  }
}

export const weatherService = new WeatherService();
