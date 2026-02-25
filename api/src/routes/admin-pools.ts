import { FastifyInstance } from 'fastify';
import type {} from '../types/fastify.d.ts';
import { z } from 'zod';
import { optionalPoolFields, parseUpdateLocationId } from './pools.schemas.js';
import {
  poolCoreService,
  poolAdminService,
  poolEquipmentService,
  PoolNotFoundError,
  PoolLocationAccessError,
  PoolValidationError,
  type AdminPoolSummary,
} from '../services/pools/index.js';
import { writeAuditLog } from './audit.js';

const updatePoolSchema = z
  .object({
    name: z.string().min(1).optional(),
    volumeGallons: z.coerce.number().positive().optional(),
    sanitizerType: z.string().min(1).optional(),
    surfaceType: z.string().min(1).optional(),
    locationId: parseUpdateLocationId,
    isActive: z.boolean().optional(),
    ...optionalPoolFields,
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one property must be provided.',
  });

const transferSchema = z.object({
  newOwnerId: z.string().uuid(),
  retainExistingAccess: z.boolean().optional().default(false),
});

const equipmentTypeSchema = z.enum(['none', 'heater', 'chiller', 'combo']);
const energySourceSchema = z.enum(['gas', 'electric', 'heat_pump', 'solar_assisted', 'unknown']);
const equipmentStatusSchema = z.enum(['enabled', 'disabled']);
const temperatureUnitSchema = z.enum(['F', 'C']);

const nullableTemperatureValue = z.preprocess(
  (value) => {
    if (value === '' || value === null || value === undefined) return null;
    return value;
  },
  z.coerce.number().min(-20).max(120).nullable()
);

const updateEquipmentSchema = z.object({
  equipmentType: equipmentTypeSchema,
  energySource: energySourceSchema.default('unknown'),
  status: equipmentStatusSchema.default('enabled'),
  capacityBtu: z.coerce.number().int().positive().nullable().optional().default(null),
  metadata: z.unknown().optional().default(null),
});

const updateTemperaturePreferencesSchema = z
  .object({
    preferredTemp: nullableTemperatureValue,
    minTemp: nullableTemperatureValue,
    maxTemp: nullableTemperatureValue,
    unit: temperatureUnitSchema.default('F'),
  })
  .refine(
    (data) =>
      data.minTemp === null || data.maxTemp === null || Number(data.minTemp) <= Number(data.maxTemp),
    {
      message: 'minTemp must be less than or equal to maxTemp',
      path: ['minTemp'],
    }
  )
  .refine(
    (data) =>
      data.preferredTemp === null ||
      data.minTemp === null ||
      Number(data.preferredTemp) >= Number(data.minTemp),
    {
      message: 'preferredTemp must be greater than or equal to minTemp',
      path: ['preferredTemp'],
    }
  )
  .refine(
    (data) =>
      data.preferredTemp === null ||
      data.maxTemp === null ||
      Number(data.preferredTemp) <= Number(data.maxTemp),
    {
      message: 'preferredTemp must be less than or equal to maxTemp',
      path: ['preferredTemp'],
    }
  );

const poolIdParams = z.object({ poolId: z.string().uuid() });

function serializeSummary(summary: AdminPoolSummary) {
  return {
    ...summary,
    createdAt: summary.createdAt.toISOString(),
    updatedAt: summary.updatedAt.toISOString(),
    lastTestedAt: summary.lastTestedAt ? summary.lastTestedAt.toISOString() : null,
  };
}

function serializeDetail(detail: Awaited<ReturnType<typeof poolCoreService.getPoolById>>) {
  if (!detail) return detail;
  return {
    ...detail,
    createdAt: detail.createdAt.toISOString(),
    updatedAt: detail.updatedAt.toISOString(),
    members: detail.members.map((member) => ({
      ...member,
      invitedAt: member.invitedAt.toISOString(),
      addedAt: member.addedAt.toISOString(),
      lastAccessAt: member.lastAccessAt ? member.lastAccessAt.toISOString() : null,
    })),
    tests: detail.tests.map((test) => ({
      ...test,
      testedAt: test.testedAt.toISOString(),
    })),
    lastTestedAt: detail.lastTestedAt ? detail.lastTestedAt.toISOString() : null,
  };
}

function serializeEquipment(detail: Awaited<ReturnType<typeof poolEquipmentService.getEquipmentAsAdmin>>) {
  return {
    ...detail,
    createdAt: detail.createdAt ? detail.createdAt.toISOString() : null,
    updatedAt: detail.updatedAt ? detail.updatedAt.toISOString() : null,
  };
}

function serializeTemperaturePreferences(
  detail: Awaited<ReturnType<typeof poolEquipmentService.getTemperaturePreferencesAsAdmin>>
) {
  return {
    ...detail,
    createdAt: detail.createdAt ? detail.createdAt.toISOString() : null,
    updatedAt: detail.updatedAt ? detail.updatedAt.toISOString() : null,
  };
}

export async function adminPoolsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.auth.verifySession);
  app.addHook('preHandler', app.auth.requireRole('admin'));

  app.get('/', async (_req, reply) => {
    const pools = await poolAdminService.listAllPools();
    return reply.send(pools.map(serializeSummary));
  });

  app.get('/:poolId', async (req, reply) => {
    try {
      const { poolId } = poolIdParams.parse(req.params);
      const detail = await poolCoreService.getPoolById(poolId, null, { asAdmin: true });
      if (!detail) {
        return reply.code(404).send({ error: 'NotFound' });
      }
      return reply.send(serializeDetail(detail));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: error.errors });
      }
      if (error instanceof PoolNotFoundError) {
        return reply.code(404).send({ error: 'NotFound' });
      }
      throw error;
    }
  });

  app.patch('/:poolId', async (req, reply) => {
    try {
      const { poolId } = poolIdParams.parse(req.params);
      const payload = updatePoolSchema.parse(req.body ?? {});
      const pool = await poolAdminService.forceUpdatePool(poolId, payload);
      await writeAuditLog(app, req, {
        action: 'admin.pool.updated',
        entity: 'pool',
        entityId: poolId,
        poolId,
        data: payload,
      });
      return reply.send(pool);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: error.errors });
      }
      if (error instanceof PoolLocationAccessError) {
        return reply
          .code(400)
          .send({ error: 'InvalidLocation', locationId: error.locationId, message: error.message });
      }
      if (error instanceof PoolValidationError) {
        return reply.code(400).send({ error: 'ValidationError', details: [{ message: error.message }] });
      }
      if (error instanceof PoolNotFoundError) {
        return reply.code(404).send({ error: 'NotFound' });
      }
      throw error;
    }
  });

  app.get('/:poolId/equipment', async (req, reply) => {
    try {
      const { poolId } = poolIdParams.parse(req.params);
      const equipment = await poolEquipmentService.getEquipmentAsAdmin(poolId);
      return reply.send(serializeEquipment(equipment));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: error.errors });
      }
      if (error instanceof PoolNotFoundError) {
        return reply.code(404).send({ error: 'NotFound' });
      }
      throw error;
    }
  });

  app.put('/:poolId/equipment', async (req, reply) => {
    try {
      const { poolId } = poolIdParams.parse(req.params);
      const payload = updateEquipmentSchema.parse(req.body ?? {});
      const equipment = await poolEquipmentService.upsertEquipmentAsAdmin(poolId, {
        ...payload,
        metadata: payload.metadata ?? null,
      });
      await writeAuditLog(app, req, {
        action: 'admin.pool.equipment.updated',
        entity: 'pool_equipment',
        entityId: equipment.equipmentId ?? poolId,
        poolId,
        data: payload,
      });
      return reply.send(serializeEquipment(equipment));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: error.errors });
      }
      if (error instanceof PoolNotFoundError) {
        return reply.code(404).send({ error: 'NotFound' });
      }
      throw error;
    }
  });

  app.get('/:poolId/temperature-preferences', async (req, reply) => {
    try {
      const { poolId } = poolIdParams.parse(req.params);
      const prefs = await poolEquipmentService.getTemperaturePreferencesAsAdmin(poolId);
      return reply.send(serializeTemperaturePreferences(prefs));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: error.errors });
      }
      if (error instanceof PoolNotFoundError) {
        return reply.code(404).send({ error: 'NotFound' });
      }
      throw error;
    }
  });

  app.put('/:poolId/temperature-preferences', async (req, reply) => {
    try {
      const { poolId } = poolIdParams.parse(req.params);
      const payload = updateTemperaturePreferencesSchema.parse(req.body ?? {});
      const prefs = await poolEquipmentService.upsertTemperaturePreferencesAsAdmin(poolId, payload);
      await writeAuditLog(app, req, {
        action: 'admin.pool.temperature_preferences.updated',
        entity: 'pool_temperature_prefs',
        entityId: poolId,
        poolId,
        data: payload,
      });
      return reply.send(serializeTemperaturePreferences(prefs));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: error.errors });
      }
      if (error instanceof PoolNotFoundError) {
        return reply.code(404).send({ error: 'NotFound' });
      }
      throw error;
    }
  });

  app.post('/:poolId/transfer', async (req, reply) => {
    try {
      const { poolId } = poolIdParams.parse(req.params);
      const { newOwnerId, retainExistingAccess } = transferSchema.parse(req.body ?? {});
      const result = await poolAdminService.transferOwnership(poolId, newOwnerId, {
        retainExistingAccess,
        transferredByUserId: req.user?.id ?? null,
      });
      await writeAuditLog(app, req, {
        action: 'admin.pool.transfer_ownership',
        entity: 'pool',
        entityId: poolId,
        poolId,
        data: {
          newOwnerId,
          retainExistingAccess,
          previousOwnerId: result.previousOwnerId,
          revokedAccessCount: result.revokedAccessCount,
        },
      });
      return reply.send(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: error.errors });
      }
      if (error instanceof PoolNotFoundError) {
        return reply.code(404).send({ error: 'NotFound' });
      }
      throw error;
    }
  });
}
