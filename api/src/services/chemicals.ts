import { db } from '../db/index.js';
import * as schema from '../db/schema/index.js';
import { ilike, or, eq, and, SQL } from 'drizzle-orm';

export class ChemicalsService {
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
      
      const subQuery = db
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
      return db.select().from(schema.products);
    }

    return db.select().from(schema.products).where(and(...conditions));
  }
}

export const chemicalsService = new ChemicalsService();
