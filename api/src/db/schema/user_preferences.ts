import { pgTable, uuid, varchar, char, boolean, numeric, timestamp, integer } from 'drizzle-orm/pg-core';
import { users } from './users';
import { pools } from './pools';

export const userPreferences = pgTable('user_preferences', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.userId, { onDelete: 'cascade' }),
  theme: varchar('theme', { length: 16 }).notNull().default('light'),
  temperatureUnit: char('temperature_unit', { length: 1 }).notNull().default('F'),
  measurementSystem: varchar('measurement_system', { length: 16 }).notNull().default('imperial'),
  currency: char('currency', { length: 3 }).notNull().default('USD'),
  preferredPoolTemp: numeric('preferred_pool_temp', { precision: 5, scale: 2 }),
  defaultPoolId: uuid('default_pool_id').references(() => pools.poolId, { onDelete: 'set null' }),
  subscriptionTier: varchar('subscription_tier', { length: 24 }).notNull().default('free'),
  subscriptionStatus: varchar('subscription_status', { length: 24 }).notNull().default('active'),
  notificationEmailEnabled: boolean('notification_email_enabled').notNull().default(true),
  notificationSmsEnabled: boolean('notification_sms_enabled').notNull().default(false),
  notificationPushEnabled: boolean('notification_push_enabled').notNull().default(false),
  notificationEmailAddress: varchar('notification_email_address', { length: 255 }),
  reminderTimezone: varchar('reminder_timezone', { length: 64 }),
  reminderLeadMinutes: integer('reminder_lead_minutes').notNull().default(1440),
  quietHoursStart: char('quiet_hours_start', { length: 5 }),
  quietHoursEnd: char('quiet_hours_end', { length: 5 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
