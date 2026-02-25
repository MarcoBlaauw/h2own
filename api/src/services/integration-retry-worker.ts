import type { FastifyBaseLogger } from 'fastify';
import { accountIntegrationsService, type AccountIntegrationsService } from './account-integrations.js';

type WorkerOptions = {
  enabled: boolean;
  tickSeconds: number;
  batchSize: number;
  maxAttempts: number;
  service?: Pick<AccountIntegrationsService, 'retryPendingIngestionFailures'>;
  logger?: FastifyBaseLogger;
};

export class IntegrationRetryWorker {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly options: WorkerOptions) {}

  private get service() {
    return this.options.service ?? accountIntegrationsService;
  }

  private get logger() {
    return this.options.logger;
  }

  start() {
    if (!this.options.enabled || this.timer) return;
    const intervalMs = Math.max(1, this.options.tickSeconds) * 1000;
    this.timer = setInterval(() => {
      void this.runOnce();
    }, intervalMs);
    this.logger?.info(
      {
        event: 'integration.retry_worker.started',
        tickSeconds: this.options.tickSeconds,
        batchSize: this.options.batchSize,
        maxAttempts: this.options.maxAttempts,
      },
      'started integration retry worker'
    );
  }

  async stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.logger?.info({ event: 'integration.retry_worker.stopped' }, 'stopped integration retry worker');
  }

  async runOnce() {
    if (!this.options.enabled || this.running) return;
    this.running = true;
    try {
      const result = await this.service.retryPendingIngestionFailures(
        this.options.batchSize,
        this.options.maxAttempts
      );
      if (result.processed > 0) {
        this.logger?.info(
          { event: 'integration.retry_worker.tick', ...result },
          'processed integration dead-letter retries'
        );
      }
    } catch (error) {
      this.logger?.error(
        { err: error, event: 'integration.retry_worker.failed' },
        'integration retry worker tick failed'
      );
    } finally {
      this.running = false;
    }
  }
}
