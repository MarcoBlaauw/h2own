ALTER TABLE user_locations
  ADD COLUMN IF NOT EXISTS formatted_address VARCHAR(255),
  ADD COLUMN IF NOT EXISTS google_place_id VARCHAR(191),
  ADD COLUMN IF NOT EXISTS google_plus_code VARCHAR(32);
