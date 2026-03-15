import { pgTable, uuid, timestamp, decimal, integer, varchar, uniqueIndex, index, char } from 'drizzle-orm/pg-core';
import { pools } from './pools';
import { products } from './products';
import { users } from './users';
import { vendors } from './vendors';

export const inventoryStock = pgTable(
  'inventory_stock',
  {
    stockId: uuid('stock_id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id').notNull().references(() => users.userId, { onDelete: 'cascade' }),
    poolId: uuid('pool_id').references(() => pools.poolId, { onDelete: 'set null' }),
    productId: uuid('product_id').notNull().references(() => products.productId, { onDelete: 'cascade' }),
    quantityOnHand: decimal('quantity_on_hand', { precision: 12, scale: 3 }).notNull().default('0'),
    reorderPoint: decimal('reorder_point', { precision: 12, scale: 3 }).notNull().default('0'),
    unit: varchar('unit', { length: 20 }).notNull(),
    leadTimeDays: integer('lead_time_days').notNull().default(7),
    preferredVendorId: uuid('preferred_vendor_id').references(() => vendors.vendorId, { onDelete: 'set null' }),
    preferredUnitPrice: decimal('preferred_unit_price', { precision: 10, scale: 2 }),
    preferredCurrency: char('preferred_currency', { length: 3 }).default('USD'),
    lastDecrementedAt: timestamp('last_decremented_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => ({
    ownerProductUnique: uniqueIndex('inventory_stock_owner_product_unique').on(table.ownerId, table.productId),
    poolIdx: index('inventory_stock_pool_idx').on(table.poolId),
    ownerIdx: index('inventory_stock_owner_idx').on(table.ownerId),
  })
);
