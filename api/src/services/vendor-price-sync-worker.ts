type SyncService = {
  runScheduledSyncBatch: (limit: number) => Promise<{
    processed: number;
    completed: number;
    unsupported: number;
  }>;
};

type Logger = {
  info: (obj: Record<string, unknown>, message?: string) => void;
  warn: (obj: Record<string, unknown>, message?: string) => void;
  error: (obj: Record<string, unknown>, message?: string) => void;
};

type WorkerOptions = {
  enabled: boolean;
  tickSeconds: number;
  batchSize: number;
  service: SyncService;
  logger: Logger;
};

export class VendorPriceSyncWorker {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly options: WorkerOptions) {}

  start() {
    if (!this.options.enabled || this.timer) return;
    const intervalMs = Math.max(1, this.options.tickSeconds) * 1000;
    this.timer = setInterval(() => {
      void this.runOnce();
    }, intervalMs);
    this.options.logger.info(
      {
        event: 'vendor_price_sync.worker.started',
        tickSeconds: this.options.tickSeconds,
        batchSize: this.options.batchSize,
      },
      'started vendor price sync worker'
    );
  }

  async stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async runOnce() {
    if (!this.options.enabled || this.running) return;
    this.running = true;
    try {
      const result = await this.options.service.runScheduledSyncBatch(this.options.batchSize);
      if (result.processed > 0) {
        this.options.logger.info(
          { event: 'vendor_price_sync.worker.tick', ...result },
          'processed vendor price sync batch'
        );
      }
    } catch (error) {
      this.options.logger.error(
        { err: error, event: 'vendor_price_sync.worker.failed' },
        'vendor price sync worker tick failed'
      );
    } finally {
      this.running = false;
    }
  }
}
