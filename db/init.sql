-- ============================================================================
-- H2Own schema: merged additions for membership, tokens, kits/photos, rec status,
-- costs, notifications, audit, device telemetry, and minor test_session upgrades.
-- Target: PostgreSQL, UUIDs via pgcrypto.
-- ============================================================================

-- Ensure pgcrypto for UUIDs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
  END IF;
END$$;

-- --------------------------------------------------------------------------
-- A) Per-pool membership (RBAC at pool level)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pool_members (
  pool_id UUID NOT NULL REFERENCES pools(pool_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  role_name VARCHAR(24) NOT NULL DEFAULT 'viewer',  -- viewer|editor|owner|service_tech|admin
  permissions JSONB,                                -- optional granular overrides
  invited_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_access_at TIMESTAMPTZ,
  CONSTRAINT pool_members_pk PRIMARY KEY (pool_id, user_id),
  CONSTRAINT chk_pool_role CHECK (role_name ~ '^[a-z_]+$')
);

-- --------------------------------------------------------------------------
-- B) API tokens (personal access tokens for integrations/CLI)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_tokens (
  token_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  token_hash TEXT NOT NULL,                 -- store only a hash
  permissions JSONB,                        -- e.g., {"scopes":["read:tests","write:pools"]}
  rate_limit_tier VARCHAR(20) DEFAULT 'standard',
  last_used_at TIMESTAMPTZ,
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_tokens_user ON api_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_api_tokens_revoked ON api_tokens(revoked);

-- --------------------------------------------------------------------------
-- C) Photos linked to pools/tests/etc. (kept minimal for now)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS photos (
  photo_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID REFERENCES pools(pool_id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  meta JSONB,                 -- EXIF/dimensions
  tags JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- D) Test kits and test_sessions linkage
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS test_kits (
  test_kit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand VARCHAR(80) NOT NULL,
  model VARCHAR(80) NOT NULL,
  test_methods JSONB,                 -- e.g., ["FC","pH","TA"]
  accuracy_rating VARCHAR(20),
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Extend test_sessions with optional kit/photo + computed CC (combined chlorine)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'test_sessions' AND column_name = 'test_kit_id'
  ) THEN
    ALTER TABLE test_sessions
      ADD COLUMN test_kit_id UUID REFERENCES test_kits(test_kit_id) ON DELETE SET NULL,
      ADD COLUMN photo_id UUID REFERENCES photos(photo_id) ON DELETE SET NULL;
  END IF;
END$$;

-- Add combined chlorine as a generated column if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='test_sessions' AND column_name='combined_chlorine_ppm'
  ) THEN
    ALTER TABLE test_sessions
      ADD COLUMN combined_chlorine_ppm DECIMAL(4,2)
      GENERATED ALWAYS AS (COALESCE(total_chlorine_ppm,0) - COALESCE(free_chlorine_ppm,0)) STORED;
  END IF;
END$$;

-- Helpful index for latest tests per pool
CREATE INDEX IF NOT EXISTS idx_test_sessions_pool_time
  ON test_sessions(pool_id, tested_at DESC);

-- --------------------------------------------------------------------------
-- E) Recommendation status + indexes
-- --------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='recommendations' AND column_name='status'
  ) THEN
    ALTER TABLE recommendations
      ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'pending';  -- pending|accepted|rejected|applied|dismissed|expired
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_recommendations_pool_status
  ON recommendations(pool_id, status);
CREATE INDEX IF NOT EXISTS idx_recommendations_priority
  ON recommendations(priority_score DESC);

-- --------------------------------------------------------------------------
-- F) Costs (OPEX) and categories
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cost_categories (
  category_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS costs (
  cost_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES pools(pool_id) ON DELETE CASCADE,
  category_id UUID REFERENCES cost_categories(category_id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL,
  currency CHAR(3) DEFAULT 'USD',
  description TEXT,
  -- Optional links to other entities
  chemical_action_id UUID REFERENCES chemical_actions(action_id) ON DELETE SET NULL,
  maintenance_event_id UUID,         -- future table; placeholder for linkage
  equipment_id UUID,                 -- could point to cleaning_equipment in MVP
  vendor VARCHAR(120),
  receipt_url TEXT,
  incurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_cost_amount_positive CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_costs_pool_time ON costs(pool_id, incurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_costs_category ON costs(category_id);

-- --------------------------------------------------------------------------
-- G) Notifications (templates + sent notifications)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_templates (
  template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  channel VARCHAR(30) NOT NULL,     -- email|push|sms
  subject VARCHAR(200),
  body_template TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  pool_id UUID REFERENCES pools(pool_id) ON DELETE CASCADE,
  template_id UUID REFERENCES notification_templates(template_id) ON DELETE SET NULL,
  channel VARCHAR(30) NOT NULL,
  title VARCHAR(200),
  message TEXT NOT NULL,
  data JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending|sent|delivered|failed|read
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_status
  ON notifications(user_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_pool
  ON notifications(pool_id);

-- --------------------------------------------------------------------------
-- H) Audit log (immutable business audit; keep system_logs for technical logs)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  audit_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
  pool_id UUID REFERENCES pools(pool_id) ON DELETE SET NULL,
  action VARCHAR(80) NOT NULL,
  entity VARCHAR(80),
  entity_id VARCHAR(120),
  ip_address VARCHAR(45),
  user_agent TEXT,
  session_id VARCHAR(100),
  data JSONB,
  at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_action ON audit_log(user_id, action);
CREATE INDEX IF NOT EXISTS idx_audit_log_pool ON audit_log(pool_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_time ON audit_log(at DESC);

-- --------------------------------------------------------------------------
-- I) Device telemetry (optional; future-proof)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS devices (
  device_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES pools(pool_id) ON DELETE CASCADE,
  device_type VARCHAR(40) NOT NULL,          -- ph|orp|temp|tds|level|flow|...
  vendor VARCHAR(120),
  model VARCHAR(120),
  address VARCHAR(255),
  calibration JSONB,
  firmware_version VARCHAR(50),
  battery_level INTEGER,
  signal_strength INTEGER,
  is_online BOOLEAN DEFAULT TRUE,
  alerts_enabled BOOLEAN DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devices_pool_type ON devices(pool_id, device_type);
CREATE INDEX IF NOT EXISTS idx_devices_online ON devices(is_online);

CREATE TABLE IF NOT EXISTS device_readings (
  reading_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  device_id UUID NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metric VARCHAR(40) NOT NULL,
  value NUMERIC(12,4) NOT NULL,
  unit VARCHAR(16),
  quality INTEGER,
  calibrated BOOLEAN DEFAULT TRUE,
  battery_voltage NUMERIC(4,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_readings_device_time ON device_readings(device_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_device_readings_metric ON device_readings(metric);

-- Seed product categories
INSERT INTO product_categories (name, description) VALUES
  ('sanitizers', 'Primary disinfection chemicals'),
  ('balancers', 'pH and alkalinity adjustments'),
  ('shock', 'High-dose sanitizing treatments')
ON CONFLICT DO NOTHING;

-- Seed a few products
INSERT INTO products (
  category_id, brand, name, product_type, active_ingredients, concentration_percent,
  ph_effect, strength_factor, dose_per_10k_gallons, dose_unit,
  affects_fc, affects_ph, affects_ta, affects_cya,
  fc_change_per_dose, ph_change_per_dose, ta_change_per_dose, cya_change_per_dose,
  form, package_sizes, is_active, average_cost_per_unit
)
SELECT c.category_id, 'Generic', 'Liquid Chlorine 12.5%', 'liquid_chlorine',
       '{"sodium_hypochlorite":12.5}'::jsonb, 12.5,
       0.1, 1.0, 10.0, 'oz_fl',
       TRUE, TRUE, FALSE, FALSE,
       0.5, 0.05, 0, 0,
       'liquid', '["1 gal","2.5 gal"]'::jsonb, TRUE, 4.50
FROM product_categories c WHERE c.name='sanitizers'
ON CONFLICT DO NOTHING;

INSERT INTO products (
  category_id, brand, name, product_type, active_ingredients, concentration_percent,
  ph_effect, strength_factor, dose_per_10k_gallons, dose_unit,
  affects_fc, affects_ph, affects_ta, affects_cya,
  fc_change_per_dose, ph_change_per_dose, ta_change_per_dose,
  form, package_sizes, is_active, average_cost_per_unit
)
SELECT c.category_id, 'Generic', 'Muriatic Acid 31.45%', 'muriatic_acid',
       '{"hydrochloric_acid":31.45}'::jsonb, 31.45,
       -0.8, 1.0, 8.0, 'oz_fl',
       FALSE, TRUE, TRUE, FALSE,
       0, -0.4, -10,
       'liquid', '["1 gal"]'::jsonb, TRUE, 8.50
FROM product_categories c WHERE c.name='balancers'
ON CONFLICT DO NOTHING;
