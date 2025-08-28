import { pgTable, uuid, varchar, text, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';
import { pools } from './pools';
import { notificationTemplates } from './notification_templates';

export const notifications = pgTable('notifications', {
  notificationId: uuid('notification_id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.userId, { onDelete: 'cascade' }),
  poolId: uuid('pool_id').references(() => pools.poolId, { onDelete: 'cascade' }),
  templateId: uuid('template_id').references(() => notificationTemplates.templateId, { onDelete: 'set null' }),
  channel: varchar('channel', { length: 30 }).notNull(),
  title: varchar('title', { length: 200 }),
  message: text('message').notNull(),
  data: jsonb('data'),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
