import { describe, expect, it } from 'vitest';
import {
  buildSensorRetentionCutoffs,
  normalizeSensorRetentionPolicy,
} from './sensor-retention.js';

describe('sensor retention policy', () => {
  it('rejects invalid policy values', () => {
    expect(() => normalizeSensorRetentionPolicy({ hotDays: 0, warmDays: 10 })).toThrow(
      'SENSOR_RETENTION_HOT_DAYS must be a positive integer'
    );
    expect(() => normalizeSensorRetentionPolicy({ hotDays: 10, warmDays: 10 })).toThrow(
      'SENSOR_RETENTION_WARM_DAYS must be greater than SENSOR_RETENTION_HOT_DAYS'
    );
  });

  it('builds warm and cold cutoffs from now and policy', () => {
    const now = new Date('2026-02-24T12:00:00.000Z');
    const cutoffs = buildSensorRetentionCutoffs(now, { hotDays: 30, warmDays: 365 });
    expect(cutoffs.warmCutoff.toISOString()).toBe('2026-01-25T12:00:00.000Z');
    expect(cutoffs.coldCutoff.toISOString()).toBe('2025-02-24T12:00:00.000Z');
  });
});
