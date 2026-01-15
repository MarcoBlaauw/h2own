#!/usr/bin/env tsx
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import dotenv from 'dotenv';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import * as schema from '../api/src/db/schema/index.js';
import { generatePassword, hashPassword } from '../api/src/services/passwords.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', 'api', '.env') });

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
    await client`select 1`; // quick connectivity check

    const name = await prompt('Name', true);
    const email = await prompt('Email', true);
    const chosen = await prompt('Password (leave blank to auto-generate)');
    const password = chosen || generatePassword();
    const passwordHash = await hashPassword(password);

    const [existing] = await db
      .select({
        userId: schema.users.userId,
        name: schema.users.name,
      })
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    let userId: string;
    let created = false;

    if (existing) {
      await db
        .update(schema.users)
        .set({
          name: name || existing.name,
          passwordHash,
          role: 'admin',
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(schema.users.userId, existing.userId));
      userId = existing.userId;
    } else {
      const [inserted] = await db
        .insert(schema.users)
        .values({
          email,
          name: name || null,
          passwordHash,
          role: 'admin',
          isActive: true,
          emailVerified: true,
        })
        .returning({ userId: schema.users.userId });

      userId = inserted.userId;
      created = true;
    }

    console.log('');
    console.log(created ? '✅ Admin user created.' : '✅ Existing user elevated to admin.');
    console.log(`   ID: ${userId}`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && (error as any).code === 'ECONNREFUSED') {
      console.error('❌ Could not reach PostgreSQL. Is the database running and is DATABASE_URL correct?');
      console.error(`   Current DATABASE_URL: ${databaseUrl}`);
      console.error('   Try: docker compose up postgres');
    } else {
      console.error('❌ Failed to create admin user:', error instanceof Error ? error.message : error);
    }
    process.exitCode = 1;
  } finally {
    rl.close();
    await client.end();
  }
}

await main();
