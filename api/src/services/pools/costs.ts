import { db as dbClient } from '../../db/index.js';
import * as schema from '../../db/schema/index.js';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { PoolCoreService } from './core.js';

export interface CreateCostData {
  categoryId?: string;
  amount: number;
  currency?: string;
  description?: string;
  chemicalActionId?: string;
  maintenanceEventId?: string;
  equipmentId?: string;
  vendor?: string;
  receiptUrl?: string;
  incurredAt?: string;
}

export class PoolCostsService {
  constructor(
    private readonly db = dbClient,
    private readonly core: PoolCoreService = new PoolCoreService(db)
  ) {}

  async createCost(poolId: string, userId: string, data: CreateCostData) {
    await this.core.ensurePoolAccess(poolId, userId);

    if (data.categoryId) {
      const [category] = await this.db
        .select({ categoryId: schema.costCategories.categoryId })
        .from(schema.costCategories)
        .where(eq(schema.costCategories.categoryId, data.categoryId));

      if (!category) {
        throw new Error('Cost category not found');
      }
    }

    if (data.chemicalActionId) {
      const [action] = await this.db
        .select({ poolId: schema.chemicalActions.poolId })
        .from(schema.chemicalActions)
        .where(eq(schema.chemicalActions.actionId, data.chemicalActionId));

      if (!action) {
        throw new Error('Chemical action not found');
      }

      if (action.poolId !== poolId) {
        throw new Error('Chemical action does not belong to this pool');
      }
    }

    const dbData = {
      poolId,
      categoryId: data.categoryId,
      amount: data.amount.toString(),
      currency: data.currency,
      description: data.description,
      chemicalActionId: data.chemicalActionId,
      maintenanceEventId: data.maintenanceEventId,
      equipmentId: data.equipmentId,
      vendor: data.vendor,
      receiptUrl: data.receiptUrl,
      incurredAt: data.incurredAt ? new Date(data.incurredAt) : undefined,
    };

    const [cost] = await this.db.insert(schema.costs).values(dbData).returning();

    return cost;
  }

  async getCostsByPoolId(
    poolId: string,
    requestingUserId: string,
    options: { from?: Date; to?: Date; limit: number }
  ) {
    await this.core.ensurePoolAccess(poolId, requestingUserId);

    let whereClause = eq(schema.costs.poolId, poolId);

    if (options.from) {
      whereClause = and(whereClause, gte(schema.costs.incurredAt, options.from));
    }

    if (options.to) {
      whereClause = and(whereClause, lte(schema.costs.incurredAt, options.to));
    }

    const items = await this.db
      .select({
        costId: schema.costs.costId,
        amount: schema.costs.amount,
        currency: schema.costs.currency,
        categoryId: schema.costs.categoryId,
        categoryName: schema.costCategories.name,
        incurredAt: schema.costs.incurredAt,
        description: schema.costs.description,
        vendor: schema.costs.vendor,
        chemicalActionId: schema.costs.chemicalActionId,
        receiptUrl: schema.costs.receiptUrl,
      })
      .from(schema.costs)
      .leftJoin(schema.costCategories, eq(schema.costs.categoryId, schema.costCategories.categoryId))
      .where(whereClause)
      .orderBy(desc(schema.costs.incurredAt), desc(schema.costs.costId))
      .limit(options.limit);

    return { items };
  }

  async getCostsSummary(poolId: string, requestingUserId: string, window: 'week' | 'month' | 'year') {
    await this.core.ensurePoolAccess(poolId, requestingUserId);

    const windowDays: Record<typeof window, number> = {
      week: 7,
      month: 30,
      year: 365,
    };

    const now = new Date();
    const from = new Date(now.getTime() - windowDays[window] * 24 * 60 * 60 * 1000);

    const whereClause = and(
      eq(schema.costs.poolId, poolId),
      gte(schema.costs.incurredAt, from),
      lte(schema.costs.incurredAt, now)
    );

    const totalExpr = sql`coalesce(sum(${schema.costs.amount}), 0)`;

    const [totalRow] = await this.db
      .select({
        total: totalExpr.as('total'),
      })
      .from(schema.costs)
      .where(whereClause);

    const byCategory = await this.db
      .select({
        categoryId: schema.costCategories.categoryId,
        categoryName: schema.costCategories.name,
        total: totalExpr.as('total'),
      })
      .from(schema.costs)
      .leftJoin(schema.costCategories, eq(schema.costs.categoryId, schema.costCategories.categoryId))
      .where(whereClause)
      .groupBy(schema.costCategories.categoryId, schema.costCategories.name)
      .orderBy(desc(totalExpr));

    return {
      window,
      from: from.toISOString(),
      to: now.toISOString(),
      total: (totalRow?.total ?? '0') as string,
      currency: 'USD',
      byCategory,
    };
  }
}

export const poolCostsService = new PoolCostsService();
