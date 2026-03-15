import { db as dbClient } from '../../db/index.js';
import * as schema from '../../db/schema/index.js';
import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
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

    const conditions = [eq(schema.costs.poolId, poolId)];
    if (options.from) {
      conditions.push(gte(schema.costs.incurredAt, options.from));
    }
    if (options.to) {
      conditions.push(lte(schema.costs.incurredAt, options.to));
    }
    const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions)!;

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

  private async getAccessiblePools(requestingUserId: string, poolId?: string) {
    if (poolId) {
      await this.core.ensurePoolAccess(poolId, requestingUserId);
      const [pool] = await this.db
        .select({
          poolId: schema.pools.poolId,
          ownerId: schema.pools.ownerId,
          name: schema.pools.name,
        })
        .from(schema.pools)
        .where(eq(schema.pools.poolId, poolId))
        .limit(1);

      return pool ? [pool] : [];
    }

    const pools = await this.core.getPools(requestingUserId);
    return pools.map((pool) => ({
      poolId: pool.poolId,
      ownerId: pool.ownerId,
      name: pool.name,
    }));
  }

  async getAccountCosts(
    requestingUserId: string,
    options: { poolId?: string; from?: Date; to?: Date; limit: number },
  ) {
    const accessiblePools = await this.getAccessiblePools(requestingUserId, options.poolId);
    if (!accessiblePools.length) {
      return { items: [], pools: [] };
    }

    const poolIds = accessiblePools.map((pool) => pool.poolId);
    const conditions = [inArray(schema.costs.poolId, poolIds)];
    if (options.from) {
      conditions.push(gte(schema.costs.incurredAt, options.from));
    }
    if (options.to) {
      conditions.push(lte(schema.costs.incurredAt, options.to));
    }

    const items = await this.db
      .select({
        costId: schema.costs.costId,
        poolId: schema.costs.poolId,
        poolName: schema.pools.name,
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
      .leftJoin(schema.pools, eq(schema.costs.poolId, schema.pools.poolId))
      .where(and(...conditions))
      .orderBy(desc(schema.costs.incurredAt), desc(schema.costs.costId))
      .limit(options.limit);

    return { items, pools: accessiblePools };
  }

  async getAccountCostsSummary(
    requestingUserId: string,
    options: { poolId?: string; window: 'week' | 'month' | 'year' },
  ) {
    const accessiblePools = await this.getAccessiblePools(requestingUserId, options.poolId);
    if (!accessiblePools.length) {
      return {
        window: options.window,
        from: new Date(0).toISOString(),
        to: new Date(0).toISOString(),
        total: '0',
        currency: 'USD',
        byCategory: [],
        byPool: [],
        pools: [],
      };
    }

    const poolIds = accessiblePools.map((pool) => pool.poolId);
    const windowDays: Record<typeof options.window, number> = {
      week: 7,
      month: 30,
      year: 365,
    };
    const now = new Date();
    const from = new Date(now.getTime() - windowDays[options.window] * 24 * 60 * 60 * 1000);
    const whereClause = and(
      inArray(schema.costs.poolId, poolIds),
      gte(schema.costs.incurredAt, from),
      lte(schema.costs.incurredAt, now),
    );
    const totalExpr = sql`coalesce(sum(${schema.costs.amount}), 0)`;

    const [totalRow] = await this.db
      .select({ total: totalExpr.as('total') })
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

    const byPool = await this.db
      .select({
        poolId: schema.pools.poolId,
        poolName: schema.pools.name,
        total: totalExpr.as('total'),
      })
      .from(schema.costs)
      .leftJoin(schema.pools, eq(schema.costs.poolId, schema.pools.poolId))
      .where(whereClause)
      .groupBy(schema.pools.poolId, schema.pools.name)
      .orderBy(desc(totalExpr));

    return {
      window: options.window,
      from: from.toISOString(),
      to: now.toISOString(),
      total: (totalRow?.total ?? '0') as string,
      currency: 'USD',
      byCategory,
      byPool,
      pools: accessiblePools,
    };
  }
}

export const poolCostsService = new PoolCostsService();
