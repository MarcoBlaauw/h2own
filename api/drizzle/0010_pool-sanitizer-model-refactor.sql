ALTER TABLE "pools"
  ADD COLUMN "chlorine_source" varchar(20);

UPDATE "pools"
SET "sanitizer_type" = 'chlorine',
    "chlorine_source" = 'swg'
WHERE lower(coalesce("sanitizer_type", '')) = 'salt';

UPDATE "pools"
SET "sanitizer_type" = 'chlorine'
WHERE lower(coalesce("sanitizer_type", '')) NOT IN ('chlorine', 'bromine');

UPDATE "pools"
SET "chlorine_source" = 'manual'
WHERE lower(coalesce("sanitizer_type", '')) = 'chlorine'
  AND "chlorine_source" IS NULL;
