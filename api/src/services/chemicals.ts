import { and, asc, eq, ilike, inArray, ne, or, SQL, sql } from 'drizzle-orm';
import { db as dbClient } from '../db/index.js';
import * as schema from '../db/schema/index.js';
import { PRODUCT_TYPES_BY_CATEGORY, type ProductItemClass } from './chemical-catalog.js';
import { vendorPriceSyncService } from './vendor-price-sync.js';

type DbLike = typeof dbClient;

export interface ChemicalVendorPriceInput {
  vendorId: string;
  vendorSku?: string;
  productUrl?: string;
  unitPrice: number;
  currency?: string;
  packageSize?: string;
  unitLabel?: string;
  source?: 'manual' | 'external';
  fetchedAt?: string;
  isPrimary?: boolean;
}

export interface CreateChemicalData {
  categoryId: string;
  itemClass?: ProductItemClass;
  name: string;
  brand?: string;
  sku?: string;
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
  replacementIntervalDays?: number;
  compatibleEquipmentType?: string;
  notes?: string;
  isActive?: boolean;
  averageCostPerUnit?: number;
  vendorPrices?: ChemicalVendorPriceInput[];
}

type ProductInsert = typeof schema.products.$inferInsert;
type ProductVendorPriceInsert = typeof schema.productVendorPrices.$inferInsert;
export type UpdateChemicalData = Partial<CreateChemicalData>;

export class DuplicateChemicalError extends Error {
  constructor(public readonly existingChemicalId: string) {
    super('Chemical already exists');
    this.name = 'DuplicateChemicalError';
  }
}

export class InvalidChemicalTypeForCategoryError extends Error {
  constructor(
    public readonly categoryName: string,
    public readonly productType: string,
  ) {
    super('Chemical type is not allowed for this category');
    this.name = 'InvalidChemicalTypeForCategoryError';
  }
}

function toOptionalDecimal(value?: number | null) {
  if (value === undefined || value === null) return undefined;
  return value.toString();
}

function mapCreateChemicalData(data: CreateChemicalData): ProductInsert {
  const primaryVendorPrice = data.vendorPrices?.find((entry) => entry.isPrimary) ?? data.vendorPrices?.[0];
  return {
    categoryId: data.categoryId,
    itemClass: data.itemClass ?? 'chemical',
    name: data.name,
    brand: data.brand,
    sku: data.sku,
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
    replacementIntervalDays: data.replacementIntervalDays,
    compatibleEquipmentType: data.compatibleEquipmentType,
    notes: data.notes,
    isActive: data.isActive,
    averageCostPerUnit: toOptionalDecimal(data.averageCostPerUnit ?? primaryVendorPrice?.unitPrice),
  } satisfies ProductInsert;
}

function mapUpdateChemicalData(data: UpdateChemicalData): Partial<ProductInsert> {
  const mapped: Partial<ProductInsert> = {};

  if (data.categoryId !== undefined) mapped.categoryId = data.categoryId;
  if (data.itemClass !== undefined) mapped.itemClass = data.itemClass;
  if (data.name !== undefined) mapped.name = data.name;
  if (data.brand !== undefined) mapped.brand = data.brand;
  if (data.sku !== undefined) mapped.sku = data.sku;
  if (data.productType !== undefined) mapped.productType = data.productType;
  if (data.activeIngredients !== undefined) mapped.activeIngredients = data.activeIngredients;
  if (data.concentrationPercent !== undefined) {
    mapped.concentrationPercent = toOptionalDecimal(data.concentrationPercent);
  }
  if (data.phEffect !== undefined) mapped.phEffect = toOptionalDecimal(data.phEffect);
  if (data.strengthFactor !== undefined) mapped.strengthFactor = toOptionalDecimal(data.strengthFactor);
  if (data.dosePer10kGallons !== undefined) {
    mapped.dosePer10kGallons = toOptionalDecimal(data.dosePer10kGallons);
  }
  if (data.doseUnit !== undefined) mapped.doseUnit = data.doseUnit;
  if (data.affectsFc !== undefined) mapped.affectsFc = data.affectsFc;
  if (data.affectsPh !== undefined) mapped.affectsPh = data.affectsPh;
  if (data.affectsTa !== undefined) mapped.affectsTa = data.affectsTa;
  if (data.affectsCya !== undefined) mapped.affectsCya = data.affectsCya;
  if (data.fcChangePerDose !== undefined) mapped.fcChangePerDose = toOptionalDecimal(data.fcChangePerDose);
  if (data.phChangePerDose !== undefined) mapped.phChangePerDose = toOptionalDecimal(data.phChangePerDose);
  if (data.taChangePerDose !== undefined) mapped.taChangePerDose = data.taChangePerDose;
  if (data.cyaChangePerDose !== undefined) mapped.cyaChangePerDose = data.cyaChangePerDose;
  if (data.form !== undefined) mapped.form = data.form;
  if (data.packageSizes !== undefined) mapped.packageSizes = data.packageSizes;
  if (data.replacementIntervalDays !== undefined) mapped.replacementIntervalDays = data.replacementIntervalDays;
  if (data.compatibleEquipmentType !== undefined) mapped.compatibleEquipmentType = data.compatibleEquipmentType;
  if (data.notes !== undefined) mapped.notes = data.notes;
  if (data.isActive !== undefined) mapped.isActive = data.isActive;
  if (data.averageCostPerUnit !== undefined) {
    mapped.averageCostPerUnit = toOptionalDecimal(data.averageCostPerUnit);
  }

  return mapped;
}

function mapVendorPriceInput(
  productId: string,
  data: ChemicalVendorPriceInput,
): ProductVendorPriceInsert {
  return {
    productId,
    vendorId: data.vendorId,
    vendorSku: data.vendorSku,
    productUrl: data.productUrl,
    unitPrice: data.unitPrice.toFixed(2),
    currency: (data.currency ?? 'USD').toUpperCase(),
    packageSize: data.packageSize,
    unitLabel: data.unitLabel,
    source: data.source ?? 'manual',
    fetchedAt: data.fetchedAt ? new Date(data.fetchedAt) : null,
    isPrimary: data.isPrimary ?? false,
  } satisfies ProductVendorPriceInsert;
}

type ChemicalIdentity = {
  categoryId: string;
  itemClass?: string | null;
  name: string;
  brand?: string | null;
  productType?: string | null;
};

const normalizeChemicalIdentity = (input: ChemicalIdentity) => ({
  categoryId: input.categoryId,
  itemClass: input.itemClass?.trim() || 'chemical',
  name: input.name.trim(),
  brand: input.brand?.trim() || null,
  productType: input.productType?.trim() || null,
});

type ChemicalRow = typeof schema.products.$inferSelect;
const POSTGRES_UNDEFINED_TABLE = '42P01';

function isUndefinedTableError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === POSTGRES_UNDEFINED_TABLE
  );
}

export class ChemicalsService {
  constructor(private readonly db = dbClient) {}

  private async withTx<T>(
    callback: (tx: DbLike) => Promise<T>,
  ) {
    if (typeof (this.db as { transaction?: unknown }).transaction === 'function') {
      return (this.db as DbLike & { transaction: (cb: (tx: DbLike) => Promise<T>) => Promise<T> }).transaction(
        callback,
      );
    }
    return callback(this.db);
  }

  private async assertProductTypeAllowed(categoryId: string, productType?: string | null) {
    if (!productType) return;

    const [category] = await this.db
      .select({ name: schema.productCategories.name })
      .from(schema.productCategories)
      .where(eq(schema.productCategories.categoryId, categoryId))
      .limit(1);

    const categoryName = category?.name?.trim().toLowerCase();
    if (!categoryName) return;

    const allowedTypes = PRODUCT_TYPES_BY_CATEGORY[
      categoryName as keyof typeof PRODUCT_TYPES_BY_CATEGORY
    ];
    if (!allowedTypes) return;

    if (!(allowedTypes as readonly string[]).includes(productType)) {
      throw new InvalidChemicalTypeForCategoryError(category.name, productType);
    }
  }

  private async findDuplicateChemical(identity: ChemicalIdentity, excludeProductId?: string) {
    const normalized = normalizeChemicalIdentity(identity);
    const conditions: SQL[] = [
      eq(schema.products.categoryId, normalized.categoryId),
      sql`lower(trim(coalesce(${schema.products.itemClass}, 'chemical'))) = lower(trim(${normalized.itemClass}))`,
      sql`lower(trim(${schema.products.name})) = lower(trim(${normalized.name}))`,
      sql`lower(trim(coalesce(${schema.products.brand}, ''))) = lower(trim(${normalized.brand ?? ''}))`,
      sql`lower(trim(coalesce(${schema.products.productType}, ''))) = lower(trim(${normalized.productType ?? ''}))`,
    ];

    if (excludeProductId) {
      conditions.push(ne(schema.products.productId, excludeProductId));
    }

    const [duplicate] = await this.db
      .select({ productId: schema.products.productId })
      .from(schema.products)
      .where(and(...conditions))
      .limit(1);

    return duplicate ?? null;
  }

  private normalizeVendorPrices(entries?: ChemicalVendorPriceInput[]) {
    if (!entries?.length) {
      return [];
    }

    const normalized = entries.map((entry, index) => ({
      ...entry,
      currency: (entry.currency ?? 'USD').toUpperCase(),
      isPrimary: entry.isPrimary ?? index === 0,
    }));

    let seenPrimary = false;
    for (const entry of normalized) {
      if (!entry.isPrimary) continue;
      if (!seenPrimary) {
        seenPrimary = true;
        continue;
      }
      entry.isPrimary = false;
    }
    if (!seenPrimary) {
      normalized[0]!.isPrimary = true;
    }

    return normalized;
  }

  private async replaceVendorPrices(
    tx: DbLike,
    productId: string,
    vendorPrices?: ChemicalVendorPriceInput[],
  ) {
    if (
      typeof (tx as { delete?: unknown }).delete !== 'function' ||
      typeof (tx as { insert?: unknown }).insert !== 'function'
    ) {
      return;
    }
    if (vendorPrices === undefined) {
      return;
    }

    await tx
      .delete(schema.productVendorPrices)
      .where(eq(schema.productVendorPrices.productId, productId));

    const normalized = this.normalizeVendorPrices(vendorPrices);
    if (!normalized.length) {
      return;
    }

    await tx
      .insert(schema.productVendorPrices)
      .values(normalized.map((entry) => mapVendorPriceInput(productId, entry)));
  }

  private async enrichChemicals(rows: ChemicalRow[]) {
    if (!rows.length) {
      return [];
    }

    const selectBuilder = this.db.select({
      productId: schema.productVendorPrices.productId,
      priceId: schema.productVendorPrices.priceId,
      vendorId: schema.productVendorPrices.vendorId,
      vendorName: schema.vendors.name,
      vendorSlug: schema.vendors.slug,
      websiteUrl: schema.vendors.websiteUrl,
      vendorSku: schema.productVendorPrices.vendorSku,
      productUrl: schema.productVendorPrices.productUrl,
      unitPrice: schema.productVendorPrices.unitPrice,
      currency: schema.productVendorPrices.currency,
      packageSize: schema.productVendorPrices.packageSize,
      unitLabel: schema.productVendorPrices.unitLabel,
      source: schema.productVendorPrices.source,
      fetchedAt: schema.productVendorPrices.fetchedAt,
      isPrimary: schema.productVendorPrices.isPrimary,
    });
    if (typeof (selectBuilder as { from?: unknown }).from !== 'function') {
      return rows.map((row) => ({ ...row, primaryVendor: null, primaryPrice: null, vendorPrices: [] }));
    }

    const productIds = rows.map((row) => row.productId);
    const fromBuilder = selectBuilder.from(schema.productVendorPrices);
    if (typeof (fromBuilder as { leftJoin?: unknown }).leftJoin !== 'function') {
      return rows.map((row) => ({ ...row, primaryVendor: null, primaryPrice: null, vendorPrices: [] }));
    }
    let vendorPriceRows: Array<Record<string, any>>;
    try {
      vendorPriceRows = await fromBuilder
        .leftJoin(schema.vendors, eq(schema.productVendorPrices.vendorId, schema.vendors.vendorId))
        .where(inArray(schema.productVendorPrices.productId, productIds))
        .orderBy(
          asc(schema.productVendorPrices.productId),
          sql`${schema.productVendorPrices.isPrimary} desc`,
          asc(schema.vendors.name),
        );
    } catch (error) {
      if (isUndefinedTableError(error)) {
        return rows.map((row) => ({ ...row, primaryVendor: null, primaryPrice: null, vendorPrices: [] }));
      }
      throw error;
    }

    const vendorPricesByProduct = new Map<string, typeof vendorPriceRows>();
    for (const row of vendorPriceRows) {
      const current = vendorPricesByProduct.get(row.productId) ?? [];
      current.push(row);
      vendorPricesByProduct.set(row.productId, current);
    }

    return rows.map((row) => {
      const vendorPrices = vendorPricesByProduct.get(row.productId) ?? [];
      const primaryVendorPrice = vendorPrices.find((entry) => entry.isPrimary) ?? vendorPrices[0] ?? null;

      return {
        ...row,
        primaryVendor: primaryVendorPrice
          ? {
              vendorId: primaryVendorPrice.vendorId,
              name: primaryVendorPrice.vendorName,
              slug: primaryVendorPrice.vendorSlug,
              websiteUrl: primaryVendorPrice.websiteUrl,
            }
          : null,
        primaryPrice: primaryVendorPrice
          ? {
              priceId: primaryVendorPrice.priceId,
              unitPrice: primaryVendorPrice.unitPrice,
              currency: primaryVendorPrice.currency,
              packageSize: primaryVendorPrice.packageSize,
              unitLabel: primaryVendorPrice.unitLabel,
              source: primaryVendorPrice.source,
              fetchedAt: primaryVendorPrice.fetchedAt,
              isStale: vendorPriceSyncService.isPriceStale(primaryVendorPrice.fetchedAt),
            }
          : row.averageCostPerUnit
            ? {
                priceId: null,
                unitPrice: row.averageCostPerUnit,
                currency: 'USD',
                packageSize: null,
                unitLabel: null,
                source: 'manual',
                fetchedAt: null,
                isStale: true,
              }
            : null,
        vendorPrices,
      };
    });
  }

  async getChemicals(query?: string, category?: string) {
    const conditions: SQL[] = [];
    if (query) {
      conditions.push(
        or(
          ilike(schema.products.name, `%${query}%`),
          ilike(schema.products.brand, `%${query}%`),
          ilike(schema.products.sku, `%${query}%`),
          ilike(schema.products.productType, `%${query}%`),
        )!,
      );
    }

    if (category) {
      const isUuid =
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(category);

      const subQuery = this.db
        .select({ id: schema.productCategories.categoryId })
        .from(schema.productCategories)
        .where(
          isUuid
            ? eq(schema.productCategories.categoryId, category)
            : eq(schema.productCategories.name, category),
        );
      conditions.push(eq(schema.products.categoryId, subQuery));
    }

    const rows =
      conditions.length === 0
        ? await this.db.select().from(schema.products)
        : await this.db.select().from(schema.products).where(and(...conditions));

    return this.enrichChemicals(rows);
  }

  async createChemical(data: CreateChemicalData) {
    await this.assertProductTypeAllowed(data.categoryId, data.productType);

    const duplicate = await this.findDuplicateChemical({
      ...data,
      itemClass: data.itemClass ?? 'chemical',
    });
    if (duplicate) {
      throw new DuplicateChemicalError(duplicate.productId);
    }

    const normalizedVendorPrices = this.normalizeVendorPrices(data.vendorPrices);

    return this.withTx(async (tx) => {
      const [chemical] = await tx
        .insert(schema.products)
        .values(mapCreateChemicalData({ ...data, vendorPrices: normalizedVendorPrices }))
        .returning();

      await this.replaceVendorPrices(tx, chemical.productId, normalizedVendorPrices);

      const [enriched] = await this.enrichChemicals([chemical]);
      return enriched;
    });
  }

  async updateChemical(id: string, data: UpdateChemicalData) {
    const [existing] = await this.db
      .select({
        categoryId: schema.products.categoryId,
        itemClass: schema.products.itemClass,
        name: schema.products.name,
        brand: schema.products.brand,
        sku: schema.products.sku,
        productType: schema.products.productType,
      })
      .from(schema.products)
      .where(eq(schema.products.productId, id))
      .limit(1);

    if (!existing) {
      return undefined;
    }

    const duplicate = await this.findDuplicateChemical(
      {
        categoryId: data.categoryId ?? existing.categoryId,
        itemClass: data.itemClass ?? existing.itemClass,
        name: data.name ?? existing.name,
        brand: data.brand ?? existing.brand,
        productType: data.productType ?? existing.productType,
      },
      id,
    );

    if (duplicate) {
      throw new DuplicateChemicalError(duplicate.productId);
    }

    await this.assertProductTypeAllowed(
      data.categoryId ?? existing.categoryId,
      data.productType ?? existing.productType,
    );

    const normalizedVendorPrices =
      data.vendorPrices === undefined ? undefined : this.normalizeVendorPrices(data.vendorPrices);
    const primaryVendorPrice = normalizedVendorPrices?.find((entry) => entry.isPrimary) ?? normalizedVendorPrices?.[0];

    return this.withTx(async (tx) => {
      const [chemical] = await tx
        .update(schema.products)
        .set({
          ...mapUpdateChemicalData(data),
          ...(normalizedVendorPrices
            ? { averageCostPerUnit: toOptionalDecimal(data.averageCostPerUnit ?? primaryVendorPrice?.unitPrice) }
            : {}),
        })
        .where(eq(schema.products.productId, id))
        .returning();

      await this.replaceVendorPrices(tx, id, normalizedVendorPrices);

      const [enriched] = await this.enrichChemicals([chemical]);
      return enriched;
    });
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
