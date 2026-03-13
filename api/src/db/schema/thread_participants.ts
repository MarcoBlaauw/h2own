import { jsonb, pgTable, primaryKey, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { messageThreads } from './message_threads.js';
import { users } from './users.js';

export const threadParticipants = pgTable(
  'thread_participants',
  {
    threadId: uuid('thread_id')
      .notNull()
      .references(() => messageThreads.threadId, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.userId, { onDelete: 'cascade' }),
    role: varchar('role', { length: 30 }).notNull().default('member'),
    metadata: jsonb('metadata'),
    lastReadAt: timestamp('last_read_at', { withTimezone: true }),
    mutedUntil: timestamp('muted_until', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.threadId, table.userId] }),
  })
);
