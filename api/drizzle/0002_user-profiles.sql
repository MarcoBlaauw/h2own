CREATE TABLE IF NOT EXISTS user_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  first_name varchar(80),
  last_name varchar(80),
  nickname varchar(80),
  address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
