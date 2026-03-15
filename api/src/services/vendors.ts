import { and, asc, eq, ne, sql } from 'drizzle-orm';
import { db as dbClient } from '../db/index.js';
import * as schema from '../db/schema/index.js';

export class DuplicateVendorError extends Error {
  constructor(public readonly slug: string) {
    super('Vendor already exists');
    this.name = 'DuplicateVendorError';
  }
}

type VendorCreateData = {
  name: string;
  slug?: string;
  websiteUrl?: string | null;
  provider?: string | null;
  isActive?: boolean;
};

type VendorUpdateData = Partial<VendorCreateData>;

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

const POSTGRES_UNDEFINED_TABLE = '42P01';

function isUndefinedTableError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === POSTGRES_UNDEFINED_TABLE
  );
}

export class VendorsService {
  constructor(private readonly db = dbClient) {}

  async listVendors(options?: { includeInactive?: boolean }) {
    const baseQuery = this.db
      .select({
        vendorId: schema.vendors.vendorId,
        name: schema.vendors.name,
        slug: schema.vendors.slug,
        websiteUrl: schema.vendors.websiteUrl,
        provider: schema.vendors.provider,
        isActive: schema.vendors.isActive,
      })
      .from(schema.vendors);

    if (options?.includeInactive) {
      try {
        return await baseQuery.orderBy(asc(schema.vendors.name));
      } catch (error) {
        if (isUndefinedTableError(error)) return [];
        throw error;
      }
    }

    try {
      return await baseQuery.where(eq(schema.vendors.isActive, true)).orderBy(asc(schema.vendors.name));
    } catch (error) {
      if (isUndefinedTableError(error)) return [];
      throw error;
    }
  }

  private async ensureUniqueSlug(slug: string, excludeVendorId?: string) {
    const conditions = [sql`lower(${schema.vendors.slug}) = lower(${slug})`];
    if (excludeVendorId) {
      conditions.push(ne(schema.vendors.vendorId, excludeVendorId));
    }

    const [existing] = await this.db
      .select({ vendorId: schema.vendors.vendorId })
      .from(schema.vendors)
      .where(and(...conditions))
      .limit(1);

    if (existing) {
      throw new DuplicateVendorError(slug);
    }
  }

  async createVendor(data: VendorCreateData) {
    const slug = slugify(data.slug?.trim() || data.name);
    await this.ensureUniqueSlug(slug);

    const [vendor] = await this.db
      .insert(schema.vendors)
      .values({
        name: data.name.trim(),
        slug,
        websiteUrl: data.websiteUrl?.trim() || null,
        provider: data.provider?.trim() || null,
        isActive: data.isActive ?? true,
      })
      .returning();

    return vendor;
  }

  async updateVendor(vendorId: string, data: VendorUpdateData) {
    const [existing] = await this.db
      .select()
      .from(schema.vendors)
      .where(eq(schema.vendors.vendorId, vendorId))
      .limit(1);

    if (!existing) {
      return null;
    }

    const nextSlug = data.slug !== undefined || data.name !== undefined
      ? slugify(data.slug?.trim() || data.name?.trim() || existing.slug)
      : existing.slug;

    await this.ensureUniqueSlug(nextSlug, vendorId);

    const [vendor] = await this.db
      .update(schema.vendors)
      .set({
        name: data.name?.trim() || existing.name,
        slug: nextSlug,
        websiteUrl:
          data.websiteUrl === undefined
            ? existing.websiteUrl
            : data.websiteUrl?.trim() || null,
        provider:
          data.provider === undefined
            ? existing.provider
            : data.provider?.trim() || null,
        isActive: data.isActive ?? existing.isActive,
        updatedAt: new Date(),
      })
      .where(eq(schema.vendors.vendorId, vendorId))
      .returning();

    return vendor;
  }
}

export const vendorsService = new VendorsService();
