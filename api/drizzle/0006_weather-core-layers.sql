ALTER TABLE "weather_data" ADD COLUMN IF NOT EXISTS "sunrise_time" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "weather_data" ADD COLUMN IF NOT EXISTS "sunset_time" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "weather_data" ADD COLUMN IF NOT EXISTS "visibility_mi" numeric(5,2);
--> statement-breakpoint
ALTER TABLE "weather_data" ADD COLUMN IF NOT EXISTS "cloud_cover_percent" numeric(5,2);
--> statement-breakpoint
ALTER TABLE "weather_data" ADD COLUMN IF NOT EXISTS "cloud_base_km" numeric(6,2);
--> statement-breakpoint
ALTER TABLE "weather_data" ADD COLUMN IF NOT EXISTS "cloud_ceiling_km" numeric(6,2);
--> statement-breakpoint
ALTER TABLE "weather_data" ADD COLUMN IF NOT EXISTS "temperature_apparent_f" integer;
--> statement-breakpoint
ALTER TABLE "weather_data" ADD COLUMN IF NOT EXISTS "uv_health_concern" integer;
--> statement-breakpoint
ALTER TABLE "weather_data" ADD COLUMN IF NOT EXISTS "ez_heat_stress_index" integer;
--> statement-breakpoint
ALTER TABLE "weather_data" ADD COLUMN IF NOT EXISTS "wind_direction_deg" integer;
--> statement-breakpoint
ALTER TABLE "weather_data" ADD COLUMN IF NOT EXISTS "wind_gust_mph" integer;
