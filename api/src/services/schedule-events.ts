import { createHash } from 'node:crypto';
import { and, asc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { db as dbClient } from '../db/index.js';
import * as schema from '../db/schema/index.js';
import { notificationDispatcherService, type NotificationChannel } from './notification-dispatcher.js';

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
  notificationSmsEnabled: boolean;
  notificationPushEnabled: boolean;
  notificationPhoneNumber: string | null;
  notificationSmsVerified: boolean;
  notificationPushDeviceRegistered: boolean;
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



export class ScheduleEventConflictError extends Error {
  readonly statusCode = 409;
  readonly code = 'ScheduleEventConflict';

  constructor(
    readonly conflicts: { overlappingEventIds: string[]; existingReminderEventIds: string[] },
    message = 'Scheduling conflicts detected. Confirm to proceed.'
  ) {
    super(message);
    this.name = 'ScheduleEventConflictError';
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

  async createEventsForTreatmentPlan(
    userId: string,
    input: {
      poolId: string;
      items: Array<{
        eventType: ScheduleEventType;
        title: string;
        notes?: string | null;
        dueAt: string;
        timezone?: string | null;
        recurrence?: ScheduleRecurrence;
        leadMinutes?: number | null;
      }>;
      confirmConflicts?: boolean;
    }
  ) {
    await this.requirePoolAccess(userId, input.poolId);

    const uniqueCandidates = input.items.map((item) => ({
      ...item,
      dueAtDate: new Date(item.dueAt),
      titleHash: createHash('sha256').update(item.title.trim().toLowerCase()).digest('hex'),
    }));

    const dueDates = Array.from(new Set(uniqueCandidates.map((item) => item.dueAtDate.toISOString()))).map((v) => new Date(v));
    const existing = dueDates.length === 0 ? [] : await this.db
      .select({
        eventId: schema.scheduleEvents.eventId,
        dueAt: schema.scheduleEvents.dueAt,
        eventType: schema.scheduleEvents.eventType,
        title: schema.scheduleEvents.title,
      })
      .from(schema.scheduleEvents)
      .where(and(
        eq(schema.scheduleEvents.userId, userId),
        eq(schema.scheduleEvents.poolId, input.poolId),
        inArray(schema.scheduleEvents.dueAt, dueDates)
      ));

    const existingKey = new Set(existing.map((row) => `${row.dueAt.toISOString()}|${row.eventType}|${createHash('sha256').update(row.title.trim().toLowerCase()).digest('hex')}`));

    const toCreate = uniqueCandidates.filter((item) => !existingKey.has(`${item.dueAtDate.toISOString()}|${item.eventType}|${item.titleHash}`));

    const dueStart = toCreate.length ? new Date(Math.min(...toCreate.map((item) => item.dueAtDate.getTime())) - 60 * 60 * 1000) : null;
    const dueEnd = toCreate.length ? new Date(Math.max(...toCreate.map((item) => item.dueAtDate.getTime())) + 60 * 60 * 1000) : null;

    let overlappingEvents: Array<{ eventId: string; dueAt: Date }> = [];
    let reminderEvents: Array<{ eventId: string }> = [];

    if (dueStart && dueEnd) {
      overlappingEvents = await this.db
        .select({ eventId: schema.scheduleEvents.eventId, dueAt: schema.scheduleEvents.dueAt })
        .from(schema.scheduleEvents)
        .where(and(
          eq(schema.scheduleEvents.userId, userId),
          eq(schema.scheduleEvents.poolId, input.poolId),
          gte(schema.scheduleEvents.dueAt, dueStart),
          lte(schema.scheduleEvents.dueAt, dueEnd),
          eq(schema.scheduleEvents.status, 'scheduled')
        ));

      reminderEvents = await this.db
        .select({ eventId: schema.scheduleEventNotifications.eventId })
        .from(schema.scheduleEventNotifications)
        .innerJoin(schema.scheduleEvents, eq(schema.scheduleEvents.eventId, schema.scheduleEventNotifications.eventId))
        .where(and(
          eq(schema.scheduleEvents.userId, userId),
          eq(schema.scheduleEvents.poolId, input.poolId),
          gte(schema.scheduleEvents.dueAt, dueStart),
          lte(schema.scheduleEvents.dueAt, dueEnd)
        ));
    }

    if ((overlappingEvents.length > 0 || reminderEvents.length > 0) && !input.confirmConflicts) {
      throw new ScheduleEventConflictError({
        overlappingEventIds: overlappingEvents.map((event) => event.eventId),
        existingReminderEventIds: reminderEvents.map((event) => event.eventId),
      });
    }

    const createdIds = [];
    for (const item of toCreate) {
      const [created] = await this.db.insert(schema.scheduleEvents).values({
        userId,
        poolId: input.poolId,
        eventType: item.eventType,
        title: item.title.trim(),
        notes: item.notes?.trim() || null,
        dueAt: item.dueAtDate,
        timezone: item.timezone?.trim() || 'UTC',
        recurrence: item.recurrence ?? 'once',
        recurrenceInterval: 1,
        reminderLeadMinutes: item.leadMinutes ?? DEFAULT_REMINDER_LEAD_MINUTES,
      }).returning({ eventId: schema.scheduleEvents.eventId });
      createdIds.push(created.eventId);
    }

    const items = [];
    for (const eventId of createdIds) {
      items.push(await this.getOwnedEvent(userId, eventId).then(serializeEvent));
    }

    return {
      items,
      createdEventIds: createdIds,
      deduplicatedCount: uniqueCandidates.length - toCreate.length,
      conflicts: {
        overlappingEventIds: overlappingEvents.map((event) => event.eventId),
        existingReminderEventIds: reminderEvents.map((event) => event.eventId),
      },
    };
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
        notificationSmsEnabled: schema.userPreferences.notificationSmsEnabled,
        notificationPushEnabled: schema.userPreferences.notificationPushEnabled,
        notificationPhoneNumber: schema.userPreferences.notificationPhoneNumber,
        notificationSmsVerified: schema.userPreferences.notificationSmsVerified,
        notificationPushDeviceRegistered: schema.userPreferences.notificationPushDeviceRegistered,
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
      notificationSmsEnabled: prefs?.notificationSmsEnabled ?? false,
      notificationPushEnabled: prefs?.notificationPushEnabled ?? false,
      notificationPhoneNumber: prefs?.notificationPhoneNumber ?? null,
      notificationSmsVerified: prefs?.notificationSmsVerified ?? false,
      notificationPushDeviceRegistered: prefs?.notificationPushDeviceRegistered ?? false,
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

  private isQuietHours(now: Date, prefs: ReminderPreferences) {
    if (!prefs.quietHoursStart || !prefs.quietHoursEnd) return false;
    const [startHour, startMinute] = prefs.quietHoursStart.split(':').map(Number);
    const [endHour, endMinute] = prefs.quietHoursEnd.split(':').map(Number);
    const minutesNow = now.getUTCHours() * 60 + now.getUTCMinutes();
    const start = startHour * 60 + startMinute;
    const end = endHour * 60 + endMinute;
    if (Number.isNaN(start) || Number.isNaN(end)) return false;
    if (start === end) return false;
    if (start < end) return minutesNow >= start && minutesNow < end;
    return minutesNow >= start || minutesNow < end;
  }

  private getReminderChannels(prefs: ReminderPreferences): NotificationChannel[] {
    const channels: NotificationChannel[] = ['in_app'];
    if (prefs.notificationEmailEnabled && prefs.notificationEmailAddress) channels.push('email');
    if (prefs.notificationSmsEnabled && prefs.notificationSmsVerified && prefs.notificationPhoneNumber) channels.push('sms');
    if (prefs.notificationPushEnabled && prefs.notificationPushDeviceRegistered) channels.push('push');
    return channels;
  }

  private backoffMinutes(attempt: number) {
    return Math.min(60, Math.max(1, 2 ** Math.max(0, attempt - 1)));
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
        reminderLeadMinutes: schema.scheduleEvents.reminderLeadMinutes,
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
      if (reminderAt > now) continue;
      if (this.isQuietHours(now, prefs)) continue;

      const reminderText = this.buildReminderText(row);
      const channels = this.getReminderChannels(prefs);

      for (const channel of channels) {
        const [existingReminder] = await this.db
          .select({
            reminderId: schema.scheduleEventNotifications.reminderId,
            attemptCount: schema.scheduleEventNotifications.attemptCount,
            status: schema.scheduleEventNotifications.status,
          })
          .from(schema.scheduleEventNotifications)
          .where(
            and(
              eq(schema.scheduleEventNotifications.eventId, row.eventId),
              eq(schema.scheduleEventNotifications.channel, channel),
              eq(schema.scheduleEventNotifications.reminderAt, reminderAt)
            )
          )
          .limit(1);

        if (existingReminder?.status === 'delivered') continue;

        const attemptCount = Number(existingReminder?.attemptCount ?? 0) + 1;
        const dispatchResult = await notificationDispatcherService.dispatch({
          userId: row.userId,
          channel,
          title: reminderText.title,
          message: reminderText.message,
          email: prefs.notificationEmailAddress,
          phone: prefs.notificationPhoneNumber,
          pushDeviceRegistered: prefs.notificationPushDeviceRegistered,
          metadata: { eventId: row.eventId },
        });

        const deliveredAt = new Date();
        if (dispatchResult.ok) {
          const [notification] = await this.db
            .insert(schema.notifications)
            .values({
              userId: row.userId,
              poolId: row.poolId,
              channel,
              title: reminderText.title,
              message: reminderText.message,
              data: { eventId: row.eventId, dueAt: row.dueAt.toISOString(), eventType: row.eventType },
              status: 'delivered',
              providerMessageId: dispatchResult.providerMessageId,
              sentAt: deliveredAt,
              deliveredAt,
            })
            .returning({ notificationId: schema.notifications.notificationId });

          if (existingReminder) {
            await this.db
              .update(schema.scheduleEventNotifications)
              .set({
                status: 'delivered',
                notificationId: notification.notificationId,
                sentAt: deliveredAt,
                deliveredAt,
                providerMessageId: dispatchResult.providerMessageId,
                errorMessage: null,
                errorCategory: null,
                attemptCount,
                lastAttemptAt: deliveredAt,
                nextRetryAt: null,
              })
              .where(eq(schema.scheduleEventNotifications.reminderId, existingReminder.reminderId));
          } else {
            await this.db.insert(schema.scheduleEventNotifications).values({
              eventId: row.eventId,
              userId: row.userId,
              channel,
              reminderAt,
              status: 'delivered',
              notificationId: notification.notificationId,
              providerMessageId: dispatchResult.providerMessageId,
              sentAt: deliveredAt,
              deliveredAt,
              attemptCount,
              lastAttemptAt: deliveredAt,
            });
          }

          notificationsCreated += 1;
          if (channel === 'email') emailsSent += 1;
        } else {
          const nextRetryAt = new Date(now.getTime() + this.backoffMinutes(attemptCount) * 60_000);
          const status = attemptCount >= 5 ? 'failed' : 'retry';
          if (existingReminder) {
            await this.db
              .update(schema.scheduleEventNotifications)
              .set({
                status,
                errorMessage: dispatchResult.errorMessage ?? 'Notification dispatch failed',
                errorCategory: dispatchResult.errorCategory ?? 'unknown',
                attemptCount,
                lastAttemptAt: now,
                nextRetryAt: status === 'retry' ? nextRetryAt : null,
              })
              .where(eq(schema.scheduleEventNotifications.reminderId, existingReminder.reminderId));
          } else {
            await this.db.insert(schema.scheduleEventNotifications).values({
              eventId: row.eventId,
              userId: row.userId,
              channel,
              reminderAt,
              status,
              errorMessage: dispatchResult.errorMessage ?? 'Notification dispatch failed',
              errorCategory: dispatchResult.errorCategory ?? 'unknown',
              attemptCount,
              lastAttemptAt: now,
              nextRetryAt: status === 'retry' ? nextRetryAt : null,
            });
          }
        }
      }

      processed += 1;
      await this.db
        .update(schema.scheduleEvents)
        .set({ lastReminderAt: now, updatedAt: new Date() })
        .where(eq(schema.scheduleEvents.eventId, row.eventId));
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
