ALTER TABLE products
  ADD COLUMN IF NOT EXISTS item_class varchar(20) NOT NULL DEFAULT 'chemical',
  ADD COLUMN IF NOT EXISTS sku varchar(80),
  ADD COLUMN IF NOT EXISTS replacement_interval_days integer,
  ADD COLUMN IF NOT EXISTS compatible_equipment_type varchar(80),
  ADD COLUMN IF NOT EXISTS notes text;

INSERT INTO product_categories (name, description)
VALUES
  ('filter_media', 'Filters, cartridges, grids, and related filter supplies'),
  ('cleaning_tools', 'Nets, brushes, poles, hoses, and vacuum tools'),
  ('testing_supplies', 'Test strips, reagents, and testing consumables'),
  ('replacement_parts', 'Baskets, seals, cleaner parts, and other maintenance replacements')
ON CONFLICT (name) DO NOTHING;
