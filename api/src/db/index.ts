import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://h2own:h2own@postgres:5432/h2own';

// Create postgres client
const client = postgres(DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

// Create drizzle instance
export const db = drizzle(client);

// Database health check
export async function healthCheck() {
  try {
    const result = await client`SELECT 1 as health`;
    console.log('✅ Database connection successful:', result[0]);
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

// The health check is now called from app.ts to ensure proper startup sequence.
