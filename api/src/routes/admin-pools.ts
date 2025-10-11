import { FastifyInstance } from 'fastify';
import type {} from '../types/fastify.d.ts';
import { z } from 'zod';
import { optionalPoolFields, parseUpdateLocationId } from './pools.schemas.js';
import {
  poolsService,
  PoolNotFoundError,
  PoolLocationAccessError,
  type AdminPoolSummary,
} from '../services/pools.js';

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
});

const poolIdParams = z.object({ poolId: z.string().uuid() });

function serializeSummary(summary: AdminPoolSummary) {
  return {
    ...summary,
    createdAt: summary.createdAt.toISOString(),
    updatedAt: summary.updatedAt.toISOString(),
    lastTestedAt: summary.lastTestedAt ? summary.lastTestedAt.toISOString() : null,
  };
}

function serializeDetail(detail: Awaited<ReturnType<typeof poolsService.getPoolById>>) {
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

export async function adminPoolsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.auth.verifySession);
  app.addHook('preHandler', app.auth.requireRole('admin'));

  app.get('/', async (_req, reply) => {
    const pools = await poolsService.listAllPools();
    return reply.send(pools.map(serializeSummary));
  });

  app.get('/:poolId', async (req, reply) => {
    try {
      const { poolId } = poolIdParams.parse(req.params);
      const detail = await poolsService.getPoolById(poolId, null, { asAdmin: true });
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
      const pool = await poolsService.forceUpdatePool(poolId, payload);
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
      if (error instanceof PoolNotFoundError) {
        return reply.code(404).send({ error: 'NotFound' });
      }
      throw error;
    }
  });

  app.post('/:poolId/transfer', async (req, reply) => {
    try {
      const { poolId } = poolIdParams.parse(req.params);
      const { newOwnerId } = transferSchema.parse(req.body ?? {});
      const result = await poolsService.transferOwnership(poolId, newOwnerId);
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
