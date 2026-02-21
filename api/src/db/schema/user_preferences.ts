import { pgTable, uuid, varchar, char, boolean, numeric, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const userPreferences = pgTable('user_preferences', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.userId, { onDelete: 'cascade' }),
  theme: varchar('theme', { length: 16 }).notNull().default('light'),
  temperatureUnit: char('temperature_unit', { length: 1 }).notNull().default('F'),
  measurementSystem: varchar('measurement_system', { length: 16 }).notNull().default('imperial'),
  currency: char('currency', { length: 3 }).notNull().default('USD'),
  preferredPoolTemp: numeric('preferred_pool_temp', { precision: 5, scale: 2 }),
  notificationEmailEnabled: boolean('notification_email_enabled').notNull().default(true),
  notificationSmsEnabled: boolean('notification_sms_enabled').notNull().default(false),
  notificationPushEnabled: boolean('notification_push_enabled').notNull().default(false),
  notificationEmailAddress: varchar('notification_email_address', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
