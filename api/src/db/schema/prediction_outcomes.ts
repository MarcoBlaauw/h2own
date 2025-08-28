import { pgTable, uuid, jsonb, decimal, timestamp } from 'drizzle-orm/pg-core';
import { recommendations } from './recommendations';

export const predictionOutcomes = pgTable('prediction_outcomes', {
  outcomeId: uuid('outcome_id').primaryKey().defaultRandom(),
  recommendationId: uuid('recommendation_id').notNull().references(() => recommendations.recommendationId, { onDelete: 'cascade' }),
  predictedValues: jsonb('predicted_values').notNull(),
  actualValues: jsonb('actual_values'),
  accuracyScore: decimal('accuracy_score', { precision: 3, scale: 2 }),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
