import { z } from "zod";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(65535))
    .default("3001"),
  DATABASE_URL: z
    .string()
    .url()
    .default("postgres://h2own:h2own@postgres:5432/h2own"),
  SESSION_SECRET: z
    .string()
    .min(32)
    .default("dev-secret-please-change-in-production"),
  REDIS_URL: z
    .string()
    .url()
    .default(
      process.env.NODE_ENV === "development"
        ? "redis://localhost:6379"
        : "redis://redis:6379",
    ),
  SESSION_TTL_SECONDS: z
    .string()
    .transform((value) => Number(value))
    .pipe(z.number().int().positive())
    .default(String(60 * 60 * 24 * 7)),
  SESSION_PREFIX: z.string().min(1).default("session"),
  CORS_ORIGIN: z.string().url().default("http://localhost:3000"),
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
  CAPTCHA_PROVIDER: z.enum(["turnstile", "hcaptcha"]).optional(),
  CAPTCHA_SITE_KEY: z.string().optional(),
  CAPTCHA_SECRET: z.string().optional(),
  TOMORROW_API_KEY: z.string().optional(),
  TOMORROW_API_BASE: z.string().url().optional(),
  PHOTO_PUBLIC_BASE_URL: z.string().optional(),
  PHOTO_UPLOAD_BASE_URL: z.string().optional(),
});

function parseEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("❌ Invalid environment configuration:");
    console.error(result.error.format());
    process.exit(1);
  }

  return result.data;
}

export const env = parseEnv();

// Log configuration in development
if (env.NODE_ENV === "development") {
  console.log("🔧 Environment configuration loaded:");
  console.log(`  NODE_ENV: ${env.NODE_ENV}`);
  console.log(`  PORT: ${env.PORT}`);
  console.log(
    `  DATABASE_URL: ${env.DATABASE_URL.replace(/\/\/.*@/, "//<credentials>@")}`,
  );
  console.log(
    `  REDIS_URL: ${env.REDIS_URL.replace(/\/\/.*@/, "//<credentials>@")}`,
  );
  console.log(`  CORS_ORIGIN: ${env.CORS_ORIGIN}`);
  console.log(`  LOG_LEVEL: ${env.LOG_LEVEL}`);
  console.log(`  SESSION_TTL_SECONDS: ${env.SESSION_TTL_SECONDS}`);
  console.log(`  SESSION_PREFIX: ${env.SESSION_PREFIX}`);
  console.log(
    `  TOMORROW_API_BASE: ${env.TOMORROW_API_BASE ?? "https://api.tomorrow.io/v4"}`,
  );
  if (env.PHOTO_PUBLIC_BASE_URL) {
    console.log(`  PHOTO_PUBLIC_BASE_URL: ${env.PHOTO_PUBLIC_BASE_URL}`);
  }
  if (env.PHOTO_UPLOAD_BASE_URL) {
    console.log(`  PHOTO_UPLOAD_BASE_URL: ${env.PHOTO_UPLOAD_BASE_URL}`);
  }
}
