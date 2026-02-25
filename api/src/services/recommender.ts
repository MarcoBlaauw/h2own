import { db as dbClient } from '../db/index.js';
import * as schema from '../db/schema/index.js';
import { eq, desc, and, isNotNull, inArray } from 'drizzle-orm';

const IDEAL_FC_MIN = 2.0;
const IDEAL_FC_MAX = 4.0;
const IDEAL_PH_MIN = 7.2;
const IDEAL_PH_MAX = 7.8;

type WeatherSignal = {
  uvIndex?: number | null;
  rainfallIn?: string | number | null;
  airTempF?: number | null;
};

type ThermalEquipmentSnapshot = {
  equipmentType?: string | null;
  status?: string | null;
};

type TemperaturePreferenceSnapshot = {
  preferredTempF?: string | number | null;
  minTempF?: string | number | null;
  maxTempF?: string | number | null;
};

type StationSignal = {
  uvIndex?: number | null;
  airTempF?: number | null;
  humidityPercent?: number | null;
  windSpeedMph?: number | null;
};

const toNullableNumber = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return null;
  const numeric = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(numeric)) return null;
  return numeric;
};

export const buildWeatherAdjustmentNote = (weather?: WeatherSignal | null) => {
  if (!weather) return null;
  const notes: string[] = [];
  const uvIndex = weather.uvIndex ?? null;
  const rainfallIn = toNullableNumber(weather.rainfallIn);
  const airTempF = weather.airTempF ?? null;

  if (uvIndex !== null && uvIndex >= 7) {
    notes.push('High UV increases chlorine demand.');
  }
  if (rainfallIn !== null && rainfallIn >= 0.25) {
    notes.push('Recent rain may dilute sanitizer levels.');
  }
  if (airTempF !== null && airTempF >= 90) {
    notes.push('Heat can accelerate chemical consumption.');
  }
  if (airTempF !== null && airTempF <= 60) {
    notes.push('Cool temperatures can slow chemical activity.');
  }

  if (notes.length === 0) return null;
  return `Weather note: ${notes.join(' ')}`;
};

const appendWeatherNote = (reason: string, note: string | null) => {
  if (!note) return reason;
  return `${reason} ${note}`;
};

const supportsHeating = (equipmentType: string | null | undefined) =>
  equipmentType === 'heater' || equipmentType === 'combo';

const supportsCooling = (equipmentType: string | null | undefined) =>
  equipmentType === 'chiller' || equipmentType === 'combo';

const isThermalEquipmentActive = (snapshot?: ThermalEquipmentSnapshot | null) =>
  (snapshot?.status ?? 'disabled') === 'enabled';

export const buildTemperatureGuidanceNote = (
  waterTempF: number | null | undefined,
  equipment?: ThermalEquipmentSnapshot | null,
  prefs?: TemperaturePreferenceSnapshot | null
) => {
  if (waterTempF === null || waterTempF === undefined) return null;

  const preferredTempF = toNullableNumber(prefs?.preferredTempF);
  const minTempF = toNullableNumber(prefs?.minTempF);
  const maxTempF = toNullableNumber(prefs?.maxTempF);
  const lowerBound = minTempF ?? preferredTempF;
  const upperBound = maxTempF ?? preferredTempF;

  if (lowerBound === null && upperBound === null) return null;

  const active = isThermalEquipmentActive(equipment);
  const equipmentType = equipment?.equipmentType ?? 'none';

  if (lowerBound !== null && waterTempF < lowerBound) {
    if (active && supportsHeating(equipmentType)) {
      return `Temperature note: Water temperature is ${waterTempF}F, below target ${lowerBound}F. Heater support is configured.`;
    }
    return `Temperature note: Water temperature is ${waterTempF}F, below target ${lowerBound}F, and no active heater is configured.`;
  }

  if (upperBound !== null && waterTempF > upperBound) {
    if (active && supportsCooling(equipmentType)) {
      return `Temperature note: Water temperature is ${waterTempF}F, above target ${upperBound}F. Cooling support is configured.`;
    }
    return `Temperature note: Water temperature is ${waterTempF}F, above target ${upperBound}F, and no active chiller is configured.`;
  }

  return null;
};

export const buildStationAdjustmentNote = (station?: StationSignal | null) => {
  if (!station) return null;
  const notes: string[] = [];

  if (station.uvIndex !== null && station.uvIndex !== undefined && station.uvIndex >= 7) {
    notes.push('Station UV indicates elevated daytime chlorine demand.');
  }
  if (station.airTempF !== null && station.airTempF !== undefined && station.airTempF >= 90) {
    notes.push('Station air temperature is high, increasing oxidation demand.');
  }
  if (station.windSpeedMph !== null && station.windSpeedMph !== undefined && station.windSpeedMph >= 15) {
    notes.push('Wind can increase debris load and sanitizer consumption.');
  }
  if (
    station.humidityPercent !== null &&
    station.humidityPercent !== undefined &&
    station.humidityPercent >= 85
  ) {
    notes.push('High humidity can reduce evaporation-driven cooling.');
  }

  if (notes.length === 0) return null;
  return `Station note: ${notes.join(' ')}`;
};

export const chooseTemperatureForGuidance = (
  latestTestWaterTempF: number | null | undefined,
  latestTestedAt: Date | null | undefined,
  sensorWaterTempF: number | null | undefined,
  sensorRecordedAt: Date | null | undefined,
  staleHours = 24
) => {
  if (
    latestTestWaterTempF !== null &&
    latestTestWaterTempF !== undefined &&
    latestTestedAt instanceof Date &&
    !Number.isNaN(latestTestedAt.getTime())
  ) {
    const staleCutoffMs = staleHours * 60 * 60 * 1000;
    if (Date.now() - latestTestedAt.getTime() <= staleCutoffMs) {
      return latestTestWaterTempF;
    }
  }

  if (
    sensorWaterTempF !== null &&
    sensorWaterTempF !== undefined &&
    sensorRecordedAt instanceof Date &&
    !Number.isNaN(sensorRecordedAt.getTime())
  ) {
    return sensorWaterTempF;
  }

  return latestTestWaterTempF ?? null;
};

const appendRecommendationContextNotes = (
  reason: string,
  weatherNote: string | null,
  stationNote: string | null,
  temperatureGuidanceNote: string | null
) => {
  const withWeather = appendWeatherNote(reason, weatherNote);
  const withStation = appendWeatherNote(withWeather, stationNote);
  if (!temperatureGuidanceNote) return withStation;
  return `${withStation} ${temperatureGuidanceNote}`;
};

export class RecommenderService {
  constructor(private readonly db = dbClient) {}

  async getRecommendations(poolId: string) {
    const [pool] = await this.db
      .select()
      .from(schema.pools)
      .where(eq(schema.pools.poolId, poolId));
    if (!pool) {
      return null;
    }

    const [latestTest] = await this.db
      .select()
      .from(schema.testSessions)
      .where(eq(schema.testSessions.poolId, poolId))
      .orderBy(desc(schema.testSessions.testedAt))
      .limit(1);

    if (!latestTest) {
      return { primary: null, alternatives: [] };
    }

    const [equipment, tempPrefs] = await Promise.all([
      this.db
        .select({
          equipmentType: schema.poolEquipment.equipmentType,
          status: schema.poolEquipment.status,
        })
        .from(schema.poolEquipment)
        .where(eq(schema.poolEquipment.poolId, poolId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      this.db
        .select({
          preferredTempF: schema.poolTemperaturePrefs.preferredTempF,
          minTempF: schema.poolTemperaturePrefs.minTempF,
          maxTempF: schema.poolTemperaturePrefs.maxTempF,
        })
        .from(schema.poolTemperaturePrefs)
        .where(eq(schema.poolTemperaturePrefs.poolId, poolId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
    ]);
    const latestSensorRows = await this.db
      .select({
        metric: schema.sensorReadings.metric,
        value: schema.sensorReadings.value,
        recordedAt: schema.sensorReadings.recordedAt,
      })
      .from(schema.sensorReadings)
      .where(
        and(
          eq(schema.sensorReadings.poolId, poolId),
          inArray(schema.sensorReadings.metric, [
            'water_temp_f',
            'air_temp_f',
            'humidity_percent',
            'wind_speed_mph',
            'uv_index',
          ])
        )
      )
      .orderBy(desc(schema.sensorReadings.recordedAt))
      .limit(250);

    const latestByMetric = new Map<string, { value: number | null; recordedAt: Date | null }>();
    for (const row of latestSensorRows) {
      if (!latestByMetric.has(row.metric)) {
        latestByMetric.set(row.metric, {
          value: toNullableNumber(row.value),
          recordedAt: row.recordedAt ?? null,
        });
      }
    }

    const selectedWaterTempF = chooseTemperatureForGuidance(
      latestTest.waterTempF,
      latestTest.testedAt,
      latestByMetric.get('water_temp_f')?.value ?? null,
      latestByMetric.get('water_temp_f')?.recordedAt ?? null
    );
    const temperatureGuidanceNote = buildTemperatureGuidanceNote(
      selectedWaterTempF,
      equipment,
      tempPrefs
    );

    let weatherNote: string | null = null;
    if (pool.locationId) {
      const [latestWeather] = await this.db
        .select({
          uvIndex: schema.weatherData.uvIndex,
          rainfallIn: schema.weatherData.rainfallIn,
          airTempF: schema.weatherData.airTempF,
        })
        .from(schema.weatherData)
        .where(eq(schema.weatherData.locationId, pool.locationId))
        .orderBy(desc(schema.weatherData.recordedAt))
        .limit(1);

      weatherNote = buildWeatherAdjustmentNote(latestWeather ?? null);
    }
    const stationNote = buildStationAdjustmentNote({
      uvIndex: latestByMetric.get('uv_index')?.value ?? null,
      airTempF: latestByMetric.get('air_temp_f')?.value ?? null,
      humidityPercent: latestByMetric.get('humidity_percent')?.value ?? null,
      windSpeedMph: latestByMetric.get('wind_speed_mph')?.value ?? null,
    });

    const recommendations: {
      chemicalId: string;
      chemicalName: string;
      amount: number;
      unit: string | null;
      reason: string;
      predictedOutcome: string;
    }[] = [];

    // Chlorine recommendation
    if (latestTest.freeChlorinePpm && parseFloat(latestTest.freeChlorinePpm) < IDEAL_FC_MIN) {
      const targetFc = (IDEAL_FC_MIN + IDEAL_FC_MAX) / 2;
      const delta = targetFc - parseFloat(latestTest.freeChlorinePpm);

      const chlorineProducts = await this.db
        .select()
        .from(schema.products)
        .where(and(eq(schema.products.affectsFc, true), isNotNull(schema.products.fcChangePerDose)));

      for (const product of chlorineProducts) {
        const fcChangePerDose = parseFloat(product.fcChangePerDose!);
        if (fcChangePerDose > 0) {
          const numDoses = delta / fcChangePerDose;
          const amount = numDoses * parseFloat(product.dosePer10kGallons!) * (pool.volumeGallons / 10000);
          recommendations.push({
            chemicalId: product.productId,
            chemicalName: product.name,
            amount: parseFloat(amount.toFixed(2)),
            unit: product.doseUnit,
            reason: appendRecommendationContextNotes(
              `Free chlorine is low at ${latestTest.freeChlorinePpm} ppm.`,
              weatherNote,
              stationNote,
              temperatureGuidanceNote
            ),
            predictedOutcome: `Raise free chlorine to approximately ${targetFc} ppm.`,
          });
        }
      }
    }

    // pH recommendation
    if (latestTest.phLevel && parseFloat(latestTest.phLevel) > IDEAL_PH_MAX) {
      const targetPh = (IDEAL_PH_MIN + IDEAL_PH_MAX) / 2;
      const delta = parseFloat(latestTest.phLevel) - targetPh;

      const phDownProducts = await this.db
        .select()
        .from(schema.products)
        .where(and(eq(schema.products.affectsPh, true), isNotNull(schema.products.phChangePerDose)));

      for (const product of phDownProducts) {
        const phChangePerDose = parseFloat(product.phChangePerDose!);
        if (phChangePerDose < 0) {
          const numDoses = delta / Math.abs(phChangePerDose);
          const amount = numDoses * parseFloat(product.dosePer10kGallons!) * (pool.volumeGallons / 10000);
          recommendations.push({
            chemicalId: product.productId,
            chemicalName: product.name,
            amount: parseFloat(amount.toFixed(2)),
            unit: product.doseUnit,
            reason: appendRecommendationContextNotes(
              `pH is high at ${latestTest.phLevel}.`,
              weatherNote,
              stationNote,
              temperatureGuidanceNote
            ),
            predictedOutcome: `Lower pH to approximately ${targetPh}.`,
          });
        }
      }
    }

    const primary = recommendations.length > 0 ? recommendations[0] : null;
    const alternatives = recommendations.length > 1 ? recommendations.slice(1, 3) : [];

    return { primary, alternatives };
  }
}

export const recommenderService = new RecommenderService();
