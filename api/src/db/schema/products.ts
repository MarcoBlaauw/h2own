import { pgTable, uuid, varchar, jsonb, decimal, boolean, timestamp, integer } from 'drizzle-orm/pg-core';
import { productCategories } from './product_categories';

export const products = pgTable('products', {
  productId: uuid('product_id').primaryKey().defaultRandom(),
  categoryId: uuid('category_id').notNull().references(() => productCategories.categoryId, { onDelete: 'cascade' }),
  brand: varchar('brand', { length: 80 }),
  name: varchar('name', { length: 120 }).notNull(),
  productType: varchar('product_type', { length: 50 }),
  activeIngredients: jsonb('active_ingredients'),
  concentrationPercent: decimal('concentration_percent', { precision: 5, scale: 2 }),
  phEffect: decimal('ph_effect', { precision: 3, scale: 2 }).default('0'),
  strengthFactor: decimal('strength_factor', { precision: 4, scale: 2 }).default('1.0'),
  dosePer10kGallons: decimal('dose_per_10k_gallons', { precision: 8, scale: 2 }),
  doseUnit: varchar('dose_unit', { length: 20 }),
  affectsFc: boolean('affects_fc').default(false),
  affectsPh: boolean('affects_ph').default(false),
  affectsTa: boolean('affects_ta').default(false),
  affectsCya: boolean('affects_cya').default(false),
  fcChangePerDose: decimal('fc_change_per_dose', { precision: 4, scale: 2 }).default('0'),
  phChangePerDose: decimal('ph_change_per_dose', { precision: 4, scale: 2 }).default('0'),
  taChangePerDose: integer('ta_change_per_dose').default(0),
  cyaChangePerDose: integer('cya_change_per_dose').default(0),
  form: varchar('form', { length: 20 }),
  packageSizes: jsonb('package_sizes'),
  isActive: boolean('is_active').default(true),
  averageCostPerUnit: decimal('average_cost_per_unit', { precision: 8, scale: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
