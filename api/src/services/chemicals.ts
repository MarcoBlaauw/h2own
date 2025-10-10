import { ilike, or, eq, and, SQL } from 'drizzle-orm';
import { db as dbClient } from '../db/index.js';
import * as schema from '../db/schema/index.js';

export interface CreateChemicalData {
  categoryId: string;
  name: string;
  brand?: string;
  productType?: string;
  activeIngredients?: Record<string, number>;
  concentrationPercent?: number;
  phEffect?: number;
  strengthFactor?: number;
  dosePer10kGallons?: number;
  doseUnit?: string;
  affectsFc?: boolean;
  affectsPh?: boolean;
  affectsTa?: boolean;
  affectsCya?: boolean;
  fcChangePerDose?: number;
  phChangePerDose?: number;
  taChangePerDose?: number;
  cyaChangePerDose?: number;
  form?: string;
  packageSizes?: string[];
  isActive?: boolean;
  averageCostPerUnit?: number;
}

type ProductInsert = typeof schema.products.$inferInsert;

function toOptionalDecimal(value?: number) {
  if (value === undefined || value === null) return undefined;
  return value.toString();
}

function mapCreateChemicalData(data: CreateChemicalData): ProductInsert {
  return {
    categoryId: data.categoryId,
    name: data.name,
    brand: data.brand,
    productType: data.productType,
    activeIngredients: data.activeIngredients,
    concentrationPercent: toOptionalDecimal(data.concentrationPercent),
    phEffect: toOptionalDecimal(data.phEffect),
    strengthFactor: toOptionalDecimal(data.strengthFactor),
    dosePer10kGallons: toOptionalDecimal(data.dosePer10kGallons),
    doseUnit: data.doseUnit,
    affectsFc: data.affectsFc,
    affectsPh: data.affectsPh,
    affectsTa: data.affectsTa,
    affectsCya: data.affectsCya,
    fcChangePerDose: toOptionalDecimal(data.fcChangePerDose),
    phChangePerDose: toOptionalDecimal(data.phChangePerDose),
    taChangePerDose: data.taChangePerDose,
    cyaChangePerDose: data.cyaChangePerDose,
    form: data.form,
    packageSizes: data.packageSizes,
    isActive: data.isActive,
    averageCostPerUnit: toOptionalDecimal(data.averageCostPerUnit),
  } satisfies ProductInsert;
}

export class ChemicalsService {
  constructor(private readonly db = dbClient) {}

  async getChemicals(query?: string, category?: string) {
    const conditions: SQL[] = [];
    if (query) {
      conditions.push(
        or(
          ilike(schema.products.name, `%${query}%`),
          ilike(schema.products.brand, `%${query}%`),
          ilike(schema.products.productType, `%${query}%`)
        )!
      );
    }

    if (category) {
      const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(category);

      const subQuery = this.db
        .select({ id: schema.productCategories.categoryId })
        .from(schema.productCategories)
        .where(
          isUuid
            ? eq(schema.productCategories.categoryId, category)
            : eq(schema.productCategories.name, category)
        );
      conditions.push(eq(schema.products.categoryId, subQuery));
    }

    if (conditions.length === 0) {
      return this.db.select().from(schema.products);
    }

    return this.db.select().from(schema.products).where(and(...conditions));
  }

  async createChemical(data: CreateChemicalData) {
    const [chemical] = await this.db
      .insert(schema.products)
      .values(mapCreateChemicalData(data))
      .returning();

    return chemical;
  }
}

export const chemicalsService = new ChemicalsService();
