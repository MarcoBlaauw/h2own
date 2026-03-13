import { pgTable, text, timestamp, uuid, varchar, uniqueIndex } from 'drizzle-orm/pg-core';
import { notifications } from './notifications.js';
import { scheduleEvents } from './schedule_events.js';
import { users } from './users.js';

export const scheduleEventNotifications = pgTable(
  'schedule_event_notifications',
  {
    reminderId: uuid('reminder_id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => scheduleEvents.eventId, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.userId, { onDelete: 'cascade' }),
    channel: varchar('channel', { length: 30 }).notNull(),
    reminderAt: timestamp('reminder_at', { withTimezone: true }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    notificationId: uuid('notification_id').references(() => notifications.notificationId, {
      onDelete: 'set null',
    }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    eventChannelReminderIdx: uniqueIndex('schedule_event_notifications_event_channel_reminder_idx').on(
      table.eventId,
      table.channel,
      table.reminderAt
    ),
  })
);
