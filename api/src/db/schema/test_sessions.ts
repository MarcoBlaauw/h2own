import { pgTable, uuid, timestamp, decimal, integer, text } from 'drizzle-orm/pg-core';
import { pools } from './pools';
import { users } from './users';
import { testKits } from './test_kits';
import { photos } from './photos';

export const testSessions = pgTable('test_sessions', {
  sessionId: uuid('session_id').primaryKey().defaultRandom(),
  poolId: uuid('pool_id').notNull().references(() => pools.poolId, { onDelete: 'cascade' }),
  testedBy: uuid('tested_by').references(() => users.userId, { onDelete: 'set null' }),
  testedAt: timestamp('tested_at', { withTimezone: true }).notNull().defaultNow(),
  testKitId: uuid('test_kit_id').references(() => testKits.testKitId, { onDelete: 'set null' }),
  photoId: uuid('photo_id').references(() => photos.photoId, { onDelete: 'set null' }),
  freeChlorinePpm: decimal('free_chlorine_ppm', { precision: 4, scale: 2 }),
  totalChlorinePpm: decimal('total_chlorine_ppm', { precision: 4, scale: 2 }),
  phLevel: decimal('ph_level', { precision: 3, scale: 2 }),
  totalAlkalinityPpm: integer('total_alkalinity_ppm'),
  calciumHardnessPpm: integer('calcium_hardness_ppm'),
  cyanuricAcidPpm: integer('cyanuric_acid_ppm'),
  saltPpm: integer('salt_ppm'),
  waterTempF: integer('water_temp_f'),
  orpMv: integer('orp_mv'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
