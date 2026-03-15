CREATE TABLE IF NOT EXISTS vendor_price_import_runs (
  run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES vendors(vendor_id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES users(user_id) ON DELETE SET NULL,
  format varchar(16) NOT NULL,
  dry_run boolean NOT NULL DEFAULT false,
  status varchar(24) NOT NULL,
  imported_rows integer NOT NULL DEFAULT 0,
  created_prices integer NOT NULL DEFAULT 0,
  updated_prices integer NOT NULL DEFAULT 0,
  skipped_rows integer NOT NULL DEFAULT 0,
  row_results jsonb,
  message varchar(500),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vendor_price_import_runs_vendor_idx
  ON vendor_price_import_runs (vendor_id);

CREATE INDEX IF NOT EXISTS vendor_price_import_runs_actor_idx
  ON vendor_price_import_runs (actor_user_id);

CREATE INDEX IF NOT EXISTS vendor_price_import_runs_created_at_idx
  ON vendor_price_import_runs (created_at DESC);
