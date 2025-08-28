import { pgTable, uuid, varchar, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';
import { userLocations } from './user_locations';

export const pools = pgTable('pools', {
  poolId: uuid('pool_id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull().references(() => users.userId, { onDelete: 'cascade' }),
  locationId: uuid('location_id').references(() => userLocations.locationId, { onDelete: 'set null' }),
  name: varchar('name', { length: 120 }).notNull(),
  volumeGallons: integer('volume_gallons').notNull(),
  surfaceType: varchar('surface_type', { length: 30 }),
  sanitizerType: varchar('sanitizer_type', { length: 30 }),
  saltLevelPpm: integer('salt_level_ppm'),
  shadeLevel: varchar('shade_level', { length: 20 }),
  enclosureType: varchar('enclosure_type', { length: 20 }),
  hasCover: boolean('has_cover').default(false),
  pumpGpm: integer('pump_gpm'),
  filterType: varchar('filter_type', { length: 30 }),
  hasHeater: boolean('has_heater').default(false),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
