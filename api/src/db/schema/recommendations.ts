import { pgTable, uuid, varchar, integer, text, jsonb, timestamp, decimal } from 'drizzle-orm/pg-core';
import { pools } from './pools';
import { users } from './users';
import { testSessions } from './test_sessions';

export const recommendations = pgTable('recommendations', {
  recommendationId: uuid('recommendation_id').primaryKey().defaultRandom(),
  poolId: uuid('pool_id').notNull().references(() => pools.poolId, { onDelete: 'cascade' }),
  createdBy: uuid('created_by').references(() => users.userId, { onDelete: 'set null' }),
  linkedTestId: uuid('linked_test_id').references(() => testSessions.sessionId, { onDelete: 'set null' }),
  type: varchar('type', { length: 30 }).notNull(),
  priorityScore: integer('priority_score').notNull().default(5),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  payload: jsonb('payload'),
  status: varchar('status', { length: 16 }).notNull().default('pending'),
  confidenceScore: decimal('confidence_score', { precision: 3, scale: 2 }),
  factorsConsidered: jsonb('factors_considered'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  userAction: jsonb('user_action'),
  userFeedback: text('user_feedback'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
