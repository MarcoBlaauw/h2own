import { pgTable, uuid, varchar, jsonb, text, boolean, timestamp } from 'drizzle-orm/pg-core';

export const testKits = pgTable('test_kits', {
  testKitId: uuid('test_kit_id').primaryKey().defaultRandom(),
  brand: varchar('brand', { length: 80 }).notNull(),
  model: varchar('model', { length: 80 }).notNull(),
  testMethods: jsonb('test_methods'),
  accuracyRating: varchar('accuracy_rating', { length: 20 }),
  notes: text('notes'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
