import {
  pgTable,
  bigserial,
  uuid,
  timestamp,
  varchar,
  decimal,
  integer,
  jsonb,
} from 'drizzle-orm/pg-core';
import { pools } from './pools';
import { integrations } from './integrations';
import { integrationDevices } from './integration_devices';

export const sensorReadings = pgTable('sensor_readings', {
  readingId: bigserial('reading_id', { mode: 'number' }).primaryKey(),
  poolId: uuid('pool_id')
    .notNull()
    .references(() => pools.poolId, { onDelete: 'cascade' }),
  integrationId: uuid('integration_id').references(() => integrations.integrationId, {
    onDelete: 'set null',
  }),
  deviceId: uuid('device_id').references(() => integrationDevices.deviceId, {
    onDelete: 'set null',
  }),
  metric: varchar('metric', { length: 40 }).notNull(),
  value: decimal('value', { precision: 12, scale: 4 }).notNull(),
  unit: varchar('unit', { length: 16 }),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  source: varchar('source', { length: 40 }).notNull().default('integration'),
  quality: integer('quality'),
  rawPayload: jsonb('raw_payload'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
