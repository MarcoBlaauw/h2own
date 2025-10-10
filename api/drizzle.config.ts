import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema/**/*.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://h2own:h2own@postgres:5432/h2own',
  },
});
