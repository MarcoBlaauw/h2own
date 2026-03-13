import { bigint, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { messageThreads } from './message_threads.js';
import { users } from './users.js';

export const messages = pgTable('messages', {
  messageId: bigint('message_id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  threadId: uuid('thread_id')
    .notNull()
    .references(() => messageThreads.threadId, { onDelete: 'cascade' }),
  senderUserId: uuid('sender_user_id')
    .notNull()
    .references(() => users.userId, { onDelete: 'cascade' }),
  body: text('body').notNull(),
  attachments: jsonb('attachments'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  editedAt: timestamp('edited_at', { withTimezone: true }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});
