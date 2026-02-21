CREATE TABLE IF NOT EXISTS "pool_equipment" (
  "equipment_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "pool_id" uuid NOT NULL,
  "equipment_type" varchar(24) DEFAULT 'none' NOT NULL,
  "energy_source" varchar(30) DEFAULT 'unknown' NOT NULL,
  "status" varchar(20) DEFAULT 'enabled' NOT NULL,
  "capacity_btu" integer,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pool_equipment_pool_id_key" ON "pool_equipment" ("pool_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pool_temperature_prefs" (
  "pool_id" uuid PRIMARY KEY NOT NULL,
  "preferred_temp_f" numeric(5,2),
  "min_temp_f" numeric(5,2),
  "max_temp_f" numeric(5,2),
  "unit" char(1) DEFAULT 'F' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pool_equipment" ADD CONSTRAINT "pool_equipment_pool_id_pools_pool_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."pools"("pool_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pool_temperature_prefs" ADD CONSTRAINT "pool_temperature_prefs_pool_id_pools_pool_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."pools"("pool_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
