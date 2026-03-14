import { pgTable, uuid, jsonb, decimal, timestamp, integer, varchar, text } from 'drizzle-orm/pg-core';
import { pools } from './pools';
import { recommendations } from './recommendations';
import { treatmentPlans } from './treatment_plans';
import { users } from './users';

export const predictionOutcomes = pgTable('prediction_outcomes', {
  outcomeId: uuid('outcome_id').primaryKey().defaultRandom(),
  poolId: uuid('pool_id').notNull().references(() => pools.poolId, { onDelete: 'cascade' }),
  recommendationId: uuid('recommendation_id').references(() => recommendations.recommendationId, {
    onDelete: 'cascade',
  }),
  planId: uuid('plan_id').references(() => treatmentPlans.planId, { onDelete: 'set null' }),
  recommendationType: varchar('recommendation_type', { length: 64 }),
  treatmentType: varchar('treatment_type', { length: 64 }),
  checkpointHours: integer('checkpoint_hours').notNull(),
  dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
  status: varchar('status', { length: 24 }).notNull().default('pending'),
  predictedValues: jsonb('predicted_values').notNull(),
  actualValues: jsonb('actual_values'),
  outcomeLink: text('outcome_link'),
  observedIssues: text('observed_issues'),
  accuracyScore: decimal('accuracy_score', { precision: 3, scale: 2 }),
  qualitySignal: decimal('quality_signal', { precision: 3, scale: 2 }),
  createdBy: uuid('created_by').references(() => users.userId, { onDelete: 'set null' }),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
