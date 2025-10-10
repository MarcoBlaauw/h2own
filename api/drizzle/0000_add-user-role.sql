CREATE TABLE IF NOT EXISTS "api_tokens" (
	"token_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"token_hash" text NOT NULL,
	"permissions" jsonb,
	"rate_limit_tier" varchar(20) DEFAULT 'standard',
	"last_used_at" timestamp with time zone,
	"revoked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_log" (
	"audit_id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"pool_id" uuid,
	"action" varchar(80) NOT NULL,
	"entity" varchar(80),
	"entity_id" varchar(120),
	"ip_address" varchar(45),
	"user_agent" text,
	"session_id" varchar(100),
	"data" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chemical_actions" (
	"action_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"added_by" uuid,
	"linked_test_id" uuid,
	"amount" numeric(8, 2) NOT NULL,
	"unit" varchar(20) NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reason" text,
	"addition_method" varchar(50),
	"target_effect" jsonb,
	"actual_effect" jsonb,
	"cost" numeric(8, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cost_categories" (
	"category_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(50) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cost_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "costs" (
	"cost_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_id" uuid NOT NULL,
	"category_id" uuid,
	"amount" numeric(10, 2) NOT NULL,
	"currency" char(3) DEFAULT 'USD',
	"description" text,
	"chemical_action_id" uuid,
	"maintenance_event_id" uuid,
	"equipment_id" uuid,
	"vendor" varchar(120),
	"receipt_url" text,
	"incurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "device_readings" (
	"reading_id" bigserial PRIMARY KEY NOT NULL,
	"device_id" uuid NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metric" varchar(40) NOT NULL,
	"value" numeric(12, 4) NOT NULL,
	"unit" varchar(16),
	"quality" integer,
	"calibrated" boolean DEFAULT true,
	"battery_voltage" numeric(4, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "devices" (
	"device_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_id" uuid NOT NULL,
	"device_type" varchar(40) NOT NULL,
	"vendor" varchar(120),
	"model" varchar(120),
	"address" varchar(255),
	"calibration" jsonb,
	"firmware_version" varchar(50),
	"battery_level" integer,
	"signal_strength" integer,
	"is_online" boolean DEFAULT true,
	"alerts_enabled" boolean DEFAULT true,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"user_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"name" varchar(120),
	"role" varchar(24) DEFAULT 'member' NOT NULL,
	"is_active" boolean DEFAULT true,
	"email_verified" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_locations" (
	"location_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"latitude" numeric(10, 8),
	"longitude" numeric(11, 8),
	"timezone" varchar(50) DEFAULT 'UTC',
	"is_primary" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pools" (
	"pool_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"location_id" uuid,
	"name" varchar(120) NOT NULL,
	"volume_gallons" integer NOT NULL,
	"surface_type" varchar(30),
	"sanitizer_type" varchar(30),
	"salt_level_ppm" integer,
	"shade_level" varchar(20),
	"enclosure_type" varchar(20),
	"has_cover" boolean DEFAULT false,
	"pump_gpm" integer,
	"filter_type" varchar(30),
	"has_heater" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pool_members" (
	"pool_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role_name" varchar(24) DEFAULT 'viewer' NOT NULL,
	"permissions" jsonb,
	"invited_by" uuid,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_access_at" timestamp with time zone,
	CONSTRAINT "pool_members_pool_id_user_id_pk" PRIMARY KEY("pool_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "test_sessions" (
	"session_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_id" uuid NOT NULL,
	"tested_by" uuid,
	"tested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"test_kit_id" uuid,
	"photo_id" uuid,
	"free_chlorine_ppm" numeric(4, 2),
	"total_chlorine_ppm" numeric(4, 2),
	"ph_level" numeric(3, 2),
	"total_alkalinity_ppm" integer,
	"calcium_hardness_ppm" integer,
	"cyanuric_acid_ppm" integer,
	"salt_ppm" integer,
	"water_temp_f" integer,
	"orp_mv" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_categories" (
	"category_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(50) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "products" (
	"product_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"brand" varchar(80),
	"name" varchar(120) NOT NULL,
	"product_type" varchar(50),
	"active_ingredients" jsonb,
	"concentration_percent" numeric(5, 2),
	"ph_effect" numeric(3, 2) DEFAULT '0',
	"strength_factor" numeric(4, 2) DEFAULT '1.0',
	"dose_per_10k_gallons" numeric(8, 2),
	"dose_unit" varchar(20),
	"affects_fc" boolean DEFAULT false,
	"affects_ph" boolean DEFAULT false,
	"affects_ta" boolean DEFAULT false,
	"affects_cya" boolean DEFAULT false,
	"fc_change_per_dose" numeric(4, 2) DEFAULT '0',
	"ph_change_per_dose" numeric(4, 2) DEFAULT '0',
	"ta_change_per_dose" integer DEFAULT 0,
	"cya_change_per_dose" integer DEFAULT 0,
	"form" varchar(20),
	"package_sizes" jsonb,
	"is_active" boolean DEFAULT true,
	"average_cost_per_unit" numeric(8, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recommendations" (
	"recommendation_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_id" uuid NOT NULL,
	"created_by" uuid,
	"linked_test_id" uuid,
	"type" varchar(30) NOT NULL,
	"priority_score" integer DEFAULT 5 NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"payload" jsonb,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"confidence_score" numeric(3, 2),
	"factors_considered" jsonb,
	"expires_at" timestamp with time zone,
	"user_action" jsonb,
	"user_feedback" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "prediction_outcomes" (
	"outcome_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recommendation_id" uuid NOT NULL,
	"predicted_values" jsonb NOT NULL,
	"actual_values" jsonb,
	"accuracy_score" numeric(3, 2),
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_templates" (
	"template_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"channel" varchar(30) NOT NULL,
	"subject" varchar(200),
	"body_template" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_templates_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"notification_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"pool_id" uuid,
	"template_id" uuid,
	"channel" varchar(30) NOT NULL,
	"title" varchar(200),
	"message" text NOT NULL,
	"data" jsonb,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "photos" (
	"photo_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_id" uuid,
	"user_id" uuid,
	"url" text NOT NULL,
	"thumbnail_url" text,
	"meta" jsonb,
	"tags" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "test_kits" (
	"test_kit_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand" varchar(80) NOT NULL,
	"model" varchar(80) NOT NULL,
	"test_methods" jsonb,
	"accuracy_rating" varchar(20),
	"notes" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "weather_data" (
	"weather_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"air_temp_f" integer,
	"uv_index" integer,
	"rainfall_in" numeric(4, 2),
	"wind_speed_mph" integer,
	"humidity_percent" integer,
	"pressure_inhg" numeric(5, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_pool_id_pools_pool_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."pools"("pool_id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chemical_actions" ADD CONSTRAINT "chemical_actions_pool_id_pools_pool_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."pools"("pool_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chemical_actions" ADD CONSTRAINT "chemical_actions_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("product_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chemical_actions" ADD CONSTRAINT "chemical_actions_added_by_users_user_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chemical_actions" ADD CONSTRAINT "chemical_actions_linked_test_id_test_sessions_session_id_fk" FOREIGN KEY ("linked_test_id") REFERENCES "public"."test_sessions"("session_id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "costs" ADD CONSTRAINT "costs_pool_id_pools_pool_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."pools"("pool_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "costs" ADD CONSTRAINT "costs_category_id_cost_categories_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."cost_categories"("category_id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "costs" ADD CONSTRAINT "costs_chemical_action_id_chemical_actions_action_id_fk" FOREIGN KEY ("chemical_action_id") REFERENCES "public"."chemical_actions"("action_id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "device_readings" ADD CONSTRAINT "device_readings_device_id_devices_device_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("device_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "devices" ADD CONSTRAINT "devices_pool_id_pools_pool_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."pools"("pool_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_locations" ADD CONSTRAINT "user_locations_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pools" ADD CONSTRAINT "pools_owner_id_users_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pools" ADD CONSTRAINT "pools_location_id_user_locations_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."user_locations"("location_id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pool_members" ADD CONSTRAINT "pool_members_pool_id_pools_pool_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."pools"("pool_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pool_members" ADD CONSTRAINT "pool_members_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pool_members" ADD CONSTRAINT "pool_members_invited_by_users_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "test_sessions" ADD CONSTRAINT "test_sessions_pool_id_pools_pool_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."pools"("pool_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "test_sessions" ADD CONSTRAINT "test_sessions_tested_by_users_user_id_fk" FOREIGN KEY ("tested_by") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "test_sessions" ADD CONSTRAINT "test_sessions_test_kit_id_test_kits_test_kit_id_fk" FOREIGN KEY ("test_kit_id") REFERENCES "public"."test_kits"("test_kit_id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "test_sessions" ADD CONSTRAINT "test_sessions_photo_id_photos_photo_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("photo_id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "products" ADD CONSTRAINT "products_category_id_product_categories_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."product_categories"("category_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_pool_id_pools_pool_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."pools"("pool_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_created_by_users_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_linked_test_id_test_sessions_session_id_fk" FOREIGN KEY ("linked_test_id") REFERENCES "public"."test_sessions"("session_id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prediction_outcomes" ADD CONSTRAINT "prediction_outcomes_recommendation_id_recommendations_recommendation_id_fk" FOREIGN KEY ("recommendation_id") REFERENCES "public"."recommendations"("recommendation_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_pool_id_pools_pool_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."pools"("pool_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_template_id_notification_templates_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."notification_templates"("template_id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "photos" ADD CONSTRAINT "photos_pool_id_pools_pool_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."pools"("pool_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "photos" ADD CONSTRAINT "photos_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "weather_data" ADD CONSTRAINT "weather_data_location_id_user_locations_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."user_locations"("location_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
