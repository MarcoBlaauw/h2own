CREATE TABLE IF NOT EXISTS user_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  theme varchar(16) NOT NULL DEFAULT 'light',
  temperature_unit char(1) NOT NULL DEFAULT 'F',
  measurement_system varchar(16) NOT NULL DEFAULT 'imperial',
  currency char(3) NOT NULL DEFAULT 'USD',
  preferred_pool_temp numeric(5,2),
  notification_email_enabled boolean NOT NULL DEFAULT true,
  notification_sms_enabled boolean NOT NULL DEFAULT false,
  notification_push_enabled boolean NOT NULL DEFAULT false,
  notification_email_address varchar(255),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
