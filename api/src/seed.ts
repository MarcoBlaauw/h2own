// api/src/seed.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql, eq } from 'drizzle-orm';
import postgres from 'postgres';
import argon2 from 'argon2';
import * as schema from './db/schema/index.js';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://h2own:h2own@postgres:5432/h2own';

const client = postgres(DATABASE_URL, { max: 1 });
const db = drizzle(client, { schema });

async function ensureUser(email: string, password: string, name: string, role: string = 'member') {
  const hash = await argon2.hash(password, { type: argon2.argon2id });

  // Try insert; on email conflict, do nothing then fetch existing
  const inserted = await db
    .insert(schema.users)
    .values({
      email,
      passwordHash: hash,
      name,
      isActive: true,
      emailVerified: true, // helpful for dev
      role,
    })
    .onConflictDoNothing({ target: schema.users.email })
    .returning({ userId: schema.users.userId });

  if (inserted.length) return { userId: inserted[0].userId, created: true };

  const existing = await db
    .select({ userId: schema.users.userId, role: schema.users.role })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  const user = existing[0];

  if (user && user.role !== role) {
    await db
      .update(schema.users)
      .set({ role })
      .where(eq(schema.users.userId, user.userId));
  }

  return { userId: user?.userId, created: false };
}

async function seed() {
  console.log('🌱 Seeding database...');

  try {
    // --- Users ---------------------------------------------------------------
    console.log('👤 Seeding dev users…');
    const u1 = await ensureUser('testuser1@example.com', 'password123', 'Test User 1', 'admin');
    const u2 = await ensureUser('testuser2@example.com', 'password123', 'Test User 2', 'member');
    console.log(
      `✅ Users ready: user1=${u1.userId} ${u1.created ? '(created)' : '(exists)'}, ` +
      `user2=${u2.userId} ${u2.created ? '(created)' : '(exists)'}`
    );

    // --- Product categories --------------------------------------------------
    const categories = await db
      .insert(schema.productCategories)
      .values([
        { name: 'sanitizers', description: 'Primary disinfection chemicals' },
        { name: 'balancers', description: 'pH and alkalinity adjustments' },
        { name: 'shock', description: 'High-dose sanitizing treatments' },
      ])
      .onConflictDoNothing()
      .returning();
    console.log(`✅ Inserted ${categories.length} product categories (0 if already present)`);

    const [sanitizers] = await db
      .select()
      .from(schema.productCategories)
      .where(sql`name = 'sanitizers'`);
    const [balancers] = await db
      .select()
      .from(schema.productCategories)
      .where(sql`name = 'balancers'`);

    // --- Products ------------------------------------------------------------
    const products: Array<any> = [];

    if (sanitizers) {
      const chlorine = await db
        .insert(schema.products)
        .values([
          {
            categoryId: sanitizers.categoryId,
            brand: 'Generic',
            name: 'Liquid Chlorine 12.5%',
            productType: 'liquid_chlorine',
            activeIngredients: { sodium_hypochlorite: 12.5 },
            concentrationPercent: '12.5',
            phEffect: '0.1',
            strengthFactor: '1.0',
            dosePer10kGallons: '10.0',
            doseUnit: 'oz_fl',
            affectsFc: true,
            affectsPh: true,
            affectsTa: false,
            affectsCya: false,
            fcChangePerDose: '0.5',
            phChangePerDose: '0.05',
            taChangePerDose: '0',
            cyaChangePerDose: '0',
            form: 'liquid',
            packageSizes: ['1 gal', '2.5 gal'],
            isActive: true,
            averageCostPerUnit: '4.50',
          },
        ])
        .onConflictDoNothing()
        .returning();
      products.push(...chlorine);
    }

    if (balancers) {
      const acid = await db
        .insert(schema.products)
        .values([
          {
            categoryId: balancers.categoryId,
            brand: 'Generic',
            name: 'Muriatic Acid 31.45%',
            productType: 'muriatic_acid',
            activeIngredients: { hydrochloric_acid: 31.45 },
            concentrationPercent: '31.45',
            phEffect: '-0.8',
            strengthFactor: '1.0',
            dosePer10kGallons: '8.0',
            doseUnit: 'oz_fl',
            affectsFc: false,
            affectsPh: true,
            affectsTa: true,
            affectsCya: false,
            fcChangePerDose: '0',
            phChangePerDose: '-0.4',
            taChangePerDose: '-10',
            cyaChangePerDose: '0',
            form: 'liquid',
            packageSizes: ['1 gal'],
            isActive: true,
            averageCostPerUnit: '8.50',
          },
        ])
        .onConflictDoNothing()
        .returning();
      products.push(...acid);
    }

    console.log(`✅ Inserted ${products.length} products (0 if already present)`);
    console.log('✅ Database seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await client.end();
  }
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
