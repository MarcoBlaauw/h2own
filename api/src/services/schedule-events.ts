import { and, asc, eq, gte, lte, sql } from 'drizzle-orm';
import { db as dbClient } from '../db/index.js';
import * as schema from '../db/schema/index.js';
import { mailerService } from './mailer.js';
import { auditWriterService } from './audit-writer.js';

export type ScheduleEventType = 'dosage' | 'test' | 'maintenance';
export type ScheduleRecurrence = 'once' | 'daily' | 'weekly' | 'monthly';
export type ScheduleStatus = 'scheduled' | 'completed' | 'canceled';

export type ScheduleEventRecord = {
  eventId: string;
  userId: string;
  poolId: string;
  poolName: string;
  eventType: ScheduleEventType;
  title: string;
  notes: string | null;
  dueAt: string;
  timezone: string;
  recurrence: ScheduleRecurrence;
  recurrenceInterval: number;
  reminderLeadMinutes: number;
  status: ScheduleStatus;
  completedAt: string | null;
  canceledAt: string | null;
  lastReminderAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ScheduleEventInput = {
  poolId: string;
  eventType: ScheduleEventType;
  title: string;
  notes?: string | null;
  dueAt: string;
  timezone?: string | null;
  recurrence?: ScheduleRecurrence;
  recurrenceInterval?: number;
  reminderLeadMinutes?: number | null;
};

export type ScheduleEventUpdate = Partial<ScheduleEventInput> & {
  status?: ScheduleStatus;
};

type ReminderPreferences = {
  notificationEmailEnabled: boolean;
  notificationEmailAddress: string | null;
  notificationPushEnabled: boolean;
  reminderTimezone: string | null;
  reminderLeadMinutes: number;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
};

const DEFAULT_REMINDER_LEAD_MINUTES = 24 * 60;

export const addRecurrence = (
  dueAt: Date,
  recurrence: ScheduleRecurrence,
  recurrenceInterval: number
) => {
  const next = new Date(dueAt);
  if (recurrence === 'daily') {
    next.setUTCDate(next.getUTCDate() + recurrenceInterval);
  } else if (recurrence === 'weekly') {
    next.setUTCDate(next.getUTCDate() + recurrenceInterval * 7);
  } else if (recurrence === 'monthly') {
    next.setUTCMonth(next.getUTCMonth() + recurrenceInterval);
  }
  return next;
};

const serializeEvent = (row: {
  eventId: string;
  userId: string;
  poolId: string;
  poolName: string;
  eventType: string;
  title: string;
  notes: string | null;
  dueAt: Date;
  timezone: string;
  recurrence: string;
  recurrenceInterval: number;
  reminderLeadMinutes: number;
  status: string;
  completedAt: Date | null;
  canceledAt: Date | null;
  lastReminderAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): ScheduleEventRecord => ({
  eventId: row.eventId,
  userId: row.userId,
  poolId: row.poolId,
  poolName: row.poolName,
  eventType: row.eventType as ScheduleEventType,
  title: row.title,
  notes: row.notes,
  dueAt: row.dueAt.toISOString(),
  timezone: row.timezone,
  recurrence: row.recurrence as ScheduleRecurrence,
  recurrenceInterval: row.recurrenceInterval,
  reminderLeadMinutes: row.reminderLeadMinutes,
  status: row.status as ScheduleStatus,
  completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  canceledAt: row.canceledAt ? row.canceledAt.toISOString() : null,
  lastReminderAt: row.lastReminderAt ? row.lastReminderAt.toISOString() : null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export class ScheduleEventAccessError extends Error {
  readonly statusCode = 403;
  readonly code = 'ScheduleEventForbidden';

  constructor(message = 'You do not have access to that pool or schedule event.') {
    super(message);
    this.name = 'ScheduleEventAccessError';
  }
}

export class ScheduleEventNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = 'ScheduleEventNotFound';

  constructor(message = 'Schedule event not found.') {
    super(message);
    this.name = 'ScheduleEventNotFoundError';
  }
}

export class ScheduleEventsService {
  constructor(private readonly db = dbClient) {}

  private async requirePoolAccess(userId: string, poolId: string) {
    const [pool] = await this.db
      .select({ poolId: schema.poolMembers.poolId })
      .from(schema.poolMembers)
      .where(and(eq(schema.poolMembers.userId, userId), eq(schema.poolMembers.poolId, poolId)))
      .limit(1);

    if (!pool) {
      throw new ScheduleEventAccessError();
    }
  }

  private async getOwnedEvent(userId: string, eventId: string) {
    const [event] = await this.db
      .select({
        eventId: schema.scheduleEvents.eventId,
        userId: schema.scheduleEvents.userId,
        poolId: schema.scheduleEvents.poolId,
        poolName: schema.pools.name,
        eventType: schema.scheduleEvents.eventType,
        title: schema.scheduleEvents.title,
        notes: schema.scheduleEvents.notes,
        dueAt: schema.scheduleEvents.dueAt,
        timezone: schema.scheduleEvents.timezone,
        recurrence: schema.scheduleEvents.recurrence,
        recurrenceInterval: schema.scheduleEvents.recurrenceInterval,
        reminderLeadMinutes: schema.scheduleEvents.reminderLeadMinutes,
        status: schema.scheduleEvents.status,
        completedAt: schema.scheduleEvents.completedAt,
        canceledAt: schema.scheduleEvents.canceledAt,
        lastReminderAt: schema.scheduleEvents.lastReminderAt,
        createdAt: schema.scheduleEvents.createdAt,
        updatedAt: schema.scheduleEvents.updatedAt,
      })
      .from(schema.scheduleEvents)
      .innerJoin(schema.pools, eq(schema.scheduleEvents.poolId, schema.pools.poolId))
      .where(and(eq(schema.scheduleEvents.eventId, eventId), eq(schema.scheduleEvents.userId, userId)))
      .limit(1);

    if (!event) {
      throw new ScheduleEventNotFoundError();
    }

    return event;
  }

  async listEvents(
    userId: string,
    options: {
      from?: Date;
      to?: Date;
      poolId?: string;
      status?: ScheduleStatus;
      limit?: number;
    } = {}
  ) {
    const conditions = [eq(schema.scheduleEvents.userId, userId)];
    if (options.from) conditions.push(gte(schema.scheduleEvents.dueAt, options.from));
    if (options.to) conditions.push(lte(schema.scheduleEvents.dueAt, options.to));
    if (options.poolId) conditions.push(eq(schema.scheduleEvents.poolId, options.poolId));
    if (options.status) conditions.push(eq(schema.scheduleEvents.status, options.status));

    const items = await this.db
      .select({
        eventId: schema.scheduleEvents.eventId,
        userId: schema.scheduleEvents.userId,
        poolId: schema.scheduleEvents.poolId,
        poolName: schema.pools.name,
        eventType: schema.scheduleEvents.eventType,
        title: schema.scheduleEvents.title,
        notes: schema.scheduleEvents.notes,
        dueAt: schema.scheduleEvents.dueAt,
        timezone: schema.scheduleEvents.timezone,
        recurrence: schema.scheduleEvents.recurrence,
        recurrenceInterval: schema.scheduleEvents.recurrenceInterval,
        reminderLeadMinutes: schema.scheduleEvents.reminderLeadMinutes,
        status: schema.scheduleEvents.status,
        completedAt: schema.scheduleEvents.completedAt,
        canceledAt: schema.scheduleEvents.canceledAt,
        lastReminderAt: schema.scheduleEvents.lastReminderAt,
        createdAt: schema.scheduleEvents.createdAt,
        updatedAt: schema.scheduleEvents.updatedAt,
      })
      .from(schema.scheduleEvents)
      .innerJoin(schema.pools, eq(schema.scheduleEvents.poolId, schema.pools.poolId))
      .where(and(...conditions))
      .orderBy(asc(schema.scheduleEvents.dueAt))
      .limit(Math.min(200, Math.max(1, options.limit ?? 100)));

    return items.map(serializeEvent);
  }

  async createEvent(userId: string, input: ScheduleEventInput) {
    await this.requirePoolAccess(userId, input.poolId);

    const [created] = await this.db
      .insert(schema.scheduleEvents)
      .values({
        userId,
        poolId: input.poolId,
        eventType: input.eventType,
        title: input.title.trim(),
        notes: input.notes?.trim() || null,
        dueAt: new Date(input.dueAt),
        timezone: input.timezone?.trim() || 'UTC',
        recurrence: input.recurrence ?? 'once',
        recurrenceInterval: input.recurrenceInterval ?? 1,
        reminderLeadMinutes: input.reminderLeadMinutes ?? DEFAULT_REMINDER_LEAD_MINUTES,
      })
      .returning({ eventId: schema.scheduleEvents.eventId });

    return this.getOwnedEvent(userId, created.eventId).then(serializeEvent);
  }

  async updateEvent(userId: string, eventId: string, input: ScheduleEventUpdate) {
    const current = await this.getOwnedEvent(userId, eventId);
    if (input.poolId && input.poolId !== current.poolId) {
      await this.requirePoolAccess(userId, input.poolId);
    }

    await this.db
      .update(schema.scheduleEvents)
      .set({
        poolId: input.poolId ?? current.poolId,
        eventType: input.eventType ?? (current.eventType as ScheduleEventType),
        title: input.title?.trim() || current.title,
        notes: input.notes !== undefined ? input.notes?.trim() || null : current.notes,
        dueAt: input.dueAt ? new Date(input.dueAt) : current.dueAt,
        timezone: input.timezone?.trim() || current.timezone,
        recurrence: input.recurrence ?? (current.recurrence as ScheduleRecurrence),
        recurrenceInterval: input.recurrenceInterval ?? current.recurrenceInterval,
        reminderLeadMinutes: input.reminderLeadMinutes ?? current.reminderLeadMinutes,
        status: input.status ?? (current.status as ScheduleStatus),
        canceledAt:
          input.status === 'canceled'
            ? new Date()
            : input.status && input.status !== 'canceled'
              ? null
              : current.canceledAt,
        updatedAt: new Date(),
      })
      .where(eq(schema.scheduleEvents.eventId, eventId));

    return this.getOwnedEvent(userId, eventId).then(serializeEvent);
  }

  async deleteEvent(userId: string, eventId: string) {
    await this.getOwnedEvent(userId, eventId);
    await this.db.delete(schema.scheduleEvents).where(eq(schema.scheduleEvents.eventId, eventId));
    return { deleted: true };
  }

  async completeEvent(userId: string, eventId: string) {
    const current = await this.getOwnedEvent(userId, eventId);
    const dueAt = current.dueAt;
    const recurrence = current.recurrence as ScheduleRecurrence;

    if (recurrence === 'once') {
      await this.db
        .update(schema.scheduleEvents)
        .set({
          status: 'completed',
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.scheduleEvents.eventId, eventId));
    } else {
      await this.db
        .update(schema.scheduleEvents)
        .set({
          dueAt: addRecurrence(dueAt, recurrence, current.recurrenceInterval),
          completedAt: new Date(),
          status: 'scheduled',
          lastReminderAt: null,
          updatedAt: new Date(),
        })
        .where(eq(schema.scheduleEvents.eventId, eventId));
    }

    return this.getOwnedEvent(userId, eventId).then(serializeEvent);
  }

  private async getReminderPreferences(userId: string): Promise<ReminderPreferences> {
    const [user] = await this.db
      .select({ email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.userId, userId))
      .limit(1);

    const [prefs] = await this.db
      .select({
        notificationEmailEnabled: schema.userPreferences.notificationEmailEnabled,
        notificationEmailAddress: schema.userPreferences.notificationEmailAddress,
        notificationPushEnabled: schema.userPreferences.notificationPushEnabled,
        reminderTimezone: schema.userPreferences.reminderTimezone,
        reminderLeadMinutes: schema.userPreferences.reminderLeadMinutes,
        quietHoursStart: schema.userPreferences.quietHoursStart,
        quietHoursEnd: schema.userPreferences.quietHoursEnd,
      })
      .from(schema.userPreferences)
      .where(eq(schema.userPreferences.userId, userId))
      .limit(1);

    return {
      notificationEmailEnabled: prefs?.notificationEmailEnabled ?? true,
      notificationEmailAddress: prefs?.notificationEmailAddress ?? user?.email ?? null,
      notificationPushEnabled: prefs?.notificationPushEnabled ?? false,
      reminderTimezone: prefs?.reminderTimezone ?? null,
      reminderLeadMinutes: prefs?.reminderLeadMinutes ?? DEFAULT_REMINDER_LEAD_MINUTES,
      quietHoursStart: prefs?.quietHoursStart ?? null,
      quietHoursEnd: prefs?.quietHoursEnd ?? null,
    };
  }

  private buildReminderText(event: {
    title: string;
    eventType: string;
    poolName: string;
    dueAt: Date;
    notes: string | null;
  }) {
    const dueLabel = event.dueAt.toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC',
    });
    return {
      title: `Upcoming ${event.eventType}: ${event.title}`,
      message: `${event.title} for ${event.poolName} is due ${dueLabel}.${event.notes ? ` Notes: ${event.notes}` : ''}`,
    };
  }

  async processDueReminders(now = new Date()) {
    const dueRows = await this.db
      .select({
        eventId: schema.scheduleEvents.eventId,
        userId: schema.scheduleEvents.userId,
        poolId: schema.scheduleEvents.poolId,
        poolName: schema.pools.name,
        eventType: schema.scheduleEvents.eventType,
        title: schema.scheduleEvents.title,
        notes: schema.scheduleEvents.notes,
        dueAt: schema.scheduleEvents.dueAt,
        timezone: schema.scheduleEvents.timezone,
        recurrence: schema.scheduleEvents.recurrence,
        recurrenceInterval: schema.scheduleEvents.recurrenceInterval,
        reminderLeadMinutes: schema.scheduleEvents.reminderLeadMinutes,
        lastReminderAt: schema.scheduleEvents.lastReminderAt,
      })
      .from(schema.scheduleEvents)
      .innerJoin(schema.pools, eq(schema.scheduleEvents.poolId, schema.pools.poolId))
      .where(eq(schema.scheduleEvents.status, 'scheduled'))
      .orderBy(asc(schema.scheduleEvents.dueAt))
      .limit(100);

    let processed = 0;
    let notificationsCreated = 0;
    let emailsSent = 0;

    for (const row of dueRows) {
      const prefs = await this.getReminderPreferences(row.userId);
      const leadMinutes = row.reminderLeadMinutes ?? prefs.reminderLeadMinutes ?? DEFAULT_REMINDER_LEAD_MINUTES;
      const reminderAt = new Date(row.dueAt.getTime() - leadMinutes * 60_000);
      if (reminderAt > now) {
        continue;
      }

      const [existingReminder] = await this.db
        .select({ reminderId: schema.scheduleEventNotifications.reminderId })
        .from(schema.scheduleEventNotifications)
        .where(
          and(
            eq(schema.scheduleEventNotifications.eventId, row.eventId),
            eq(schema.scheduleEventNotifications.channel, 'in_app'),
            eq(schema.scheduleEventNotifications.reminderAt, reminderAt)
          )
        )
        .limit(1);

      if (existingReminder) {
        continue;
      }

      processed += 1;
      const reminderText = this.buildReminderText(row);
      const deliveredAt = new Date();

      const [inAppNotification] = await this.db
        .insert(schema.notifications)
        .values({
          userId: row.userId,
          poolId: row.poolId,
          channel: 'in_app',
          title: reminderText.title,
          message: reminderText.message,
          data: {
            eventId: row.eventId,
            dueAt: row.dueAt.toISOString(),
            eventType: row.eventType,
          },
          status: 'delivered',
          sentAt: deliveredAt,
          deliveredAt,
        })
        .returning({ notificationId: schema.notifications.notificationId });

      notificationsCreated += 1;

      await this.db.insert(schema.scheduleEventNotifications).values({
        eventId: row.eventId,
        userId: row.userId,
        channel: 'in_app',
        reminderAt,
        status: 'delivered',
        notificationId: inAppNotification.notificationId,
        sentAt: deliveredAt,
        deliveredAt,
      });

      if (prefs.notificationEmailEnabled && prefs.notificationEmailAddress) {
        try {
          await mailerService.sendScheduleReminderEmail(prefs.notificationEmailAddress, {
            title: row.title,
            eventType: row.eventType,
            poolName: row.poolName,
            dueAt: row.dueAt.toISOString(),
            notes: row.notes,
          });

          const [emailNotification] = await this.db
            .insert(schema.notifications)
            .values({
              userId: row.userId,
              poolId: row.poolId,
              channel: 'email',
              title: reminderText.title,
              message: reminderText.message,
              data: {
                eventId: row.eventId,
                dueAt: row.dueAt.toISOString(),
                eventType: row.eventType,
              },
              status: 'delivered',
              sentAt: deliveredAt,
              deliveredAt,
            })
            .returning({ notificationId: schema.notifications.notificationId });

          await this.db.insert(schema.scheduleEventNotifications).values({
            eventId: row.eventId,
            userId: row.userId,
            channel: 'email',
            reminderAt,
            status: 'delivered',
            notificationId: emailNotification.notificationId,
            sentAt: deliveredAt,
            deliveredAt,
          });
          notificationsCreated += 1;
          emailsSent += 1;
        } catch (error) {
          await this.db.insert(schema.scheduleEventNotifications).values({
            eventId: row.eventId,
            userId: row.userId,
            channel: 'email',
            reminderAt,
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Unknown reminder email failure',
          });
        }
      }

      await this.db
        .update(schema.scheduleEvents)
        .set({ lastReminderAt: deliveredAt, updatedAt: new Date() })
        .where(eq(schema.scheduleEvents.eventId, row.eventId));

      await auditWriterService.write({
        action: 'schedule.reminder.sent',
        entity: 'schedule_event',
        entityId: row.eventId,
        userId: row.userId,
        poolId: row.poolId,
        data: {
          reminderAt: reminderAt.toISOString(),
          dueAt: row.dueAt.toISOString(),
          emailSent: prefs.notificationEmailEnabled && Boolean(prefs.notificationEmailAddress),
        },
      });
    }

    return { processed, notificationsCreated, emailsSent };
  }

  async getSummary(userId: string) {
    const [scheduledRow, overdueRow] = await Promise.all([
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.scheduleEvents)
        .where(and(eq(schema.scheduleEvents.userId, userId), eq(schema.scheduleEvents.status, 'scheduled')))
        .then((rows) => rows[0]),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.scheduleEvents)
        .where(
          and(
            eq(schema.scheduleEvents.userId, userId),
            eq(schema.scheduleEvents.status, 'scheduled'),
            lte(schema.scheduleEvents.dueAt, new Date())
          )
        )
        .then((rows) => rows[0]),
    ]);

    return {
      scheduledCount: Number(scheduledRow?.count ?? 0),
      overdueCount: Number(overdueRow?.count ?? 0),
    };
  }
}

export const scheduleEventsService = new ScheduleEventsService();
