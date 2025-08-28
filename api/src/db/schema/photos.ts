import { pgTable, uuid, text, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { pools } from './pools';
import { users } from './users';

export const photos = pgTable('photos', {
  photoId: uuid('photo_id').primaryKey().defaultRandom(),
  poolId: uuid('pool_id').references(() => pools.poolId, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.userId, { onDelete: 'set null' }),
  url: text('url').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  meta: jsonb('meta'),
  tags: jsonb('tags'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
