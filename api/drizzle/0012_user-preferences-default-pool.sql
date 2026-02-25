ALTER TABLE "user_preferences"
ADD COLUMN "default_pool_id" uuid
REFERENCES "pools"("pool_id")
ON DELETE SET NULL;
