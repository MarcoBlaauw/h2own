CREATE TABLE IF NOT EXISTS "integration_ingestion_failures" (
  "failure_id" bigserial PRIMARY KEY NOT NULL,
  "provider" varchar(64) NOT NULL,
  "headers" jsonb DEFAULT null,
  "payload" jsonb DEFAULT null,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "attempts" integer NOT NULL DEFAULT 1,
  "last_error" varchar(1000),
  "next_attempt_at" timestamp with time zone NOT NULL DEFAULT now(),
  "resolved_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
