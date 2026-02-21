import { pgTable, uuid, timestamp, integer, decimal } from 'drizzle-orm/pg-core';
import { userLocations } from './user_locations';

export const weatherData = pgTable('weather_data', {
  weatherId: uuid('weather_id').primaryKey().defaultRandom(),
  locationId: uuid('location_id').notNull().references(() => userLocations.locationId, { onDelete: 'cascade' }),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),
  sunriseTime: timestamp('sunrise_time', { withTimezone: true }),
  sunsetTime: timestamp('sunset_time', { withTimezone: true }),
  visibilityMi: decimal('visibility_mi', { precision: 5, scale: 2 }),
  cloudCoverPercent: decimal('cloud_cover_percent', { precision: 5, scale: 2 }),
  cloudBaseKm: decimal('cloud_base_km', { precision: 6, scale: 2 }),
  cloudCeilingKm: decimal('cloud_ceiling_km', { precision: 6, scale: 2 }),
  airTempF: integer('air_temp_f'),
  temperatureApparentF: integer('temperature_apparent_f'),
  uvIndex: integer('uv_index'),
  uvHealthConcern: integer('uv_health_concern'),
  ezHeatStressIndex: integer('ez_heat_stress_index'),
  rainfallIn: decimal('rainfall_in', { precision: 4, scale: 2 }),
  windSpeedMph: integer('wind_speed_mph'),
  windDirectionDeg: integer('wind_direction_deg'),
  windGustMph: integer('wind_gust_mph'),
  humidityPercent: integer('humidity_percent'),
  pressureInhg: decimal('pressure_inhg', { precision: 5, scale: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
