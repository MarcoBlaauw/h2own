CREATE TABLE IF NOT EXISTS "external_integrations" (
  "integration_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider" varchar(64) NOT NULL,
  "display_name" varchar(120) NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "config" jsonb,
  "credentials" jsonb,
  "cache_ttl_seconds" integer,
  "rate_limit_cooldown_seconds" integer,
  "last_response_code" integer,
  "last_response_text" text,
  "last_response_at" timestamp with time zone,
  "last_success_at" timestamp with time zone,
  "next_allowed_request_at" timestamp with time zone,
  "updated_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "external_integrations_provider_unique" UNIQUE("provider")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "external_integrations" ADD CONSTRAINT "external_integrations_updated_by_users_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
INSERT INTO "external_integrations" ("provider", "display_name")
VALUES
  ('tomorrow_io', 'Tomorrow.io'),
  ('google_maps', 'Google Maps'),
  ('captcha', 'CAPTCHA Provider'),
  ('billing', 'Billing Provider'),
  ('govee', 'Govee')
ON CONFLICT ("provider") DO NOTHING;
