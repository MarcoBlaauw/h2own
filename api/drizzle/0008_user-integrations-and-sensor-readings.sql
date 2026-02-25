CREATE TABLE IF NOT EXISTS "integrations" (
  "integration_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "provider" varchar(64) NOT NULL,
  "status" varchar(24) DEFAULT 'connected' NOT NULL,
  "scopes" jsonb,
  "external_account_id" varchar(120),
  "credentials" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "integration_devices" (
  "device_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "integration_id" uuid NOT NULL,
  "provider_device_id" varchar(120) NOT NULL,
  "device_type" varchar(40) NOT NULL,
  "label" varchar(120),
  "pool_id" uuid,
  "status" varchar(24) DEFAULT 'discovered' NOT NULL,
  "metadata" jsonb,
  "last_seen_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sensor_readings" (
  "reading_id" bigserial PRIMARY KEY NOT NULL,
  "pool_id" uuid NOT NULL,
  "integration_id" uuid,
  "device_id" uuid,
  "metric" varchar(40) NOT NULL,
  "value" numeric(12,4) NOT NULL,
  "unit" varchar(16),
  "recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
  "source" varchar(40) DEFAULT 'integration' NOT NULL,
  "quality" integer,
  "raw_payload" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "integrations_user_provider_key" ON "integrations" ("user_id","provider");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "integration_devices_integration_provider_device_key" ON "integration_devices" ("integration_id","provider_device_id");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integrations" ADD CONSTRAINT "integrations_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integration_devices" ADD CONSTRAINT "integration_devices_integration_id_integrations_integration_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("integration_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integration_devices" ADD CONSTRAINT "integration_devices_pool_id_pools_pool_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."pools"("pool_id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sensor_readings" ADD CONSTRAINT "sensor_readings_pool_id_pools_pool_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."pools"("pool_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sensor_readings" ADD CONSTRAINT "sensor_readings_integration_id_integrations_integration_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("integration_id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sensor_readings" ADD CONSTRAINT "sensor_readings_device_id_integration_devices_device_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."integration_devices"("device_id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
