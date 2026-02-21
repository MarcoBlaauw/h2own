import { pgTable, uuid, decimal, char, timestamp } from 'drizzle-orm/pg-core';
import { pools } from './pools';

export const poolTemperaturePrefs = pgTable('pool_temperature_prefs', {
  poolId: uuid('pool_id').primaryKey().references(() => pools.poolId, { onDelete: 'cascade' }),
  preferredTempF: decimal('preferred_temp_f', { precision: 5, scale: 2 }),
  minTempF: decimal('min_temp_f', { precision: 5, scale: 2 }),
  maxTempF: decimal('max_temp_f', { precision: 5, scale: 2 }),
  unit: char('unit', { length: 1 }).notNull().default('F'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
