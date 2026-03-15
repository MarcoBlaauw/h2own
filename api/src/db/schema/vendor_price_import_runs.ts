import { pgTable, uuid, varchar, integer, boolean, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { vendors } from './vendors';
import { users } from './users';

export const vendorPriceImportRuns = pgTable(
  'vendor_price_import_runs',
  {
    runId: uuid('run_id').primaryKey().defaultRandom(),
    vendorId: uuid('vendor_id').notNull().references(() => vendors.vendorId, { onDelete: 'cascade' }),
    actorUserId: uuid('actor_user_id').references(() => users.userId, { onDelete: 'set null' }),
    format: varchar('format', { length: 16 }).notNull(),
    dryRun: boolean('dry_run').notNull().default(false),
    status: varchar('status', { length: 24 }).notNull(),
    importedRows: integer('imported_rows').notNull().default(0),
    createdPrices: integer('created_prices').notNull().default(0),
    updatedPrices: integer('updated_prices').notNull().default(0),
    skippedRows: integer('skipped_rows').notNull().default(0),
    rowResults: jsonb('row_results'),
    message: varchar('message', { length: 500 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => ({
    vendorIdx: index('vendor_price_import_runs_vendor_idx').on(table.vendorId),
    actorIdx: index('vendor_price_import_runs_actor_idx').on(table.actorUserId),
    createdAtIdx: index('vendor_price_import_runs_created_at_idx').on(table.createdAt),
  })
);
