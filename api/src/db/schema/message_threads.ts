import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { pools } from './pools.js';

export const messageThreads = pgTable('message_threads', {
  threadId: uuid('thread_id').primaryKey().defaultRandom(),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.userId, { onDelete: 'cascade' }),
  poolId: uuid('pool_id').references(() => pools.poolId, { onDelete: 'set null' }),
  subject: varchar('subject', { length: 200 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
