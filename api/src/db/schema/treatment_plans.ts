import { pgTable, uuid, varchar, jsonb, timestamp, text, integer } from 'drizzle-orm/pg-core';
import { pools } from './pools';
import { testSessions } from './test_sessions';
import { users } from './users';

export const treatmentPlans = pgTable('treatment_plans', {
  planId: uuid('plan_id').primaryKey().defaultRandom(),
  poolId: uuid('pool_id').notNull().references(() => pools.poolId, { onDelete: 'cascade' }),
  linkedTestId: uuid('linked_test_id').references(() => testSessions.sessionId, { onDelete: 'set null' }),
  generatedBy: uuid('generated_by').references(() => users.userId, { onDelete: 'set null' }),
  version: integer('version').notNull().default(1),
  status: varchar('status', { length: 24 }).notNull().default('generated'),
  provider: varchar('provider', { length: 24 }),
  modelId: varchar('model_id', { length: 128 }),
  promptHash: varchar('prompt_hash', { length: 64 }).notNull(),
  contextHash: varchar('context_hash', { length: 64 }).notNull(),
  requestPayload: jsonb('request_payload'),
  responsePayload: jsonb('response_payload'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
