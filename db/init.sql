-- ============================================================================
-- H2Own Complete Database Schema
-- Target: PostgreSQL, UUIDs via pgcrypto
-- ============================================================================

-- Ensure pgcrypto for UUIDs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
  END IF;
END$$;

-- --------------------------------------------------------------------------
-- Core Tables (in dependency order)
-- --------------------------------------------------------------------------

-- Users table
CREATE TABLE IF NOT EXISTS users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name VARCHAR(120),
  role VARCHAR(24) NOT NULL DEFAULT 'member',
  is_active BOOLEAN DEFAULT TRUE,
  email_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- User locations
CREATE TABLE IF NOT EXISTS user_locations (
  location_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  timezone VARCHAR(50) DEFAULT 'UTC',
  is_primary BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_locations_user ON user_locations(user_id);

-- Pools table
CREATE TABLE IF NOT EXISTS pools (
  pool_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  location_id UUID REFERENCES user_locations(location_id) ON DELETE SET NULL,
  name VARCHAR(120) NOT NULL,
  volume_gallons INTEGER NOT NULL,
  surface_type VARCHAR(30), -- plaster, fiberglass, vinyl, etc.
  sanitizer_type VARCHAR(30), -- salt, chlorine, bromine
  salt_level_ppm INTEGER,
  shade_level VARCHAR(20), -- full, partial, minimal
  enclosure_type VARCHAR(20), -- open, screen, glass
  has_cover BOOLEAN DEFAULT FALSE,
  pump_gpm INTEGER,
  filter_type VARCHAR(30),
  has_heater BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pools_owner ON pools(owner_id);
CREATE INDEX IF NOT EXISTS idx_pools_location ON pools(location_id);

-- Pool membership (RBAC at pool level)
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

-- API tokens
CREATE TABLE IF NOT EXISTS api_tokens (
  token_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  token_hash TEXT NOT NULL,
  permissions JSONB,
  rate_limit_tier VARCHAR(20) DEFAULT 'standard',
  last_used_at TIMESTAMPTZ,
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_tokens_user ON api_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_api_tokens_revoked ON api_tokens(revoked);

-- Test kits
CREATE TABLE IF NOT EXISTS test_kits (
  test_kit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand VARCHAR(80) NOT NULL,
  model VARCHAR(80) NOT NULL,
  test_methods JSONB,
  accuracy_rating VARCHAR(20),
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Photos
CREATE TABLE IF NOT EXISTS photos (
  photo_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID REFERENCES pools(pool_id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  meta JSONB,
  tags JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Test sessions
CREATE TABLE IF NOT EXISTS test_sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES pools(pool_id) ON DELETE CASCADE,
  tested_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
  tested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  test_kit_id UUID REFERENCES test_kits(test_kit_id) ON DELETE SET NULL,
  photo_id UUID REFERENCES photos(photo_id) ON DELETE SET NULL,
  -- Water chemistry readings
  free_chlorine_ppm DECIMAL(4,2),
  total_chlorine_ppm DECIMAL(4,2),
  combined_chlorine_ppm DECIMAL(4,2) GENERATED ALWAYS AS (COALESCE(total_chlorine_ppm,0) - COALESCE(free_chlorine_ppm,0)) STORED,
  ph_level DECIMAL(3,2),
  total_alkalinity_ppm INTEGER,
  calcium_hardness_ppm INTEGER,
  cyanuric_acid_ppm INTEGER,
  salt_ppm INTEGER,
  water_temp_f INTEGER,
  orp_mv INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_test_sessions_pool_time ON test_sessions(pool_id, tested_at DESC);

-- Product categories
CREATE TABLE IF NOT EXISTS product_categories (
  category_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Products (chemicals)
CREATE TABLE IF NOT EXISTS products (
  product_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES product_categories(category_id) ON DELETE CASCADE,
  brand VARCHAR(80),
  name VARCHAR(120) NOT NULL,
  product_type VARCHAR(50),
  active_ingredients JSONB,
  concentration_percent DECIMAL(5,2),
  ph_effect DECIMAL(3,2) DEFAULT 0,
  strength_factor DECIMAL(4,2) DEFAULT 1.0,
  dose_per_10k_gallons DECIMAL(8,2),
  dose_unit VARCHAR(20),
  -- Effects on water chemistry
  affects_fc BOOLEAN DEFAULT FALSE,
  affects_ph BOOLEAN DEFAULT FALSE,
  affects_ta BOOLEAN DEFAULT FALSE,
  affects_cya BOOLEAN DEFAULT FALSE,
  fc_change_per_dose DECIMAL(4,2) DEFAULT 0,
  ph_change_per_dose DECIMAL(4,2) DEFAULT 0,
  ta_change_per_dose INTEGER DEFAULT 0,
  cya_change_per_dose INTEGER DEFAULT 0,
  form VARCHAR(20), -- liquid, powder, tablet
  package_sizes JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  average_cost_per_unit DECIMAL(8,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_type ON products(product_type);

-- Chemical actions (dosing events)
CREATE TABLE IF NOT EXISTS chemical_actions (
  action_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES pools(pool_id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  added_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
  linked_test_id UUID REFERENCES test_sessions(session_id) ON DELETE SET NULL,
  amount DECIMAL(8,2) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT,
  addition_method VARCHAR(50),
  target_effect JSONB,
  actual_effect JSONB,
  cost DECIMAL(8,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chemical_actions_pool ON chemical_actions(pool_id);
CREATE INDEX IF NOT EXISTS idx_chemical_actions_product ON chemical_actions(product_id);

-- Recommendations
CREATE TABLE IF NOT EXISTS recommendations (
  recommendation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES pools(pool_id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
  linked_test_id UUID REFERENCES test_sessions(session_id) ON DELETE SET NULL,
  type VARCHAR(30) NOT NULL, -- chemical_adjustment, maintenance, alert
  priority_score INTEGER NOT NULL DEFAULT 5,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  payload JSONB, -- action details, doses, etc.
  status VARCHAR(16) NOT NULL DEFAULT 'pending', -- pending|accepted|rejected|applied|dismissed|expired
  confidence_score DECIMAL(3,2),
  factors_considered JSONB,
  expires_at TIMESTAMPTZ,
  user_action JSONB, -- what the user actually did
  user_feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recommendations_pool_status ON recommendations(pool_id, status);
CREATE INDEX IF NOT EXISTS idx_recommendations_priority ON recommendations(priority_score DESC);

-- Prediction outcomes (for ML feedback)
CREATE TABLE IF NOT EXISTS prediction_outcomes (
  outcome_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID NOT NULL REFERENCES recommendations(recommendation_id) ON DELETE CASCADE,
  predicted_values JSONB NOT NULL,
  actual_values JSONB,
  accuracy_score DECIMAL(3,2),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cost categories
CREATE TABLE IF NOT EXISTS cost_categories (
  category_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Costs
CREATE TABLE IF NOT EXISTS costs (
  cost_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES pools(pool_id) ON DELETE CASCADE,
  category_id UUID REFERENCES cost_categories(category_id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL,
  currency CHAR(3) DEFAULT 'USD',
  description TEXT,
  chemical_action_id UUID REFERENCES chemical_actions(action_id) ON DELETE SET NULL,
  maintenance_event_id UUID,
  equipment_id UUID,
  vendor VARCHAR(120),
  receipt_url TEXT,
  incurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_cost_amount_positive CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_costs_pool_time ON costs(pool_id, incurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_costs_category ON costs(category_id);

-- Notification templates
CREATE TABLE IF NOT EXISTS notification_templates (
  template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  channel VARCHAR(30) NOT NULL,
  subject VARCHAR(200),
  body_template TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  pool_id UUID REFERENCES pools(pool_id) ON DELETE CASCADE,
  template_id UUID REFERENCES notification_templates(template_id) ON DELETE SET NULL,
  channel VARCHAR(30) NOT NULL,
  title VARCHAR(200),
  message TEXT NOT NULL,
  data JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_status ON notifications(user_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_pool ON notifications(pool_id);

-- Audit log
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

-- Weather data
CREATE TABLE IF NOT EXISTS weather_data (
  weather_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES user_locations(location_id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ NOT NULL,
  air_temp_f INTEGER,
  uv_index INTEGER,
  rainfall_in DECIMAL(4,2),
  wind_speed_mph INTEGER,
  humidity_percent INTEGER,
  pressure_inhg DECIMAL(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weather_location_time ON weather_data(location_id, recorded_at DESC);

-- Devices (optional)
CREATE TABLE IF NOT EXISTS devices (
  device_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES pools(pool_id) ON DELETE CASCADE,
  device_type VARCHAR(40) NOT NULL,
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

-- Device readings
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

-- --------------------------------------------------------------------------
-- Seed Data
-- --------------------------------------------------------------------------

-- Seed product categories
INSERT INTO product_categories (name, description) VALUES
  ('sanitizers', 'Primary disinfection chemicals'),
  ('balancers', 'pH and alkalinity adjustments'),
  ('shock', 'High-dose sanitizing treatments')
ON CONFLICT (name) DO NOTHING;

-- Seed basic products
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

-- Seed cost categories
INSERT INTO cost_categories (name, description) VALUES
  ('chemicals', 'Pool chemical purchases'),
  ('equipment', 'Pool equipment and supplies'),
  ('maintenance', 'Professional maintenance services'),
  ('utilities', 'Electricity, water, gas costs')
ON CONFLICT (name) DO NOTHING;
