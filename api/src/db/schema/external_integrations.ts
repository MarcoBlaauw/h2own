import {
  pgTable,
  uuid,
  varchar,
  boolean,
  integer,
  jsonb,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { users } from './users';

export const externalIntegrations = pgTable('external_integrations', {
  integrationId: uuid('integration_id').primaryKey().defaultRandom(),
  provider: varchar('provider', { length: 64 }).notNull().unique(),
  displayName: varchar('display_name', { length: 120 }).notNull(),
  enabled: boolean('enabled').notNull().default(true),
  config: jsonb('config').$type<Record<string, unknown> | null>(),
  credentials: jsonb('credentials').$type<Record<string, unknown> | null>(),
  cacheTtlSeconds: integer('cache_ttl_seconds'),
  rateLimitCooldownSeconds: integer('rate_limit_cooldown_seconds'),
  lastResponseCode: integer('last_response_code'),
  lastResponseText: text('last_response_text'),
  lastResponseAt: timestamp('last_response_at', { withTimezone: true }),
  lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
  nextAllowedRequestAt: timestamp('next_allowed_request_at', { withTimezone: true }),
  updatedBy: uuid('updated_by').references(() => users.userId, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
