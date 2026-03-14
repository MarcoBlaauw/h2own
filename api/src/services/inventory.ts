import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { db as dbClient } from '../db/index.js';
import * as schema from '../db/schema/index.js';

export class InventoryService {
  constructor(private readonly db = dbClient) {}

  async ensureStockRecord(poolId: string, productId: string, unit: string) {
    const [existing] = await this.db
      .select()
      .from(schema.inventoryStock)
      .where(and(eq(schema.inventoryStock.poolId, poolId), eq(schema.inventoryStock.productId, productId)))
      .limit(1);

    if (existing) return existing;

    const [created] = await this.db
      .insert(schema.inventoryStock)
      .values({
        poolId,
        productId,
        unit,
        quantityOnHand: '0',
        reorderPoint: '0',
      })
      .returning();

    return created;
  }

  async decrementForChemicalAction(input: {
    poolId: string;
    productId: string;
    amount: number;
    unit: string;
    userId: string;
    chemicalActionId: string;
  }) {
    const stock = await this.ensureStockRecord(input.poolId, input.productId, input.unit);
    const current = Number(stock.quantityOnHand ?? 0);
    const next = Math.max(0, current - input.amount);

    const [updated] = await this.db
      .update(schema.inventoryStock)
      .set({
        quantityOnHand: next.toFixed(3),
        unit: input.unit,
        lastDecrementedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.inventoryStock.stockId, stock.stockId))
      .returning();

    await this.db.insert(schema.inventoryTransactions).values({
      poolId: input.poolId,
      productId: input.productId,
      stockId: stock.stockId,
      transactionType: 'decrement',
      quantityDelta: (-Math.abs(input.amount)).toFixed(3),
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

  async listPoolInventory(poolId: string) {
    const rows = await this.db
      .select({
        stockId: schema.inventoryStock.stockId,
        productId: schema.inventoryStock.productId,
        productName: schema.products.name,
        quantityOnHand: schema.inventoryStock.quantityOnHand,
        reorderPoint: schema.inventoryStock.reorderPoint,
        unit: schema.inventoryStock.unit,
        leadTimeDays: schema.inventoryStock.leadTimeDays,
        lastDecrementedAt: schema.inventoryStock.lastDecrementedAt,
      })
      .from(schema.inventoryStock)
      .leftJoin(schema.products, eq(schema.inventoryStock.productId, schema.products.productId))
      .where(eq(schema.inventoryStock.poolId, poolId))
      .orderBy(desc(schema.inventoryStock.updatedAt));

    const windowStart = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);

    const usage = await this.db
      .select({
        productId: schema.inventoryTransactions.productId,
        consumed: sql<number>`abs(coalesce(sum(${schema.inventoryTransactions.quantityDelta}::numeric), 0))::float8`,
      })
      .from(schema.inventoryTransactions)
      .where(
        and(
          eq(schema.inventoryTransactions.poolId, poolId),
          eq(schema.inventoryTransactions.transactionType, 'decrement'),
          gte(schema.inventoryTransactions.createdAt, windowStart)
        )
      )
      .groupBy(schema.inventoryTransactions.productId);

    const usageByProduct = new Map(usage.map(item => [item.productId, Number(item.consumed ?? 0)]));

    const items = rows.map(row => {
      const quantity = Number(row.quantityOnHand ?? 0);
      const reorderPoint = Number(row.reorderPoint ?? 0);
      const consumed30d = usageByProduct.get(row.productId) ?? 0;
      const perDay = consumed30d / 30;
      const daysRemaining = perDay > 0 ? quantity / perDay : null;
      const depletionDate = daysRemaining !== null ? new Date(Date.now() + daysRemaining * 86400000) : null;

      return {
        ...row,
        lowStock: reorderPoint > 0 && quantity <= reorderPoint,
        usage: {
          consumedLast30Days: consumed30d,
          avgPerDay: perDay,
          forecastedDepletionDate: depletionDate ? depletionDate.toISOString() : null,
        },
      };
    });

    return { items };
  }
}

export const inventoryService = new InventoryService();
