import { describe, expect, it, vi } from 'vitest';
import { IntegrationRetryWorker } from './integration-retry-worker.js';

function createLogger() {
  return {
    info: vi.fn(),
    error: vi.fn(),
  };
}

describe('integration retry worker', () => {
  it('does not run when disabled', async () => {
    const service = {
      retryPendingIngestionFailures: vi.fn(async () => ({
        processed: 0,
        resolved: 0,
        dead: 0,
        pending: 0,
      })),
    };
    const logger = createLogger();
    const worker = new IntegrationRetryWorker({
      enabled: false,
      tickSeconds: 60,
      batchSize: 10,
      maxAttempts: 5,
      service,
      logger: logger as any,
    });

    worker.start();
    await worker.runOnce();
    await worker.stop();

    expect(service.retryPendingIngestionFailures).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'integration.retry_worker.stopped' }),
      'stopped integration retry worker'
    );
  });

  it('processes retries on runOnce when enabled', async () => {
    const service = {
      retryPendingIngestionFailures: vi.fn(async () => ({
        processed: 2,
        resolved: 1,
        dead: 0,
        pending: 1,
      })),
    };
    const logger = createLogger();
    const worker = new IntegrationRetryWorker({
      enabled: true,
      tickSeconds: 60,
      batchSize: 25,
      maxAttempts: 4,
      service,
      logger: logger as any,
    });

    worker.start();
    await worker.runOnce();
    await worker.stop();

    expect(service.retryPendingIngestionFailures).toHaveBeenCalledWith(25, 4);
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'integration.retry_worker.tick',
        processed: 2,
        resolved: 1,
        dead: 0,
        pending: 1,
      }),
      'processed integration dead-letter retries'
    );
  });
});
