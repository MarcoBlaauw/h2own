import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { hasAccountCapability } from '../services/authorization.js';
import { inventoryService, InventoryValidationError } from '../services/inventory.js';
import {
  MeasurementUnitValidationError,
  normalizeMeasurementPrice,
  normalizeMeasurementValue,
} from '../services/measurement-units.js';
import { poolCostsService } from '../services/pools/costs.js';
import { writeAuditLog } from './audit.js';

const querySchema = z.object({
  poolId: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  window: z.enum(['week', 'month', 'year']).default('month'),
});

const createTransactionBody = z.object({
  ownerId: z.string().uuid().optional(),
  poolId: z.string().uuid().optional(),
  productId: z.string().uuid(),
  transactionType: z.enum(['restock', 'adjustment', 'decrement']),
  quantityDelta: z.coerce.number(),
  unit: z.string().min(1).max(20),
  source: z.string().max(50).optional(),
  chemicalActionId: z.string().uuid().optional(),
  vendorId: z.string().uuid().optional(),
  unitPrice: z.coerce.number().positive().optional(),
  currency: z.string().length(3).optional(),
  note: z.string().max(2000).optional(),
});

const stockParams = z.object({
  stockId: z.string().uuid(),
});

const updateStockBody = z
  .object({
    reorderPoint: z.coerce.number().min(0).optional(),
    leadTimeDays: z.coerce.number().int().min(0).max(365).optional(),
    preferredVendorId: z.string().uuid().nullable().optional(),
    preferredUnitPrice: z.coerce.number().positive().nullable().optional(),
    preferredCurrency: z.string().length(3).nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one property must be provided.',
  });

function ensureCapability(role: string | undefined, capability: 'inventory.read' | 'inventory.manage') {
  if (!hasAccountCapability(role, capability)) {
    const error = new Error('Forbidden');
    error.name = 'Forbidden';
    throw error;
  }
}

export async function inventoryRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.auth.verifySession);

  app.get('/', async (req, reply) => {
    try {
      ensureCapability(req.user?.role ?? undefined, 'inventory.read');
      const query = querySchema.pick({ poolId: true }).parse(req.query ?? {});
      const inventory = await inventoryService.listInventory(req.user!.id, query);
      return reply.send(inventory);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: error.errors });
      }
      if (error instanceof InventoryValidationError) {
        return reply.code(400).send({ error: 'ValidationError', message: error.message });
      }
      if (error instanceof Error && error.name === 'Forbidden') {
        return reply.code(403).send({ error: 'Forbidden' });
      }
      throw error;
    }
  });

  app.get('/transactions', async (req, reply) => {
    try {
      ensureCapability(req.user?.role ?? undefined, 'inventory.read');
      const query = querySchema.pick({ poolId: true, limit: true }).parse(req.query ?? {});
      const transactions = await inventoryService.listTransactions(req.user!.id, query);
      return reply.send(transactions);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: error.errors });
      }
      if (error instanceof InventoryValidationError) {
        return reply.code(400).send({ error: 'ValidationError', message: error.message });
      }
      if (error instanceof Error && error.name === 'Forbidden') {
        return reply.code(403).send({ error: 'Forbidden' });
      }
      throw error;
    }
  });

  app.post('/transactions', async (req, reply) => {
    try {
      ensureCapability(req.user?.role ?? undefined, 'inventory.read');
      const body = createTransactionBody.parse(req.body ?? {});
      const normalizedQuantity = normalizeMeasurementValue(body.quantityDelta, body.unit);
      const normalizedUnitPrice =
        body.unitPrice === undefined ? undefined : normalizeMeasurementPrice(body.unitPrice, body.unit).value;
      const result = await inventoryService.createTransaction(req.user!.id, {
        ...body,
        quantityDelta: normalizedQuantity.value,
        unit: normalizedQuantity.unit,
        unitPrice: normalizedUnitPrice,
      });
      await writeAuditLog(app, req, {
        action: 'inventory.transaction.created',
        entity: 'inventory_transaction',
        entityId: result.transaction.transactionId,
        poolId: body.poolId ?? null,
        data: {
          ownerId: body.ownerId ?? null,
          productId: body.productId,
          transactionType: body.transactionType,
          quantityDelta: normalizedQuantity.value,
          unit: normalizedQuantity.unit,
          vendorId: body.vendorId ?? null,
          unitPrice: normalizedUnitPrice ?? null,
          currency: body.currency ?? 'USD',
        },
      });
      return reply.code(201).send(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: error.errors });
      }
      if (error instanceof InventoryValidationError) {
        return reply.code(400).send({ error: 'ValidationError', message: error.message });
      }
      if (error instanceof MeasurementUnitValidationError) {
        return reply.code(400).send({ error: 'ValidationError', message: error.message });
      }
      if (error instanceof Error && error.name === 'Forbidden') {
        return reply.code(403).send({ error: 'Forbidden' });
      }
      throw error;
    }
  });

  app.patch('/:stockId', async (req, reply) => {
    try {
      ensureCapability(req.user?.role ?? undefined, 'inventory.manage');
      const { stockId } = stockParams.parse(req.params);
      const body = updateStockBody.parse(req.body ?? {});
      const updated = await inventoryService.updateStockSettings(req.user!.id, stockId, body);
      if (!updated) {
        return reply.code(404).send({ error: 'NotFound' });
      }
      await writeAuditLog(app, req, {
        action: 'inventory.stock.updated',
        entity: 'inventory_stock',
        entityId: updated.stockId,
        poolId: updated.poolId ?? null,
        data: {
          reorderPoint: body.reorderPoint,
          leadTimeDays: body.leadTimeDays,
          preferredVendorId: body.preferredVendorId,
          preferredUnitPrice: body.preferredUnitPrice,
          preferredCurrency: body.preferredCurrency,
        },
      });
      return reply.send(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: error.errors });
      }
      if (error instanceof Error && error.name === 'Forbidden') {
        return reply.code(403).send({ error: 'Forbidden' });
      }
      throw error;
    }
  });

  app.get('/costs', async (req, reply) => {
    try {
      ensureCapability(req.user?.role ?? undefined, 'inventory.read');
      const query = querySchema.parse(req.query ?? {});
      const [costs, summary] = await Promise.all([
        poolCostsService.getAccountCosts(req.user!.id, {
          poolId: query.poolId,
          from: query.from ? new Date(query.from) : undefined,
          to: query.to ? new Date(query.to) : undefined,
          limit: query.limit,
        }),
        poolCostsService.getAccountCostsSummary(req.user!.id, {
          poolId: query.poolId,
          window: query.window,
        }),
      ]);
      return reply.send({
        items: costs.items,
        summary,
        pools: summary.pools,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: error.errors });
      }
      if (error instanceof Error && error.name === 'Forbidden') {
        return reply.code(403).send({ error: 'Forbidden' });
      }
      throw error;
    }
  });
}
