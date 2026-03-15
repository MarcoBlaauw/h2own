import { and, asc, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { db as dbClient } from '../db/index.js';
import * as schema from '../db/schema/index.js';
import { PoolCoreService } from './pools/core.js';
import { vendorPriceSyncService } from './vendor-price-sync.js';

type InventoryScope = {
  ownerIds: string[];
  pools: Array<{ poolId: string; ownerId: string; name: string }>;
  selectedPoolId: string | null;
  selectedOwnerId: string | null;
};

export class InventoryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InventoryValidationError';
  }
}

export class InventoryService {
  constructor(
    private readonly db = dbClient,
    private readonly poolCore: PoolCoreService = new PoolCoreService(db),
  ) {}

  private async getAccessiblePools(userId: string) {
    const pools = await this.poolCore.getPools(userId);
    return pools.map((pool) => ({
      poolId: pool.poolId,
      ownerId: pool.ownerId,
      name: pool.name,
    }));
  }

  private async resolveScope(
    userId: string,
    options?: { poolId?: string; ownerId?: string },
  ): Promise<InventoryScope> {
    const pools = await this.getAccessiblePools(userId);
    if (!pools.length) {
      return {
        ownerIds: [],
        pools: [],
        selectedPoolId: null,
        selectedOwnerId: null,
      };
    }

    if (options?.poolId) {
      await this.poolCore.ensurePoolAccess(options.poolId, userId);
      const selectedPool = pools.find((pool) => pool.poolId === options.poolId);
      if (!selectedPool) {
        throw new InventoryValidationError('Pool is not available in inventory scope.');
      }
      return {
        ownerIds: [selectedPool.ownerId],
        pools: pools.filter((pool) => pool.ownerId === selectedPool.ownerId),
        selectedPoolId: selectedPool.poolId,
        selectedOwnerId: selectedPool.ownerId,
      };
    }

    if (options?.ownerId) {
      const hasAccess = pools.some((pool) => pool.ownerId === options.ownerId);
      if (!hasAccess) {
        throw new InventoryValidationError('Owner is not available in inventory scope.');
      }
      return {
        ownerIds: [options.ownerId],
        pools: pools.filter((pool) => pool.ownerId === options.ownerId),
        selectedPoolId: null,
        selectedOwnerId: options.ownerId,
      };
    }

    return {
      ownerIds: [...new Set(pools.map((pool) => pool.ownerId))],
      pools,
      selectedPoolId: null,
      selectedOwnerId: null,
    };
  }

  private async getOwnerIdForPool(poolId: string) {
    const [pool] = await this.db
      .select({ ownerId: schema.pools.ownerId })
      .from(schema.pools)
      .where(eq(schema.pools.poolId, poolId))
      .limit(1);

    if (!pool) {
      throw new InventoryValidationError('Pool not found.');
    }

    return pool.ownerId;
  }

  private async ensureStockRecord(
    ownerId: string,
    productId: string,
    unit: string,
    options?: { poolId?: string | null },
  ) {
    const [existing] = await this.db
      .select()
      .from(schema.inventoryStock)
      .where(
        and(eq(schema.inventoryStock.ownerId, ownerId), eq(schema.inventoryStock.productId, productId)),
      )
      .limit(1);

    if (existing) return existing;

    const [created] = await this.db
      .insert(schema.inventoryStock)
      .values({
        ownerId,
        poolId: options?.poolId ?? null,
        productId,
        unit,
        quantityOnHand: '0',
        reorderPoint: '0',
      })
      .returning();

    return created;
  }

  private async loadProductVendorPrices(productIds: string[]) {
    if (!productIds.length) {
      return new Map<string, Array<Record<string, unknown>>>();
    }

    const rows = await this.db
      .select({
        productId: schema.productVendorPrices.productId,
        priceId: schema.productVendorPrices.priceId,
        vendorId: schema.productVendorPrices.vendorId,
        vendorName: schema.vendors.name,
        websiteUrl: schema.vendors.websiteUrl,
        unitPrice: schema.productVendorPrices.unitPrice,
        currency: schema.productVendorPrices.currency,
        packageSize: schema.productVendorPrices.packageSize,
        unitLabel: schema.productVendorPrices.unitLabel,
        source: schema.productVendorPrices.source,
        fetchedAt: schema.productVendorPrices.fetchedAt,
        isPrimary: schema.productVendorPrices.isPrimary,
      })
      .from(schema.productVendorPrices)
      .leftJoin(schema.vendors, eq(schema.productVendorPrices.vendorId, schema.vendors.vendorId))
      .where(inArray(schema.productVendorPrices.productId, productIds))
      .orderBy(
        asc(schema.productVendorPrices.productId),
        sql`${schema.productVendorPrices.isPrimary} desc`,
        asc(schema.vendors.name),
      );

    const pricesByProduct = new Map<string, typeof rows>();
    for (const row of rows) {
      const current = pricesByProduct.get(row.productId) ?? [];
      current.push(row);
      pricesByProduct.set(row.productId, current);
    }
    return pricesByProduct;
  }

  async decrementForChemicalAction(input: {
    poolId: string;
    productId: string;
    amount: number;
    unit: string;
    userId: string;
    chemicalActionId: string;
  }) {
    const ownerId = await this.getOwnerIdForPool(input.poolId);
    const stock = await this.ensureStockRecord(ownerId, input.productId, input.unit, { poolId: input.poolId });
    const current = Number(stock.quantityOnHand ?? 0);
    const next = Math.max(0, current - input.amount);
    const appliedDelta = next - current;

    const [updated] = await this.db
      .update(schema.inventoryStock)
      .set({
        quantityOnHand: next.toFixed(3),
        unit: input.unit,
        poolId: stock.poolId ?? input.poolId,
        lastDecrementedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.inventoryStock.stockId, stock.stockId))
      .returning();

    await this.db.insert(schema.inventoryTransactions).values({
      ownerId,
      poolId: input.poolId,
      productId: input.productId,
      stockId: stock.stockId,
      transactionType: 'decrement',
      quantityDelta: appliedDelta.toFixed(3),
      unit: input.unit,
      source: 'chemical_action',
      chemicalActionId: input.chemicalActionId,
      performedBy: input.userId,
      meta: { reason: 'dosing_event' },
    });

    const reorderPoint = Number(updated?.reorderPoint ?? 0);
    const lowStock = reorderPoint > 0 && next <= reorderPoint;

    if (lowStock) {
      await this.db.insert(schema.notifications).values({
        userId: input.userId,
        poolId: input.poolId,
        channel: 'in_app',
        title: 'Low stock alert',
        message: `Inventory for product ${input.productId} is low (${next.toFixed(2)} ${input.unit} remaining).`,
        status: 'sent',
        data: {
          type: 'inventory.low_stock',
          productId: input.productId,
          quantityOnHand: next,
          reorderPoint,
        },
        sentAt: new Date(),
      });
    }

    return { stock: updated, lowStock };
  }

  async listInventory(userId: string, options?: { poolId?: string }) {
    const scope = await this.resolveScope(userId, options);
    if (!scope.ownerIds.length) {
      return { items: [], pools: [], scope: { poolId: null } };
    }

    const rows = await this.db
      .select({
        stockId: schema.inventoryStock.stockId,
        ownerId: schema.inventoryStock.ownerId,
        poolId: schema.inventoryStock.poolId,
        productId: schema.inventoryStock.productId,
        itemClass: schema.products.itemClass,
        productName: schema.products.name,
        productBrand: schema.products.brand,
        productSku: schema.products.sku,
        productType: schema.products.productType,
        quantityOnHand: schema.inventoryStock.quantityOnHand,
        reorderPoint: schema.inventoryStock.reorderPoint,
        unit: schema.inventoryStock.unit,
        leadTimeDays: schema.inventoryStock.leadTimeDays,
        preferredVendorId: schema.inventoryStock.preferredVendorId,
        preferredVendorName: schema.vendors.name,
        preferredUnitPrice: schema.inventoryStock.preferredUnitPrice,
        preferredCurrency: schema.inventoryStock.preferredCurrency,
        lastDecrementedAt: schema.inventoryStock.lastDecrementedAt,
        updatedAt: schema.inventoryStock.updatedAt,
      })
      .from(schema.inventoryStock)
      .leftJoin(schema.products, eq(schema.inventoryStock.productId, schema.products.productId))
      .leftJoin(schema.vendors, eq(schema.inventoryStock.preferredVendorId, schema.vendors.vendorId))
      .where(inArray(schema.inventoryStock.ownerId, scope.ownerIds))
      .orderBy(desc(schema.inventoryStock.updatedAt), asc(schema.products.name));

    const windowStart = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);
    const usageConditions = [
      inArray(schema.inventoryTransactions.ownerId, scope.ownerIds),
      eq(schema.inventoryTransactions.transactionType, 'decrement'),
      gte(schema.inventoryTransactions.createdAt, windowStart),
    ];
    if (scope.selectedPoolId) {
      usageConditions.push(eq(schema.inventoryTransactions.poolId, scope.selectedPoolId));
    }

    const usage = await this.db
      .select({
        productId: schema.inventoryTransactions.productId,
        consumed: sql<number>`abs(coalesce(sum(${schema.inventoryTransactions.quantityDelta}::numeric), 0))::float8`,
      })
      .from(schema.inventoryTransactions)
      .where(and(...usageConditions))
      .groupBy(schema.inventoryTransactions.productId);

    const usageByProduct = new Map(usage.map((item) => [item.productId, Number(item.consumed ?? 0)]));
    const vendorPricesByProduct = await this.loadProductVendorPrices(rows.map((row) => row.productId));

    const items = rows.map((row) => {
      const quantity = Number(row.quantityOnHand ?? 0);
      const reorderPoint = Number(row.reorderPoint ?? 0);
      const consumed30d = usageByProduct.get(row.productId) ?? 0;
      const avgPerDay = consumed30d / 30;
      const daysRemaining = avgPerDay > 0 ? quantity / avgPerDay : null;
      const depletionDate =
        daysRemaining !== null ? new Date(Date.now() + daysRemaining * 24 * 60 * 60 * 1000) : null;
      const vendorPrices = vendorPricesByProduct.get(row.productId) ?? [];
      const primaryVendorPrice = vendorPrices.find((entry) => entry.isPrimary) ?? vendorPrices[0] ?? null;

      return {
        ...row,
        lowStock: reorderPoint > 0 && quantity <= reorderPoint,
        preferredVendor: row.preferredVendorId
          ? {
              vendorId: row.preferredVendorId,
              name: row.preferredVendorName,
            }
          : null,
        catalogPrice: primaryVendorPrice,
        catalogPriceIsStale: vendorPriceSyncService.isPriceStale(primaryVendorPrice?.fetchedAt as Date | string | null | undefined),
        vendorPrices,
        usage: {
          consumedLast30Days: consumed30d,
          avgPerDay,
          forecastedDepletionDate: depletionDate ? depletionDate.toISOString() : null,
        },
      };
    });

    return {
      items,
      pools: scope.pools,
      scope: { poolId: scope.selectedPoolId },
    };
  }

  async listPoolInventory(poolId: string, userId: string) {
    const inventory = await this.listInventory(userId, { poolId });
    return { items: inventory.items };
  }

  async listTransactions(userId: string, options?: { poolId?: string; limit?: number }) {
    const scope = await this.resolveScope(userId, options);
    if (!scope.ownerIds.length) {
      return { items: [], pools: [] };
    }

    const conditions = [inArray(schema.inventoryTransactions.ownerId, scope.ownerIds)];
    if (scope.selectedPoolId) {
      conditions.push(eq(schema.inventoryTransactions.poolId, scope.selectedPoolId));
    }

    const rows = await this.db
      .select({
        transactionId: schema.inventoryTransactions.transactionId,
        ownerId: schema.inventoryTransactions.ownerId,
        poolId: schema.inventoryTransactions.poolId,
        productId: schema.inventoryTransactions.productId,
        productName: schema.products.name,
        transactionType: schema.inventoryTransactions.transactionType,
        quantityDelta: schema.inventoryTransactions.quantityDelta,
        unit: schema.inventoryTransactions.unit,
        source: schema.inventoryTransactions.source,
        vendorId: schema.inventoryTransactions.vendorId,
        vendorName: schema.vendors.name,
        unitPrice: schema.inventoryTransactions.unitPrice,
        currency: schema.inventoryTransactions.currency,
        note: schema.inventoryTransactions.note,
        itemClass: schema.products.itemClass,
        createdAt: schema.inventoryTransactions.createdAt,
      })
      .from(schema.inventoryTransactions)
      .leftJoin(schema.products, eq(schema.inventoryTransactions.productId, schema.products.productId))
      .leftJoin(schema.vendors, eq(schema.inventoryTransactions.vendorId, schema.vendors.vendorId))
      .where(and(...conditions))
      .orderBy(desc(schema.inventoryTransactions.createdAt))
      .limit(options?.limit ?? 50);

    return { items: rows, pools: scope.pools };
  }

  async createTransaction(
    userId: string,
    input: {
      ownerId?: string;
      poolId?: string | null;
      productId: string;
      transactionType: string;
      quantityDelta: number;
      unit: string;
      source?: string;
      chemicalActionId?: string;
      vendorId?: string;
      unitPrice?: number;
      currency?: string;
      note?: string;
      meta?: Record<string, unknown>;
    },
  ) {
    const scope = await this.resolveScope(userId, {
      poolId: input.poolId ?? undefined,
      ownerId: input.ownerId,
    });

    const ownerId =
      scope.selectedOwnerId ??
      (scope.ownerIds.length === 1 ? scope.ownerIds[0] : null);

    if (!ownerId) {
      throw new InventoryValidationError('Select a pool or owner before recording inventory activity.');
    }

    const stock = await this.ensureStockRecord(ownerId, input.productId, input.unit, {
      poolId: input.poolId ?? null,
    });
    const current = Number(stock.quantityOnHand ?? 0);
    const next = Math.max(0, current + input.quantityDelta);
    const appliedDelta = next - current;

    const [updatedStock] = await this.db
      .update(schema.inventoryStock)
      .set({
        poolId: stock.poolId ?? input.poolId ?? null,
        quantityOnHand: next.toFixed(3),
        unit: input.unit,
        lastDecrementedAt: appliedDelta < 0 ? new Date() : stock.lastDecrementedAt,
        updatedAt: new Date(),
      })
      .where(eq(schema.inventoryStock.stockId, stock.stockId))
      .returning();

    const [transaction] = await this.db
      .insert(schema.inventoryTransactions)
      .values({
        ownerId,
        poolId: input.poolId ?? null,
        productId: input.productId,
        stockId: stock.stockId,
        transactionType: input.transactionType,
        quantityDelta: appliedDelta.toFixed(3),
        unit: input.unit,
        source: input.source ?? 'manual',
        chemicalActionId: input.chemicalActionId,
        performedBy: userId,
        vendorId: input.vendorId,
        unitPrice: input.unitPrice?.toFixed(2),
        currency: (input.currency ?? 'USD').toUpperCase(),
        note: input.note,
        meta: input.meta,
      })
      .returning();

    return { transaction, stock: updatedStock };
  }

  async updateStockSettings(
    userId: string,
    stockId: string,
    patch: {
      reorderPoint?: number;
      leadTimeDays?: number;
      preferredVendorId?: string | null;
      preferredUnitPrice?: number | null;
      preferredCurrency?: string | null;
    },
  ) {
    const accessiblePools = await this.getAccessiblePools(userId);
    const accessibleOwnerIds = [...new Set(accessiblePools.map((pool) => pool.ownerId))];

    const [existing] = await this.db
      .select()
      .from(schema.inventoryStock)
      .where(eq(schema.inventoryStock.stockId, stockId))
      .limit(1);

    if (!existing || !accessibleOwnerIds.includes(existing.ownerId)) {
      return null;
    }

    const [updated] = await this.db
      .update(schema.inventoryStock)
      .set({
        reorderPoint:
          patch.reorderPoint === undefined ? undefined : patch.reorderPoint.toFixed(3),
        leadTimeDays: patch.leadTimeDays,
        preferredVendorId: patch.preferredVendorId,
        preferredUnitPrice:
          patch.preferredUnitPrice === undefined
            ? undefined
            : patch.preferredUnitPrice === null
              ? null
              : patch.preferredUnitPrice.toFixed(2),
        preferredCurrency: patch.preferredCurrency
          ? patch.preferredCurrency.toUpperCase()
          : patch.preferredCurrency === null
            ? null
            : undefined,
        updatedAt: new Date(),
      })
      .where(eq(schema.inventoryStock.stockId, stockId))
      .returning();

    return updated;
  }
}

export const inventoryService = new InventoryService();
