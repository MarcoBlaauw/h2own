WITH ranked_products AS (
  SELECT
    product_id,
    FIRST_VALUE(product_id) OVER (
      PARTITION BY
        category_id,
        lower(trim(name)),
        lower(trim(coalesce(brand, ''))),
        lower(trim(coalesce(product_type, '')))
      ORDER BY created_at ASC, product_id ASC
    ) AS canonical_product_id,
    ROW_NUMBER() OVER (
      PARTITION BY
        category_id,
        lower(trim(name)),
        lower(trim(coalesce(brand, ''))),
        lower(trim(coalesce(product_type, '')))
      ORDER BY created_at ASC, product_id ASC
    ) AS duplicate_rank
  FROM products
),
duplicate_products AS (
  SELECT product_id, canonical_product_id
  FROM ranked_products
  WHERE duplicate_rank > 1
)
UPDATE chemical_actions
SET product_id = duplicate_products.canonical_product_id
FROM duplicate_products
WHERE chemical_actions.product_id = duplicate_products.product_id;

WITH ranked_products AS (
  SELECT
    product_id,
    ROW_NUMBER() OVER (
      PARTITION BY
        category_id,
        lower(trim(name)),
        lower(trim(coalesce(brand, ''))),
        lower(trim(coalesce(product_type, '')))
      ORDER BY created_at ASC, product_id ASC
    ) AS duplicate_rank
  FROM products
)
DELETE FROM products
USING ranked_products
WHERE products.product_id = ranked_products.product_id
  AND ranked_products.duplicate_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS products_canonical_identity_idx
ON products (
  category_id,
  lower(trim(name)),
  lower(trim(coalesce(brand, ''))),
  lower(trim(coalesce(product_type, '')))
);
