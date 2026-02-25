import { describe, expect, it, vi } from 'vitest';
import { SensorRetentionWorker } from './sensor-retention-worker.js';

function createLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe('sensor retention worker', () => {
  it('does not start when disabled', () => {
    const service = {
      applyRetention: vi.fn(async () => ({
        policy: { hotDays: 30, warmDays: 365 },
        warmedCount: 0,
        purgedCount: 0,
        warmCutoff: new Date('2026-01-01T00:00:00.000Z'),
        coldCutoff: new Date('2025-01-01T00:00:00.000Z'),
      })),
    };
    const logger = createLogger();
    const worker = new SensorRetentionWorker({
      enabled: false,
      tickSeconds: 3600,
      service,
      logger,
    });

    worker.start();
    expect(service.applyRetention).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      { event: 'sensor_retention.worker.disabled' },
      'sensor retention worker disabled'
    );
  });

  it('runs retention on a tick when started', async () => {
    const service = {
      applyRetention: vi.fn(async () => ({
        policy: { hotDays: 30, warmDays: 365 },
        warmedCount: 3,
        purgedCount: 9,
        warmCutoff: new Date('2026-01-25T12:00:00.000Z'),
        coldCutoff: new Date('2025-02-24T12:00:00.000Z'),
      })),
    };
    const logger = createLogger();
    const worker = new SensorRetentionWorker({
      enabled: true,
      tickSeconds: 3600,
      service,
      logger,
    });

    worker.start();
    await worker.runOnce();
    await worker.stop();

    expect(service.applyRetention).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'sensor_retention.worker.tick',
        warmedCount: 3,
        purgedCount: 9,
      }),
      'completed sensor retention tick'
    );
  });
});
