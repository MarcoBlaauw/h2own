import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).pipe(z.number().int().min(1).max(65535)).default('3001'),
  DATABASE_URL: z.string().url().default('postgres://h2own:h2own@postgres:5432/h2own'),
  SESSION_SECRET: z.string().min(32).default('dev-secret-please-change-in-production'),
  CORS_ORIGIN: z.string().url().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

function parseEnv() {
  const result = envSchema.safeParse(process.env);
  
  if (!result.success) {
    console.error('❌ Invalid environment configuration:');
    console.error(result.error.format());
    process.exit(1);
  }

  return result.data;
}

export const env = parseEnv();

// Log configuration in development
if (env.NODE_ENV === 'development') {
  console.log('🔧 Environment configuration loaded:');
  console.log(`  NODE_ENV: ${env.NODE_ENV}`);
  console.log(`  PORT: ${env.PORT}`);
  console.log(`  DATABASE_URL: ${env.DATABASE_URL.replace(/\/\/.*@/, '//<credentials>@')}`);
  console.log(`  CORS_ORIGIN: ${env.CORS_ORIGIN}`);
  console.log(`  LOG_LEVEL: ${env.LOG_LEVEL}`);
}
