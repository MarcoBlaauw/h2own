import { integer, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { pools } from './pools.js';
import { users } from './users.js';

export const scheduleEvents = pgTable('schedule_events', {
  eventId: uuid('event_id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.userId, { onDelete: 'cascade' }),
  poolId: uuid('pool_id')
    .notNull()
    .references(() => pools.poolId, { onDelete: 'cascade' }),
  eventType: varchar('event_type', { length: 24 }).notNull(),
  title: varchar('title', { length: 160 }).notNull(),
  notes: text('notes'),
  dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
  timezone: varchar('timezone', { length: 64 }).notNull().default('UTC'),
  recurrence: varchar('recurrence', { length: 16 }).notNull().default('once'),
  recurrenceInterval: integer('recurrence_interval').notNull().default(1),
  reminderLeadMinutes: integer('reminder_lead_minutes').notNull().default(1440),
  status: varchar('status', { length: 16 }).notNull().default('scheduled'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  canceledAt: timestamp('canceled_at', { withTimezone: true }),
  lastReminderAt: timestamp('last_reminder_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
