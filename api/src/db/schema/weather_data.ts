import { pgTable, uuid, timestamp, integer, decimal } from 'drizzle-orm/pg-core';
import { userLocations } from './user_locations';

export const weatherData = pgTable('weather_data', {
  weatherId: uuid('weather_id').primaryKey().defaultRandom(),
  locationId: uuid('location_id').notNull().references(() => userLocations.locationId, { onDelete: 'cascade' }),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),
  airTempF: integer('air_temp_f'),
  uvIndex: integer('uv_index'),
  rainfallIn: decimal('rainfall_in', { precision: 4, scale: 2 }),
  windSpeedMph: integer('wind_speed_mph'),
  humidityPercent: integer('humidity_percent'),
  pressureInhg: decimal('pressure_inhg', { precision: 5, scale: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
