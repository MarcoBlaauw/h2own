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

export type UpdateChemicalData = Partial<CreateChemicalData>;

function mapUpdateChemicalData(data: UpdateChemicalData): Partial<ProductInsert> {
  const mapped: Partial<ProductInsert> = {};

  if (data.categoryId !== undefined) mapped.categoryId = data.categoryId;
  if (data.name !== undefined) mapped.name = data.name;
  if (data.brand !== undefined) mapped.brand = data.brand;
  if (data.productType !== undefined) mapped.productType = data.productType;
  if (data.activeIngredients !== undefined) mapped.activeIngredients = data.activeIngredients;
  if (data.concentrationPercent !== undefined)
    mapped.concentrationPercent = toOptionalDecimal(data.concentrationPercent);
  if (data.phEffect !== undefined) mapped.phEffect = toOptionalDecimal(data.phEffect);
  if (data.strengthFactor !== undefined)
    mapped.strengthFactor = toOptionalDecimal(data.strengthFactor);
  if (data.dosePer10kGallons !== undefined)
    mapped.dosePer10kGallons = toOptionalDecimal(data.dosePer10kGallons);
  if (data.doseUnit !== undefined) mapped.doseUnit = data.doseUnit;
  if (data.affectsFc !== undefined) mapped.affectsFc = data.affectsFc;
  if (data.affectsPh !== undefined) mapped.affectsPh = data.affectsPh;
  if (data.affectsTa !== undefined) mapped.affectsTa = data.affectsTa;
  if (data.affectsCya !== undefined) mapped.affectsCya = data.affectsCya;
  if (data.fcChangePerDose !== undefined)
    mapped.fcChangePerDose = toOptionalDecimal(data.fcChangePerDose);
  if (data.phChangePerDose !== undefined)
    mapped.phChangePerDose = toOptionalDecimal(data.phChangePerDose);
  if (data.taChangePerDose !== undefined) mapped.taChangePerDose = data.taChangePerDose;
  if (data.cyaChangePerDose !== undefined) mapped.cyaChangePerDose = data.cyaChangePerDose;
  if (data.form !== undefined) mapped.form = data.form;
  if (data.packageSizes !== undefined) mapped.packageSizes = data.packageSizes;
  if (data.isActive !== undefined) mapped.isActive = data.isActive;
  if (data.averageCostPerUnit !== undefined)
    mapped.averageCostPerUnit = toOptionalDecimal(data.averageCostPerUnit);

  return mapped;
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

  async updateChemical(id: string, data: UpdateChemicalData) {
    const [chemical] = await this.db
      .update(schema.products)
      .set(mapUpdateChemicalData(data))
      .where(eq(schema.products.productId, id))
      .returning();

    return chemical;
  }

  async deleteChemical(id: string) {
    const [chemical] = await this.db
      .delete(schema.products)
      .where(eq(schema.products.productId, id))
      .returning();

    return chemical;
  }

  async listCategories() {
    return this.db
      .select({
        categoryId: schema.productCategories.categoryId,
        name: schema.productCategories.name,
        description: schema.productCategories.description,
        isActive: schema.productCategories.isActive,
      })
      .from(schema.productCategories);
  }
}

export const chemicalsService = new ChemicalsService();
