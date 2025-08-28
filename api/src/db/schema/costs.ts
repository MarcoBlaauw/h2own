import { pgTable, uuid, decimal, char, text, varchar, timestamp } from 'drizzle-orm/pg-core';
import { pools } from './pools';
import { costCategories } from './cost_categories';
import { chemicalActions } from './chemical_actions';

export const costs = pgTable('costs', {
  costId: uuid('cost_id').primaryKey().defaultRandom(),
  poolId: uuid('pool_id').notNull().references(() => pools.poolId, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').references(() => costCategories.categoryId, { onDelete: 'set null' }),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: char('currency', { length: 3 }).default('USD'),
  description: text('description'),
  chemicalActionId: uuid('chemical_action_id').references(() => chemicalActions.actionId, { onDelete: 'set null' }),
  maintenanceEventId: uuid('maintenance_event_id'),
  equipmentId: uuid('equipment_id'),
  vendor: varchar('vendor', { length: 120 }),
  receiptUrl: text('receipt_url'),
  incurredAt: timestamp('incurred_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
