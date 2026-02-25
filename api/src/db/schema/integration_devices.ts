import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { integrations } from './integrations';
import { pools } from './pools';

export const integrationDevices = pgTable(
  'integration_devices',
  {
    deviceId: uuid('device_id').primaryKey().defaultRandom(),
    integrationId: uuid('integration_id')
      .notNull()
      .references(() => integrations.integrationId, { onDelete: 'cascade' }),
    providerDeviceId: varchar('provider_device_id', { length: 120 }).notNull(),
    deviceType: varchar('device_type', { length: 40 }).notNull(),
    label: varchar('label', { length: 120 }),
    poolId: uuid('pool_id').references(() => pools.poolId, { onDelete: 'set null' }),
    status: varchar('status', { length: 24 }).notNull().default('discovered'),
    metadata: jsonb('metadata'),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    providerDeviceUnique: uniqueIndex('integration_devices_integration_provider_device_key').on(
      table.integrationId,
      table.providerDeviceId
    ),
  })
);
