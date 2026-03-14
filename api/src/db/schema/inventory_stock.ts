import { pgTable, uuid, timestamp, decimal, integer, varchar, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { pools } from './pools';
import { products } from './products';

export const inventoryStock = pgTable(
  'inventory_stock',
  {
    stockId: uuid('stock_id').primaryKey().defaultRandom(),
    poolId: uuid('pool_id').notNull().references(() => pools.poolId, { onDelete: 'cascade' }),
    productId: uuid('product_id').notNull().references(() => products.productId, { onDelete: 'cascade' }),
    quantityOnHand: decimal('quantity_on_hand', { precision: 12, scale: 3 }).notNull().default('0'),
    reorderPoint: decimal('reorder_point', { precision: 12, scale: 3 }).notNull().default('0'),
    unit: varchar('unit', { length: 20 }).notNull(),
    leadTimeDays: integer('lead_time_days').notNull().default(7),
    lastDecrementedAt: timestamp('last_decremented_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => ({
    poolProductUnique: uniqueIndex('inventory_stock_pool_product_unique').on(table.poolId, table.productId),
    poolIdx: index('inventory_stock_pool_idx').on(table.poolId),
  })
);
