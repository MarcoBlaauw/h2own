ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS billing_customer_id varchar(128),
  ADD COLUMN IF NOT EXISTS billing_subscription_id varchar(128),
  ADD COLUMN IF NOT EXISTS billing_provider varchar(40),
  ADD COLUMN IF NOT EXISTS billing_payment_status varchar(24) NOT NULL DEFAULT 'unpaid';

CREATE TABLE IF NOT EXISTS inventory_stock (
  stock_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL REFERENCES pools(pool_id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  quantity_on_hand numeric(12,3) NOT NULL DEFAULT 0,
  reorder_point numeric(12,3) NOT NULL DEFAULT 0,
  unit varchar(20) NOT NULL,
  lead_time_days integer NOT NULL DEFAULT 7,
  last_decremented_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_stock_pool_product_unique UNIQUE(pool_id, product_id)
);

CREATE INDEX IF NOT EXISTS inventory_stock_pool_idx ON inventory_stock(pool_id);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  transaction_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL REFERENCES pools(pool_id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  stock_id uuid REFERENCES inventory_stock(stock_id) ON DELETE SET NULL,
  transaction_type varchar(20) NOT NULL,
  quantity_delta numeric(12,3) NOT NULL,
  unit varchar(20) NOT NULL,
  source varchar(50) NOT NULL DEFAULT 'manual',
  chemical_action_id uuid REFERENCES chemical_actions(action_id) ON DELETE SET NULL,
  performed_by uuid REFERENCES users(user_id) ON DELETE SET NULL,
  note text,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inventory_transactions_pool_idx ON inventory_transactions(pool_id);
CREATE INDEX IF NOT EXISTS inventory_transactions_product_idx ON inventory_transactions(product_id);
CREATE INDEX IF NOT EXISTS inventory_transactions_chemical_action_idx ON inventory_transactions(chemical_action_id);
