import {
  pgTable,
  bigserial,
  varchar,
  jsonb,
  integer,
  timestamp,
} from 'drizzle-orm/pg-core';

export const integrationIngestionFailures = pgTable('integration_ingestion_failures', {
  failureId: bigserial('failure_id', { mode: 'number' }).primaryKey(),
  provider: varchar('provider', { length: 64 }).notNull(),
  headers: jsonb('headers').$type<Record<string, string | undefined> | null>().default(null),
  payload: jsonb('payload').$type<Record<string, unknown> | null>().default(null),
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending | resolved | dead
  attempts: integer('attempts').notNull().default(1),
  lastError: varchar('last_error', { length: 1000 }),
  nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
