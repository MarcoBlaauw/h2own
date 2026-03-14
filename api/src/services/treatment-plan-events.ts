import { eq } from 'drizzle-orm';
import { db as dbClient } from '../db/index.js';
import * as schema from '../db/schema/index.js';
import { internalEventBus } from './internal-events.js';
import { messagesService } from './messages.js';

const baseUrl = (process.env.APP_BASE_URL ?? 'http://localhost:5173').replace(/\/$/, '');

export class TreatmentPlanEventsService {
  constructor(private readonly db = dbClient) {}

  register() {
    internalEventBus.on('treatment_plan.generated', async (payload) => {
      await this.notifyPoolMembers(payload.poolId, {
        actorUserId: payload.generatedBy,
        title: 'Treatment plan generated',
        message: `A new treatment plan (v${payload.version}) is ready for review.`,
        data: {
          eventType: 'treatment_plan.generated',
          planId: payload.planId,
          poolId: payload.poolId,
          deepLink: this.planDeepLink(payload.poolId, payload.planId),
        },
      });
    });

    internalEventBus.on('treatment_plan.updated', async (payload) => {
      await this.notifyPoolMembers(payload.poolId, {
        actorUserId: payload.updatedBy,
        title: 'Treatment plan updated',
        message: `Treatment plan status changed to ${payload.status}.`,
        data: {
          eventType: 'treatment_plan.updated',
          planId: payload.planId,
          poolId: payload.poolId,
          status: payload.status,
          deepLink: this.planDeepLink(payload.poolId, payload.planId),
        },
      });
    });

    internalEventBus.on('treatment_plan.scheduled', async (payload) => {
      await this.notifyPoolMembers(payload.poolId, {
        actorUserId: payload.scheduledBy,
        title: 'Treatment plan scheduled',
        message: `Plan actions were scheduled (${payload.scheduleEventIds.length} event${payload.scheduleEventIds.length === 1 ? '' : 's'}).`,
        data: {
          eventType: 'treatment_plan.scheduled',
          planId: payload.planId,
          poolId: payload.poolId,
          scheduleEventIds: payload.scheduleEventIds,
          deepLink: this.planDeepLink(payload.poolId, payload.planId),
        },
      });
    });
  }

  private planDeepLink(poolId: string, planId: string) {
    return `${baseUrl}/pools/${poolId}?tab=treatment-plans&planId=${planId}`;
  }

  private async notifyPoolMembers(
    poolId: string,
    input: { actorUserId: string; title: string; message: string; data: Record<string, unknown> }
  ) {
    const rows = await this.db
      .select({
        userId: schema.poolMembers.userId,
        notificationPushEnabled: schema.userPreferences.notificationPushEnabled,
      })
      .from(schema.poolMembers)
      .leftJoin(schema.userPreferences, eq(schema.userPreferences.userId, schema.poolMembers.userId))
      .where(eq(schema.poolMembers.poolId, poolId));

    const recipients = rows.filter((row) => row.userId !== input.actorUserId);
    if (recipients.length === 0) return;

    await this.db.insert(schema.notifications).values(
      recipients.map((recipient) => ({
        userId: recipient.userId,
        poolId,
        channel: 'in_app',
        title: input.title,
        message: input.message,
        data: input.data,
        status: 'delivered',
        sentAt: new Date(),
        deliveredAt: new Date(),
      }))
    );

    const thread = await messagesService.getOrCreatePoolDefaultThread(poolId, input.actorUserId, true);
    if (!thread) return;

    const shouldPostMessage = recipients.some((recipient) => recipient.notificationPushEnabled);
    if (!shouldPostMessage) return;

    await messagesService.sendMessage(
      thread.threadId,
      input.actorUserId,
      `${input.title}\n\n${input.message}\n${String(input.data.deepLink ?? '')}`,
      {
        kind: 'treatment_plan_event',
        ...input.data,
      }
    );
  }
}

export const treatmentPlanEventsService = new TreatmentPlanEventsService();
