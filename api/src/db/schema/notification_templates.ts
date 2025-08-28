import { pgTable, uuid, varchar, text, boolean, timestamp } from 'drizzle-orm/pg-core';

export const notificationTemplates = pgTable('notification_templates', {
  templateId: uuid('template_id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  channel: varchar('channel', { length: 30 }).notNull(),
  subject: varchar('subject', { length: 200 }),
  bodyTemplate: text('body_template').notNull(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
