import { pgTable, uuid, varchar, jsonb, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users';

export const integrations = pgTable(
  'integrations',
  {
    integrationId: uuid('integration_id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.userId, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 64 }).notNull(),
    status: varchar('status', { length: 24 }).notNull().default('connected'),
    scopes: jsonb('scopes'),
    externalAccountId: varchar('external_account_id', { length: 120 }),
    credentials: jsonb('credentials'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userProviderUnique: uniqueIndex('integrations_user_provider_key').on(
      table.userId,
      table.provider
    ),
  })
);
