import { pgTable, uuid, varchar, text, decimal, char, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { products } from './products';
import { vendors } from './vendors';

export const productVendorPrices = pgTable(
  'product_vendor_prices',
  {
    priceId: uuid('price_id').primaryKey().defaultRandom(),
    productId: uuid('product_id').notNull().references(() => products.productId, { onDelete: 'cascade' }),
    vendorId: uuid('vendor_id').notNull().references(() => vendors.vendorId, { onDelete: 'cascade' }),
    vendorSku: varchar('vendor_sku', { length: 120 }),
    productUrl: text('product_url'),
    unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
    currency: char('currency', { length: 3 }).notNull().default('USD'),
    packageSize: varchar('package_size', { length: 80 }),
    unitLabel: varchar('unit_label', { length: 20 }),
    source: varchar('source', { length: 20 }).notNull().default('manual'),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }),
    isPrimary: boolean('is_primary').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => ({
    productIdx: index('product_vendor_prices_product_idx').on(table.productId),
    vendorIdx: index('product_vendor_prices_vendor_idx').on(table.vendorId),
  })
);
