// api/src/seed.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql, eq, and } from 'drizzle-orm';
import postgres from 'postgres';
import argon2 from 'argon2';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import dotenv from 'dotenv';
import * as schema from './db/schema/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '..', '.env') });

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

async function ensureChemical(values: typeof schema.products.$inferInsert) {
  const normalizedName = values.name.trim();
  const normalizedBrand = values.brand?.trim() ?? '';
  const normalizedProductType = values.productType?.trim() ?? '';

  const existing = await db
    .select()
    .from(schema.products)
    .where(
      and(
        eq(schema.products.categoryId, values.categoryId),
        sql`lower(trim(${schema.products.name})) = lower(trim(${normalizedName}))`,
        sql`lower(trim(coalesce(${schema.products.brand}, ''))) = lower(trim(${normalizedBrand}))`,
        sql`lower(trim(coalesce(${schema.products.productType}, ''))) = lower(trim(${normalizedProductType}))`
      )
    )
    .limit(1);

  if (existing[0]) {
    return { product: existing[0], created: false };
  }

  const [created] = await db.insert(schema.products).values(values).returning();
  return { product: created, created: true };
}

async function ensureVendor(values: typeof schema.vendors.$inferInsert) {
  const [existing] = await db
    .select()
    .from(schema.vendors)
    .where(eq(schema.vendors.slug, values.slug))
    .limit(1);

  if (existing) {
    return existing;
  }

  const [created] = await db.insert(schema.vendors).values(values).returning();
  return created;
}

async function ensureVendorPrice(values: typeof schema.productVendorPrices.$inferInsert) {
  const [existing] = await db
    .select()
    .from(schema.productVendorPrices)
    .where(
      and(
        eq(schema.productVendorPrices.productId, values.productId),
        eq(schema.productVendorPrices.vendorId, values.vendorId),
      ),
    )
    .limit(1);

  if (existing) {
    return existing;
  }

  const [created] = await db.insert(schema.productVendorPrices).values(values).returning();
  return created;
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
        { name: 'filter_media', description: 'Filters, cartridges, grids, and related supplies' },
        { name: 'cleaning_tools', description: 'Nets, brushes, poles, hoses, and cleaning tools' },
        { name: 'testing_supplies', description: 'Test strips, reagents, and test consumables' },
        { name: 'replacement_parts', description: 'Baskets, seals, and cleaner replacement parts' },
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
    const [filterMedia] = await db
      .select()
      .from(schema.productCategories)
      .where(sql`name = 'filter_media'`);
    const [cleaningTools] = await db
      .select()
      .from(schema.productCategories)
      .where(sql`name = 'cleaning_tools'`);

    // --- Products ------------------------------------------------------------
    const products: Array<any> = [];

    if (sanitizers) {
      const chlorine = await ensureChemical({
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
        } as any);
      products.push(chlorine.product);
    }

    if (balancers) {
      const acid = await ensureChemical({
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
        } as any);
      products.push(acid.product);

      const championAcid = await ensureChemical({
        categoryId: balancers.categoryId,
        brand: 'Champion',
        name: 'Champion Muriatic Acid',
        productType: 'muriatic_acid',
        activeIngredients: { hydrochloric_acid: 31.45, water: 68.55 },
        concentrationPercent: '31.45',
        phEffect: '-0.80',
        strengthFactor: '1.00',
        dosePer10kGallons: '8.00',
        doseUnit: 'oz_fl',
        affectsFc: false,
        affectsPh: true,
        affectsTa: true,
        affectsCya: false,
        fcChangePerDose: '0',
        phChangePerDose: '-0.40',
        taChangePerDose: -10,
        cyaChangePerDose: 0,
        form: 'liquid',
        packageSizes: ['1 gal'],
        isActive: true,
        averageCostPerUnit: '8.50',
      } as any);
      products.push(championAcid.product);
    }

    if (filterMedia) {
      const cartridge = await ensureChemical({
        itemClass: 'supply',
        categoryId: filterMedia.categoryId,
        brand: 'Pleatco',
        name: 'Pleatco Filter Cartridge',
        sku: 'PLT-125',
        productType: 'filter_cartridge',
        form: 'cartridge',
        packageSizes: ['1 cartridge'],
        replacementIntervalDays: 180,
        compatibleEquipmentType: 'cartridge_filter',
        notes: 'Generic seeded supply example for filter replacement tracking.',
        isActive: true,
        averageCostPerUnit: '79.00',
      } as any);
      products.push(cartridge.product);
    }

    if (cleaningTools) {
      const brush = await ensureChemical({
        itemClass: 'supply',
        categoryId: cleaningTools.categoryId,
        brand: 'Generic',
        name: '18" Wall Brush',
        sku: 'BRSH-18',
        productType: 'wall_brush',
        form: 'specialty_other',
        packageSizes: ['1 brush'],
        compatibleEquipmentType: 'manual_cleaning',
        notes: 'Generic seeded supply example for non-chemical maintenance inventory.',
        isActive: true,
        averageCostPerUnit: '24.00',
      } as any);
      products.push(brush.product);
    }

    const homeDepot = await ensureVendor({
      name: 'Home Depot',
      slug: 'home-depot',
      websiteUrl: 'https://www.homedepot.com',
      provider: 'manual',
      isActive: true,
    });
    const amazon = await ensureVendor({
      name: 'Amazon',
      slug: 'amazon',
      websiteUrl: 'https://www.amazon.com',
      provider: 'manual',
      isActive: true,
    });
    const leslies = await ensureVendor({
      name: "Leslie's",
      slug: 'leslies',
      websiteUrl: 'https://lesliespool.com',
      provider: 'manual',
      isActive: true,
    });
    const poolSupply = await ensureVendor({
      name: 'Pool Supply',
      slug: 'pool-supply',
      provider: 'manual',
      isActive: true,
    });

    for (const product of products) {
      if (product.name === 'Liquid Chlorine 12.5%') {
        await ensureVendorPrice({
          productId: product.productId,
          vendorId: poolSupply.vendorId,
          unitPrice: '4.50',
          currency: 'USD',
          packageSize: '1 gal',
          unitLabel: 'jug',
          source: 'manual',
          isPrimary: true,
        });
      }

      if (product.name === 'Muriatic Acid 31.45%') {
        await ensureVendorPrice({
          productId: product.productId,
          vendorId: homeDepot.vendorId,
          unitPrice: '8.50',
          currency: 'USD',
          packageSize: '1 gal',
          unitLabel: 'jug',
          source: 'manual',
          isPrimary: true,
        });
      }

      if (product.name === 'Champion Muriatic Acid') {
        await ensureVendorPrice({
          productId: product.productId,
          vendorId: homeDepot.vendorId,
          unitPrice: '19.98',
          currency: 'USD',
          packageSize: '2 x 1 gal',
          unitLabel: '2-pack',
          vendorSku: 'CH518',
          productUrl: 'https://www.homedepot.com/p/Champion-1-Gallon-Muriatic-Acid-2-Pack-CH518/334625012',
          source: 'external',
          isPrimary: false,
        });
        await ensureVendorPrice({
          productId: product.productId,
          vendorId: amazon.vendorId,
          unitPrice: '9.99',
          currency: 'USD',
          packageSize: '1 gal',
          unitLabel: 'jug',
          source: 'manual',
          isPrimary: false,
        });
        await ensureVendorPrice({
          productId: product.productId,
          vendorId: leslies.vendorId,
          unitPrice: '16.99',
          currency: 'USD',
          packageSize: '1 gal',
          unitLabel: 'jug',
          vendorSku: 'CH520',
          productUrl: 'https://lesliespool.com/champion-acidblue-low-fume-muriatic-acid-1-gallon/14258.html',
          source: 'external',
          isPrimary: true,
        });
      }
    }

    console.log(`✅ Ensured ${products.length} products`);
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
