CREATE TABLE IF NOT EXISTS vendors (
  vendor_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(120) NOT NULL,
  slug varchar(80) NOT NULL,
  website_url text,
  provider varchar(80),
  external_metadata jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS vendors_slug_unique ON vendors (slug);

CREATE TABLE IF NOT EXISTS product_vendor_prices (
  price_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES vendors(vendor_id) ON DELETE CASCADE,
  vendor_sku varchar(120),
  product_url text,
  unit_price numeric(10, 2) NOT NULL,
  currency char(3) NOT NULL DEFAULT 'USD',
  package_size varchar(80),
  unit_label varchar(30),
  source varchar(20) NOT NULL DEFAULT 'manual',
  fetched_at timestamptz,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_vendor_prices_product_idx
  ON product_vendor_prices (product_id);

CREATE INDEX IF NOT EXISTS product_vendor_prices_vendor_idx
  ON product_vendor_prices (vendor_id);

ALTER TABLE inventory_stock
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES users(user_id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS preferred_vendor_id uuid REFERENCES vendors(vendor_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS preferred_unit_price numeric(10, 2),
  ADD COLUMN IF NOT EXISTS preferred_currency char(3) DEFAULT 'USD';

ALTER TABLE inventory_transactions
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES users(user_id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS vendor_id uuid REFERENCES vendors(vendor_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unit_price numeric(10, 2),
  ADD COLUMN IF NOT EXISTS currency char(3) DEFAULT 'USD';

UPDATE inventory_stock
SET owner_id = pools.owner_id
FROM pools
WHERE inventory_stock.pool_id = pools.pool_id
  AND inventory_stock.owner_id IS NULL;

UPDATE inventory_transactions
SET owner_id = pools.owner_id
FROM pools
WHERE inventory_transactions.pool_id = pools.pool_id
  AND inventory_transactions.owner_id IS NULL;

DO $$
DECLARE
  mixed_units record;
BEGIN
  SELECT owner_id, product_id
  INTO mixed_units
  FROM inventory_stock
  GROUP BY owner_id, product_id
  HAVING COUNT(DISTINCT unit) > 1
  LIMIT 1;

  IF mixed_units IS NOT NULL THEN
    RAISE EXCEPTION 'inventory_stock contains mixed units for owner_id %, product_id %',
      mixed_units.owner_id, mixed_units.product_id;
  END IF;
END $$;

WITH ranked_stock AS (
  SELECT
    stock_id,
    owner_id,
    product_id,
    unit,
    quantity_on_hand,
    reorder_point,
    lead_time_days,
    last_decremented_at,
    created_at,
    updated_at,
    FIRST_VALUE(stock_id) OVER (
      PARTITION BY owner_id, product_id
      ORDER BY created_at ASC, stock_id ASC
    ) AS canonical_stock_id,
    ROW_NUMBER() OVER (
      PARTITION BY owner_id, product_id
      ORDER BY created_at ASC, stock_id ASC
    ) AS duplicate_rank
  FROM inventory_stock
),
stock_aggregate AS (
  SELECT
    canonical_stock_id,
    SUM(quantity_on_hand) AS quantity_on_hand,
    MAX(reorder_point) AS reorder_point,
    MAX(lead_time_days) AS lead_time_days,
    MAX(last_decremented_at) AS last_decremented_at,
    MAX(updated_at) AS updated_at
  FROM ranked_stock
  GROUP BY canonical_stock_id
),
duplicate_stock AS (
  SELECT stock_id, canonical_stock_id
  FROM ranked_stock
  WHERE duplicate_rank > 1
)
UPDATE inventory_transactions
SET stock_id = duplicate_stock.canonical_stock_id
FROM duplicate_stock
WHERE inventory_transactions.stock_id = duplicate_stock.stock_id;

WITH ranked_stock AS (
  SELECT
    stock_id,
    owner_id,
    product_id,
    quantity_on_hand,
    reorder_point,
    lead_time_days,
    last_decremented_at,
    updated_at,
    FIRST_VALUE(stock_id) OVER (
      PARTITION BY owner_id, product_id
      ORDER BY created_at ASC, stock_id ASC
    ) AS canonical_stock_id,
    ROW_NUMBER() OVER (
      PARTITION BY owner_id, product_id
      ORDER BY created_at ASC, stock_id ASC
    ) AS duplicate_rank
  FROM inventory_stock
),
stock_aggregate AS (
  SELECT
    canonical_stock_id,
    SUM(quantity_on_hand) AS quantity_on_hand,
    MAX(reorder_point) AS reorder_point,
    MAX(lead_time_days) AS lead_time_days,
    MAX(last_decremented_at) AS last_decremented_at,
    MAX(updated_at) AS updated_at
  FROM ranked_stock
  GROUP BY canonical_stock_id
)
UPDATE inventory_stock
SET
  quantity_on_hand = stock_aggregate.quantity_on_hand,
  reorder_point = stock_aggregate.reorder_point,
  lead_time_days = stock_aggregate.lead_time_days,
  last_decremented_at = stock_aggregate.last_decremented_at,
  updated_at = stock_aggregate.updated_at
FROM stock_aggregate
WHERE inventory_stock.stock_id = stock_aggregate.canonical_stock_id;

WITH ranked_stock AS (
  SELECT
    stock_id,
    ROW_NUMBER() OVER (
      PARTITION BY owner_id, product_id
      ORDER BY created_at ASC, stock_id ASC
    ) AS duplicate_rank
  FROM inventory_stock
)
DELETE FROM inventory_stock
USING ranked_stock
WHERE inventory_stock.stock_id = ranked_stock.stock_id
  AND ranked_stock.duplicate_rank > 1;

ALTER TABLE inventory_stock
  ALTER COLUMN owner_id SET NOT NULL;

ALTER TABLE inventory_transactions
  ALTER COLUMN owner_id SET NOT NULL;

ALTER TABLE inventory_stock
  DROP CONSTRAINT IF EXISTS inventory_stock_pool_product_unique;

DROP INDEX IF EXISTS inventory_stock_owner_product_unique;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_stock_owner_product_unique
  ON inventory_stock (owner_id, product_id);

CREATE INDEX IF NOT EXISTS inventory_stock_owner_idx
  ON inventory_stock (owner_id);

CREATE INDEX IF NOT EXISTS inventory_transactions_owner_idx
  ON inventory_transactions (owner_id);

INSERT INTO vendors (name, slug, website_url, provider, is_active)
VALUES
  ('Home Depot', 'home-depot', 'https://www.homedepot.com', 'manual', true),
  ('Amazon', 'amazon', 'https://www.amazon.com', 'manual', true),
  ('Leslie''s', 'leslies', 'https://lesliespool.com', 'manual', true),
  ('Pool Supply', 'pool-supply', NULL, 'manual', true)
ON CONFLICT (slug) DO NOTHING;
