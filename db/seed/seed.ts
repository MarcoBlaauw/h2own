import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../../api/src/db/schema';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://h2own:h2own@postgres:5432/h2own';

const client = postgres(DATABASE_URL, { max: 1 });
const db = drizzle(client, { schema });

async function seed() {
  console.log('🌱 Seeding database...');

  // Seed product categories
  await db.insert(schema.productCategories).values([
    { name: 'sanitizers', description: 'Primary disinfection chemicals' },
    { name: 'balancers', description: 'pH and alkalinity adjustments' },
    { name: 'shock', description: 'High-dose sanitizing treatments' },
  ]).onConflictDoNothing();

  // Seed products
  const sanitizers = await db.select().from(schema.productCategories).where({ name: 'sanitizers' });
  if (sanitizers.length > 0) {
    await db.insert(schema.products).values([
      {
        categoryId: sanitizers[0].categoryId,
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
        taChangePerDose: 0,
        cyaChangePerDose: 0,
        form: 'liquid',
        packageSizes: ['1 gal', '2.5 gal'],
        isActive: true,
        averageCostPerUnit: '4.50',
      },
    ]).onConflictDoNothing();
  }

  const balancers = await db.select().from(schema.productCategories).where({ name: 'balancers' });
  if (balancers.length > 0) {
    await db.insert(schema.products).values([
      {
        categoryId: balancers[0].categoryId,
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
        taChangePerDose: -10,
        cyaChangePerDose: 0,
        form: 'liquid',
        packageSizes: ['1 gal'],
        isActive: true,
        averageCostPerUnit: '8.50',
      },
    ]).onConflictDoNothing();
  }

  console.log('✅ Database seeded successfully!');
  process.exit(0);
}

seed().catch((error) => {
  console.error('❌ Error seeding database:', error);
  process.exit(1);
});
