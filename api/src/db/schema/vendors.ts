import { pgTable, uuid, varchar, text, boolean, jsonb, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const vendors = pgTable(
  'vendors',
  {
    vendorId: uuid('vendor_id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 120 }).notNull(),
    slug: varchar('slug', { length: 120 }).notNull(),
    websiteUrl: text('website_url'),
    provider: varchar('provider', { length: 60 }),
    externalMetadata: jsonb('external_metadata'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => ({
    slugUnique: uniqueIndex('vendors_slug_unique').on(table.slug),
  })
);
