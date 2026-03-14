import { EventEmitter } from 'node:events';

export type TreatmentPlanGeneratedEvent = {
  planId: string;
  poolId: string;
  generatedBy: string;
  version: number;
};

export type TreatmentPlanUpdatedEvent = {
  planId: string;
  poolId: string;
  updatedBy: string;
  status: string;
};

export type TreatmentPlanScheduledEvent = {
  planId: string;
  poolId: string;
  scheduledBy: string;
  scheduleEventIds: string[];
};

type InternalEventMap = {
  'treatment_plan.generated': TreatmentPlanGeneratedEvent;
  'treatment_plan.updated': TreatmentPlanUpdatedEvent;
  'treatment_plan.scheduled': TreatmentPlanScheduledEvent;
};

class InternalEventBus {
  private readonly emitter = new EventEmitter();

  on<TName extends keyof InternalEventMap>(name: TName, handler: (payload: InternalEventMap[TName]) => Promise<void> | void) {
    this.emitter.on(name, (payload) => {
      void handler(payload as InternalEventMap[TName]);
    });
  }

  emit<TName extends keyof InternalEventMap>(name: TName, payload: InternalEventMap[TName]) {
    this.emitter.emit(name, payload);
  }
}

export const internalEventBus = new InternalEventBus();
