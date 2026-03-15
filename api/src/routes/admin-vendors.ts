import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { DuplicateVendorError, vendorsService } from '../services/vendors.js';
import { VendorNotFoundError, vendorPriceSyncService } from '../services/vendor-price-sync.js';
import { writeAuditLog } from './audit.js';

const optionalText = z.preprocess(
  (value) => {
    if (value === '' || value === undefined) return undefined;
    if (value === null) return null;
    return value;
  },
  z.union([z.string().min(1), z.null()]).optional(),
);

const createVendorSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(80).optional(),
  websiteUrl: optionalText.refine((value) => value === undefined || value === null || /^https?:\/\//.test(value), {
    message: 'Website URL must be an absolute http(s) URL.',
  }),
  provider: optionalText,
  isActive: z.boolean().optional(),
});

const updateVendorSchema = createVendorSchema.partial().refine((body) => Object.keys(body).length > 0, {
  message: 'At least one property must be provided.',
});

const vendorParams = z.object({
  vendorId: z.string().uuid(),
});
const importHistoryQuerySchema = z.object({
  vendorId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});
const importVendorPricesSchema = z.object({
  format: z.enum(['csv', 'json']),
  payload: z.string().min(1),
  dryRun: z.boolean().optional(),
});

export async function adminVendorsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.auth.verifySession);
  app.addHook('preHandler', app.auth.requireRole('admin'));

  app.get('/', async (_req, reply) => {
    const vendors = await vendorsService.listVendors({ includeInactive: true });
    return reply.send(vendors);
  });

  app.get('/import-history', async (req, reply) => {
    try {
      const query = importHistoryQuerySchema.parse(req.query ?? {});
      const history = await vendorPriceSyncService.listImportHistory(query);
      return reply.send(history);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: error.errors });
      }
      throw error;
    }
  });

  app.get('/sync-runs', async (req, reply) => {
    try {
      const query = importHistoryQuerySchema.parse(req.query ?? {});
      const runs = await vendorPriceSyncService.listSyncRuns(query);
      return reply.send(runs);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: error.errors });
      }
      throw error;
    }
  });

  app.post('/', async (req, reply) => {
    try {
      const body = createVendorSchema.parse(req.body ?? {});
      const vendor = await vendorsService.createVendor(body);
      await writeAuditLog(app, req, {
        action: 'admin.vendor.created',
        entity: 'vendor',
        entityId: vendor.vendorId,
        data: {
          slug: vendor.slug,
          provider: vendor.provider,
          isActive: vendor.isActive,
        },
      });
      return reply.code(201).send(vendor);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: error.errors });
      }
      if (error instanceof DuplicateVendorError) {
        return reply.code(409).send({
          error: 'DuplicateVendor',
          message: `Vendor slug "${error.slug}" already exists.`,
        });
      }
      throw error;
    }
  });

  app.patch('/:vendorId', async (req, reply) => {
    try {
      const { vendorId } = vendorParams.parse(req.params);
      const body = updateVendorSchema.parse(req.body ?? {});
      const vendor = await vendorsService.updateVendor(vendorId, body);
      if (!vendor) {
        return reply.code(404).send({ error: 'NotFound' });
      }
      await writeAuditLog(app, req, {
        action: 'admin.vendor.updated',
        entity: 'vendor',
        entityId: vendor.vendorId,
        data: body,
      });
      return reply.send(vendor);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: error.errors });
      }
      if (error instanceof DuplicateVendorError) {
        return reply.code(409).send({
          error: 'DuplicateVendor',
          message: `Vendor slug "${error.slug}" already exists.`,
        });
      }
      throw error;
    }
  });

  app.post('/:vendorId/sync-prices', async (req, reply) => {
    try {
      const { vendorId } = vendorParams.parse(req.params);
      const result = await vendorPriceSyncService.syncVendor(vendorId, {
        triggerSource: 'manual',
        actorUserId: req.user?.id ?? null,
      });
      await writeAuditLog(app, req, {
        action: 'admin.vendor.price_sync.triggered',
        entity: 'vendor',
        entityId: vendorId,
        data: {
          status: result.status,
          updatedPrices: result.updatedPrices,
          linkedProducts: result.linkedProducts,
        },
      });
      return reply.send(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: error.errors });
      }
      if (error instanceof VendorNotFoundError) {
        return reply.code(404).send({ error: 'NotFound' });
      }
      throw error;
    }
  });

  app.post('/:vendorId/import-prices', async (req, reply) => {
    try {
      const { vendorId } = vendorParams.parse(req.params);
      const body = importVendorPricesSchema.parse(req.body ?? {});
      const result = await vendorPriceSyncService.importVendorPrices(vendorId, {
        ...body,
        actorUserId: req.user?.id ?? null,
      });
      await writeAuditLog(app, req, {
        action: 'admin.vendor.price_import.triggered',
        entity: 'vendor',
        entityId: vendorId,
        data: {
          format: body.format,
          dryRun: body.dryRun ?? false,
          importedRows: result.importedRows,
          createdPrices: result.createdPrices,
          updatedPrices: result.updatedPrices,
          skippedRows: result.skippedRows,
        },
      });
      return reply.send(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: error.errors });
      }
      if (error instanceof VendorNotFoundError) {
        return reply.code(404).send({ error: 'NotFound' });
      }
      if (error instanceof Error && error.name === 'VendorPriceImportValidationError') {
        return reply.code(400).send({ error: 'ValidationError', message: error.message });
      }
      throw error;
    }
  });
}
