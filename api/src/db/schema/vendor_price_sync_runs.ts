import { pgTable, uuid, varchar, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { vendors } from './vendors';
import { users } from './users';

export const vendorPriceSyncRuns = pgTable(
  'vendor_price_sync_runs',
  {
    runId: uuid('run_id').primaryKey().defaultRandom(),
    vendorId: uuid('vendor_id').notNull().references(() => vendors.vendorId, { onDelete: 'cascade' }),
    actorUserId: uuid('actor_user_id').references(() => users.userId, { onDelete: 'set null' }),
    triggerSource: varchar('trigger_source', { length: 20 }).notNull().default('manual'),
    status: varchar('status', { length: 24 }).notNull(),
    updatedPrices: integer('updated_prices').notNull().default(0),
    linkedProducts: integer('linked_products').notNull().default(0),
    message: varchar('message', { length: 500 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => ({
    vendorIdx: index('vendor_price_sync_runs_vendor_idx').on(table.vendorId),
    createdAtIdx: index('vendor_price_sync_runs_created_at_idx').on(table.createdAt),
  })
);
