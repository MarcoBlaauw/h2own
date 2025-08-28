import { pgTable, uuid, timestamp, decimal, text, varchar, jsonb } from 'drizzle-orm/pg-core';
import { pools } from './pools';
import { products } from './products';
import { users } from './users';
import { testSessions } from './test_sessions';

export const chemicalActions = pgTable('chemical_actions', {
  actionId: uuid('action_id').primaryKey().defaultRandom(),
  poolId: uuid('pool_id').notNull().references(() => pools.poolId, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.productId, { onDelete: 'cascade' }),
  addedBy: uuid('added_by').references(() => users.userId, { onDelete: 'set null' }),
  linkedTestId: uuid('linked_test_id').references(() => testSessions.sessionId, { onDelete: 'set null' }),
  amount: decimal('amount', { precision: 8, scale: 2 }).notNull(),
  unit: varchar('unit', { length: 20 }).notNull(),
  addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  reason: text('reason'),
  additionMethod: varchar('addition_method', { length: 50 }),
  targetEffect: jsonb('target_effect'),
  actualEffect: jsonb('actual_effect'),
  cost: decimal('cost', { precision: 8, scale: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
