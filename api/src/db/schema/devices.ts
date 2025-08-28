import { pgTable, uuid, varchar, jsonb, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
import { pools } from './pools';

export const devices = pgTable('devices', {
  deviceId: uuid('device_id').primaryKey().defaultRandom(),
  poolId: uuid('pool_id').notNull().references(() => pools.poolId, { onDelete: 'cascade' }),
  deviceType: varchar('device_type', { length: 40 }).notNull(),
  vendor: varchar('vendor', { length: 120 }),
  model: varchar('model', { length: 120 }),
  address: varchar('address', { length: 255 }),
  calibration: jsonb('calibration'),
  firmwareVersion: varchar('firmware_version', { length: 50 }),
  batteryLevel: integer('battery_level'),
  signalStrength: integer('signal_strength'),
  isOnline: boolean('is_online').default(true),
  alertsEnabled: boolean('alerts_enabled').default(true),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
