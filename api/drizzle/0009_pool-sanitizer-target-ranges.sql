ALTER TABLE "pools"
  ADD COLUMN "sanitizer_target_min_ppm" numeric(4, 2),
  ADD COLUMN "sanitizer_target_max_ppm" numeric(4, 2);
