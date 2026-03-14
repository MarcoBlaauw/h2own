CREATE TABLE IF NOT EXISTS "treatment_plans" (
  "plan_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "pool_id" uuid NOT NULL,
  "linked_test_id" uuid,
  "generated_by" uuid,
  "version" integer DEFAULT 1 NOT NULL,
  "status" varchar(24) DEFAULT 'generated' NOT NULL,
  "provider" varchar(24),
  "model_id" varchar(128),
  "prompt_hash" varchar(64) NOT NULL,
  "context_hash" varchar(64) NOT NULL,
  "request_payload" jsonb,
  "response_payload" jsonb,
  "error_message" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "treatment_plans" ADD CONSTRAINT "treatment_plans_pool_id_pools_pool_id_fk"
  FOREIGN KEY ("pool_id") REFERENCES "public"."pools"("pool_id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "treatment_plans" ADD CONSTRAINT "treatment_plans_linked_test_id_test_sessions_session_id_fk"
  FOREIGN KEY ("linked_test_id") REFERENCES "public"."test_sessions"("session_id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "treatment_plans" ADD CONSTRAINT "treatment_plans_generated_by_users_user_id_fk"
  FOREIGN KEY ("generated_by") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "treatment_plans_pool_created_idx" ON "treatment_plans" ("pool_id", "created_at" DESC);
