import { pgTable, bigserial, uuid, timestamp, varchar, decimal, integer, boolean } from 'drizzle-orm/pg-core';
import { devices } from './devices';

export const deviceReadings = pgTable('device_readings', {
  readingId: bigserial('reading_id', { mode: 'number' }).primaryKey(),
  deviceId: uuid('device_id').notNull().references(() => devices.deviceId, { onDelete: 'cascade' }),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  metric: varchar('metric', { length: 40 }).notNull(),
  value: decimal('value', { precision: 12, scale: 4 }).notNull(),
  unit: varchar('unit', { length: 16 }),
  quality: integer('quality'),
  calibrated: boolean('calibrated').default(true),
  batteryVoltage: decimal('battery_voltage', { precision: 4, scale: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
