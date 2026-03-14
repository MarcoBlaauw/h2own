import { pgTable, uuid, timestamp, decimal, varchar, text, jsonb, index } from 'drizzle-orm/pg-core';
import { pools } from './pools';
import { products } from './products';
import { users } from './users';
import { chemicalActions } from './chemical_actions';
import { inventoryStock } from './inventory_stock';

export const inventoryTransactions = pgTable(
  'inventory_transactions',
  {
    transactionId: uuid('transaction_id').primaryKey().defaultRandom(),
    poolId: uuid('pool_id').notNull().references(() => pools.poolId, { onDelete: 'cascade' }),
    productId: uuid('product_id').notNull().references(() => products.productId, { onDelete: 'cascade' }),
    stockId: uuid('stock_id').references(() => inventoryStock.stockId, { onDelete: 'set null' }),
    transactionType: varchar('transaction_type', { length: 20 }).notNull(),
    quantityDelta: decimal('quantity_delta', { precision: 12, scale: 3 }).notNull(),
    unit: varchar('unit', { length: 20 }).notNull(),
    source: varchar('source', { length: 50 }).notNull().default('manual'),
    chemicalActionId: uuid('chemical_action_id').references(() => chemicalActions.actionId, { onDelete: 'set null' }),
    performedBy: uuid('performed_by').references(() => users.userId, { onDelete: 'set null' }),
    note: text('note'),
    meta: jsonb('meta'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => ({
    poolIdx: index('inventory_transactions_pool_idx').on(table.poolId),
    productIdx: index('inventory_transactions_product_idx').on(table.productId),
    actionIdx: index('inventory_transactions_chemical_action_idx').on(table.chemicalActionId),
  })
);
