#!/usr/bin/env tsx
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import dotenv from 'dotenv';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import * as schema from '../src/db/schema/index.js';
import { generatePassword, hashPassword } from '../src/services/passwords.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const rl = createInterface({ input, output, terminal: true });

async function prompt(label: string, required = false) {
  while (true) {
    const answer = (await rl.question(`${label}: `)).trim();

    if (answer || !required) {
      return answer;
    }

    console.log('Value required. Please try again.');
  }
}

async function main() {
  const databaseUrl =
    process.env.DATABASE_URL ?? 'postgres://h2own:h2own@localhost:5432/h2own';
  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client, { schema });

  try {
    await client`select 1`; // ensure connectivity

    const email = await prompt('Email', true);
    const chosen = await prompt('New password (leave blank to auto-generate)');
    const password = chosen || generatePassword();

    const [user] = await db
      .select({
        userId: schema.users.userId,
        name: schema.users.name,
      })
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    if (!user) {
      console.error(`❌ No user found for email ${email}`);
      process.exitCode = 1;
      return;
    }

    const passwordHash = await hashPassword(password);

    await db
      .update(schema.users)
      .set({
        passwordHash,
        updatedAt: new Date(),
        isActive: true,
      })
      .where(eq(schema.users.userId, user.userId));

    console.log('');
    console.log('✅ Password updated successfully.');
    console.log(`   ID: ${user.userId}`);
    console.log(`   Email: ${email}`);
    if (user.name) {
      console.log(`   Name: ${user.name}`);
    }
    console.log(`   Password: ${password}`);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && (error as any).code === 'ECONNREFUSED') {
      console.error('❌ Could not reach PostgreSQL. Is the database running and is DATABASE_URL correct?');
      console.error(`   Current DATABASE_URL: ${databaseUrl}`);
      console.error('   Try: docker compose up postgres');
    } else {
      console.error('❌ Failed to update password:', error instanceof Error ? error.message : error);
    }
    process.exitCode = 1;
  } finally {
    rl.close();
    await client.end();
  }
}

await main();
