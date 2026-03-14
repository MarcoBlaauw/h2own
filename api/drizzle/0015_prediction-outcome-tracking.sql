ALTER TABLE "prediction_outcomes"
  ALTER COLUMN "recommendation_id" DROP NOT NULL;

ALTER TABLE "prediction_outcomes"
  ADD COLUMN IF NOT EXISTS "pool_id" uuid,
  ADD COLUMN IF NOT EXISTS "plan_id" uuid,
  ADD COLUMN IF NOT EXISTS "checkpoint_hours" integer,
  ADD COLUMN IF NOT EXISTS "due_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "status" varchar(24) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "outcome_link" text,
  ADD COLUMN IF NOT EXISTS "observed_issues" text,
  ADD COLUMN IF NOT EXISTS "quality_signal" numeric(3, 2),
  ADD COLUMN IF NOT EXISTS "treatment_type" varchar(64),
  ADD COLUMN IF NOT EXISTS "recommendation_type" varchar(64),
  ADD COLUMN IF NOT EXISTS "created_by" uuid,
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone NOT NULL DEFAULT now();

UPDATE "prediction_outcomes" po
SET "pool_id" = r."pool_id",
    "checkpoint_hours" = coalesce(po."checkpoint_hours", 24),
    "due_at" = coalesce(po."due_at", po."recorded_at")
FROM "recommendations" r
WHERE po."recommendation_id" = r."recommendation_id"
  AND po."pool_id" IS NULL;

ALTER TABLE "prediction_outcomes"
  ALTER COLUMN "pool_id" SET NOT NULL,
  ALTER COLUMN "checkpoint_hours" SET NOT NULL,
  ALTER COLUMN "due_at" SET NOT NULL;

ALTER TABLE "prediction_outcomes" ADD CONSTRAINT "prediction_outcomes_pool_id_pools_pool_id_fk"
  FOREIGN KEY ("pool_id") REFERENCES "public"."pools"("pool_id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "prediction_outcomes" ADD CONSTRAINT "prediction_outcomes_plan_id_treatment_plans_plan_id_fk"
  FOREIGN KEY ("plan_id") REFERENCES "public"."treatment_plans"("plan_id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "prediction_outcomes" ADD CONSTRAINT "prediction_outcomes_created_by_users_user_id_fk"
  FOREIGN KEY ("created_by") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "prediction_outcomes_pool_due_idx" ON "prediction_outcomes" ("pool_id", "due_at");
CREATE INDEX IF NOT EXISTS "prediction_outcomes_plan_idx" ON "prediction_outcomes" ("plan_id");
CREATE INDEX IF NOT EXISTS "prediction_outcomes_treatment_type_idx" ON "prediction_outcomes" ("treatment_type");
