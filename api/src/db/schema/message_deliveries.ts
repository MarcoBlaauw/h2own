import { bigint, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core';
import { messages } from './messages.js';
import { users } from './users.js';

export const messageDeliveries = pgTable(
  'message_deliveries',
  {
    messageId: bigint('message_id', { mode: 'number' })
      .notNull()
      .references(() => messages.messageId, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.userId, { onDelete: 'cascade' }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.messageId, table.userId] }),
  })
);
