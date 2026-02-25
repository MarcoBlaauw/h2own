import { and, gte, isNotNull, lt } from 'drizzle-orm';
import { db as dbClient } from '../db/index.js';
import * as schema from '../db/schema/index.js';
import { env } from '../env.js';

export type SensorRetentionPolicy = {
  hotDays: number;
  warmDays: number;
};

export type SensorRetentionSummary = {
  policy: SensorRetentionPolicy;
  warmedCount: number;
  purgedCount: number;
  warmCutoff: Date;
  coldCutoff: Date;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function normalizeSensorRetentionPolicy(policy: SensorRetentionPolicy): SensorRetentionPolicy {
  if (!Number.isInteger(policy.hotDays) || policy.hotDays <= 0) {
    throw new Error('SENSOR_RETENTION_HOT_DAYS must be a positive integer');
  }
  if (!Number.isInteger(policy.warmDays) || policy.warmDays <= 0) {
    throw new Error('SENSOR_RETENTION_WARM_DAYS must be a positive integer');
  }
  if (policy.warmDays <= policy.hotDays) {
    throw new Error('SENSOR_RETENTION_WARM_DAYS must be greater than SENSOR_RETENTION_HOT_DAYS');
  }
  return policy;
}

export function buildSensorRetentionCutoffs(now: Date, policy: SensorRetentionPolicy) {
  const normalized = normalizeSensorRetentionPolicy(policy);
  return {
    warmCutoff: new Date(now.getTime() - normalized.hotDays * MS_PER_DAY),
    coldCutoff: new Date(now.getTime() - normalized.warmDays * MS_PER_DAY),
  };
}

export class SensorRetentionService {
  constructor(private readonly db = dbClient) {}

  async applyRetention(
    now = new Date(),
    policy: SensorRetentionPolicy = {
      hotDays: env.SENSOR_RETENTION_HOT_DAYS,
      warmDays: env.SENSOR_RETENTION_WARM_DAYS,
    }
  ): Promise<SensorRetentionSummary> {
    const normalized = normalizeSensorRetentionPolicy(policy);
    const { warmCutoff, coldCutoff } = buildSensorRetentionCutoffs(now, normalized);

    const warmedRows = await this.db
      .update(schema.sensorReadings)
      .set({ rawPayload: null })
      .where(
        and(
          isNotNull(schema.sensorReadings.rawPayload),
          lt(schema.sensorReadings.recordedAt, warmCutoff),
          gte(schema.sensorReadings.recordedAt, coldCutoff)
        )
      )
      .returning({ readingId: schema.sensorReadings.readingId });

    const purgedRows = await this.db
      .delete(schema.sensorReadings)
      .where(lt(schema.sensorReadings.recordedAt, coldCutoff))
      .returning({ readingId: schema.sensorReadings.readingId });

    return {
      policy: normalized,
      warmedCount: warmedRows.length,
      purgedCount: purgedRows.length,
      warmCutoff,
      coldCutoff,
    };
  }
}

export const sensorRetentionService = new SensorRetentionService();
