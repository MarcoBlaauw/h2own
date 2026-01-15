import { db as dbClient } from '../db/index.js';
import * as schema from '../db/schema/index.js';
import { eq, desc, and, isNotNull } from 'drizzle-orm';

const IDEAL_FC_MIN = 2.0;
const IDEAL_FC_MAX = 4.0;
const IDEAL_PH_MIN = 7.2;
const IDEAL_PH_MAX = 7.8;

type WeatherSignal = {
  uvIndex?: number | null;
  rainfallIn?: string | number | null;
  airTempF?: number | null;
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
            reason: appendWeatherNote(
              `Free chlorine is low at ${latestTest.freeChlorinePpm} ppm.`,
              weatherNote
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
            reason: appendWeatherNote(`pH is high at ${latestTest.phLevel}.`, weatherNote),
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
