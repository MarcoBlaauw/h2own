import type { SensorRetentionSummary } from './sensor-retention.js';

type RetentionService = {
  applyRetention: () => Promise<SensorRetentionSummary>;
};

type Logger = {
  info: (obj: Record<string, unknown>, message?: string) => void;
  warn: (obj: Record<string, unknown>, message?: string) => void;
  error: (obj: Record<string, unknown>, message?: string) => void;
};

type WorkerOptions = {
  enabled: boolean;
  tickSeconds: number;
  service: RetentionService;
  logger: Logger;
};

export class SensorRetentionWorker {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private started = false;

  constructor(private readonly options: WorkerOptions) {}

  start() {
    if (!this.options.enabled) {
      this.options.logger.info(
        { event: 'sensor_retention.worker.disabled' },
        'sensor retention worker disabled'
      );
      return;
    }
    if (this.started) return;
    this.started = true;
    this.options.logger.info(
      {
        event: 'sensor_retention.worker.started',
        tickSeconds: this.options.tickSeconds,
      },
      'sensor retention worker started'
    );
    this.scheduleNext(5_000);
  }

  async stop() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.started = false;
  }

  private scheduleNext(delayMs: number) {
    this.timer = setTimeout(() => {
      void this.runOnce();
    }, delayMs);
  }

  async runOnce() {
    if (!this.options.enabled || !this.started) return;
    if (this.running) {
      this.options.logger.warn(
        { event: 'sensor_retention.worker.overlap_skipped' },
        'skipping overlapping sensor retention tick'
      );
      this.scheduleNext(this.options.tickSeconds * 1_000);
      return;
    }

    this.running = true;
    try {
      const summary = await this.options.service.applyRetention();
      this.options.logger.info(
        {
          event: 'sensor_retention.worker.tick',
          warmedCount: summary.warmedCount,
          purgedCount: summary.purgedCount,
          warmCutoff: summary.warmCutoff.toISOString(),
          coldCutoff: summary.coldCutoff.toISOString(),
          policy: summary.policy,
        },
        'completed sensor retention tick'
      );
    } catch (error) {
      this.options.logger.error(
        { err: error, event: 'sensor_retention.worker.tick_failed' },
        'sensor retention tick failed'
      );
    } finally {
      this.running = false;
      if (this.started) {
        this.scheduleNext(this.options.tickSeconds * 1_000);
      }
    }
  }
}
