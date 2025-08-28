import { pgTable, uuid, varchar, decimal, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const userLocations = pgTable('user_locations', {
  locationId: uuid('location_id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.userId, { onDelete: 'cascade' }),
  name: varchar('name', { length: 120 }).notNull(),
  latitude: decimal('latitude', { precision: 10, scale: 8 }),
  longitude: decimal('longitude', { precision: 11, scale: 8 }),
  timezone: varchar('timezone', { length: 50 }).default('UTC'),
  isPrimary: boolean('is_primary').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
