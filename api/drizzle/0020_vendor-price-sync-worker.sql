CREATE TABLE IF NOT EXISTS vendor_price_sync_runs (
  run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES vendors(vendor_id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES users(user_id) ON DELETE SET NULL,
  trigger_source varchar(20) NOT NULL DEFAULT 'manual',
  status varchar(24) NOT NULL,
  updated_prices integer NOT NULL DEFAULT 0,
  linked_products integer NOT NULL DEFAULT 0,
  message varchar(500),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vendor_price_sync_runs_vendor_idx
  ON vendor_price_sync_runs (vendor_id);

CREATE INDEX IF NOT EXISTS vendor_price_sync_runs_created_at_idx
  ON vendor_price_sync_runs (created_at DESC);
