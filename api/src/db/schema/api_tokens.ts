import { pgTable, uuid, varchar, text, jsonb, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const apiTokens = pgTable('api_tokens', {
  tokenId: uuid('token_id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.userId, { onDelete: 'cascade' }),
  name: varchar('name', { length: 120 }).notNull(),
  tokenHash: text('token_hash').notNull(),
  permissions: jsonb('permissions'),
  rateLimitTier: varchar('rate_limit_tier', { length: 20 }).default('standard'),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  revoked: boolean('revoked').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
