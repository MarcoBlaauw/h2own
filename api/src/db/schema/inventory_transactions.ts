import { pgTable, uuid, timestamp, decimal, varchar, text, jsonb, index, char } from 'drizzle-orm/pg-core';
import { pools } from './pools';
import { products } from './products';
import { users } from './users';
import { chemicalActions } from './chemical_actions';
import { inventoryStock } from './inventory_stock';
import { vendors } from './vendors';

export const inventoryTransactions = pgTable(
  'inventory_transactions',
  {
    transactionId: uuid('transaction_id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id').notNull().references(() => users.userId, { onDelete: 'cascade' }),
    poolId: uuid('pool_id').references(() => pools.poolId, { onDelete: 'set null' }),
    productId: uuid('product_id').notNull().references(() => products.productId, { onDelete: 'cascade' }),
    stockId: uuid('stock_id').references(() => inventoryStock.stockId, { onDelete: 'set null' }),
    transactionType: varchar('transaction_type', { length: 20 }).notNull(),
    quantityDelta: decimal('quantity_delta', { precision: 12, scale: 3 }).notNull(),
    unit: varchar('unit', { length: 20 }).notNull(),
    source: varchar('source', { length: 50 }).notNull().default('manual'),
    chemicalActionId: uuid('chemical_action_id').references(() => chemicalActions.actionId, { onDelete: 'set null' }),
    performedBy: uuid('performed_by').references(() => users.userId, { onDelete: 'set null' }),
    vendorId: uuid('vendor_id').references(() => vendors.vendorId, { onDelete: 'set null' }),
    unitPrice: decimal('unit_price', { precision: 10, scale: 2 }),
    currency: char('currency', { length: 3 }).default('USD'),
    note: text('note'),
    meta: jsonb('meta'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => ({
    ownerIdx: index('inventory_transactions_owner_idx').on(table.ownerId),
    poolIdx: index('inventory_transactions_pool_idx').on(table.poolId),
    productIdx: index('inventory_transactions_product_idx').on(table.productId),
    actionIdx: index('inventory_transactions_chemical_action_idx').on(table.chemicalActionId),
  })
);
