import { FastifyInstance, FastifyReply } from 'fastify';
import type {} from '../types/fastify.d.ts';
import { z } from 'zod';
import {
  optionalPoolFields,
  parseCreateLocationId,
  parseUpdateLocationId,
} from './pools.schemas.js';
import {
  poolsService,
  PoolForbiddenError,
  PoolNotFoundError,
  PoolLocationAccessError,
} from '../services/pools.js';
import { recommenderService } from '../services/recommender.js';

const createPoolSchema = z.object({
  name: z.string(),
  volumeGallons: z.coerce.number(), // accepts "123" or 123
  sanitizerType: z.string(),
  surfaceType: z.string(),
  locationId: parseCreateLocationId,
  ...optionalPoolFields,
});

const updatePoolSchema = z.object({
  name: z.string().optional(),
  volumeGallons: z.coerce.number().optional(),
  sanitizerType: z.string().optional(),
  surfaceType: z.string().optional(),
  locationId: parseUpdateLocationId,
  ...optionalPoolFields,
});

const updateMemberSchema = z.object({
  role: z.string(),
});

const addMemberSchema = z.object({
  userId: z.string(),
  role: z.string(),
});

const optionalMeasurement = z.preprocess(
  value => {
    if (value === '' || value === null || value === undefined) {
      return undefined;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '') return undefined;
      return trimmed;
    }
    return value;
  },
  z.coerce.number().min(0).optional()
);

const optionalCollectedAt = z.preprocess(
  value => {
    if (value === '' || value === null || value === undefined) {
      return undefined;
    }
    if (typeof value === 'string' && value.trim() === '') {
      return undefined;
    }
    return value;
  },
  z.string().datetime().optional()
);

const createTestSchema = z.object({
  fc: optionalMeasurement,
  tc: optionalMeasurement,
  ph: optionalMeasurement,
  ta: optionalMeasurement,
  cya: optionalMeasurement,
  ch: optionalMeasurement,
  salt: optionalMeasurement,
  temp: optionalMeasurement,
  collectedAt: optionalCollectedAt,
});

const createDosingSchema = z.object({
  chemicalId: z.string().uuid(),
  amount: z.number(),
  unit: z.string(),
  linkedTestId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

// Params / Query schemas
const poolIdParams = z.object({ poolId: z.string().uuid() });
const poolMemberParams = z.object({ poolId: z.string().uuid(), userId: z.string().uuid() });
const getPoolsQuery = z.object({ owner: z.coerce.boolean().optional() });
const getTestsQuery = z
  .object({
    limit: z.coerce.number().int().positive().default(20),
    cursorTestedAt: z.string().datetime().optional(),
    cursorSessionId: z.string().uuid().optional(),
  })
  .refine((data) => !data.cursorSessionId || data.cursorTestedAt, {
    message: 'cursorTestedAt is required when cursorSessionId is provided',
    path: ['cursorTestedAt'],
  });

function handlePoolAccessError(reply: FastifyReply, err: unknown) {
  if (err instanceof PoolNotFoundError) {
    reply.code(404).send({ error: 'Pool not found' });
    return true;
  }

  if (err instanceof PoolForbiddenError) {
    reply.code(403).send({ error: 'Forbidden' });
    return true;
  }

  return false;
}

export async function poolsRoutes(app: FastifyInstance) {
  // 🔒 All /pools/* endpoints require a valid session
  app.addHook('preHandler', app.auth.verifySession);

  // POST /pools
  app.post('/', async (req, reply) => {
    try {
      const userId = req.user!.id; // set by verifySession
      const data = createPoolSchema.parse(req.body);
      const pool = await poolsService.createPool(userId, data);
      return reply.code(201).send(pool);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: err.errors });
      }
      if (err instanceof PoolLocationAccessError) {
        return reply
          .code(400)
          .send({ error: 'InvalidLocation', locationId: err.locationId, message: err.message });
      }
      throw err;
    }
  });

  // GET /pools
  app.get('/', async (req, reply) => {
    try {
      const userId = req.user!.id;
      const { owner = false } = getPoolsQuery.parse(req.query);
      const pools = await poolsService.getPools(userId, owner);
      return reply.send(pools);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: err.errors });
      }
      throw err;
    }
  });

  // GET /pools/:poolId
  app.get('/:poolId', async (req, reply) => {
    try {
      const { poolId } = poolIdParams.parse(req.params);
      const userId = req.user!.id;
      const pool = await poolsService.getPoolById(poolId, userId);
      return reply.send(pool);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: err.errors });
      }
      if (handlePoolAccessError(reply, err)) {
        return;
      }
      throw err;
    }
  });

  // PATCH /pools/:poolId
  app.patch('/:poolId', async (req, reply) => {
    try {
      const { poolId } = poolIdParams.parse(req.params);
      const userId = req.user!.id;
      const data = updatePoolSchema.parse(req.body);
      const pool = await poolsService.updatePool(poolId, userId, data);
      return reply.send(pool);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: err.errors });
      }
      if (err instanceof PoolLocationAccessError) {
        return reply
          .code(400)
          .send({ error: 'InvalidLocation', locationId: err.locationId, message: err.message });
      }
      if (handlePoolAccessError(reply, err)) {
        return;
      }
      throw err;
    }
  });

  // DELETE /pools/:poolId
  app.delete('/:poolId', async (req, reply) => {
    try {
      const { poolId } = poolIdParams.parse(req.params);
      const userId = req.user!.id;
      await poolsService.deletePool(poolId, userId);
      return reply.code(204).send();
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: err.errors });
      }
      if (handlePoolAccessError(reply, err)) {
        return;
      }
      throw err;
    }
  });

  // POST /pools/:poolId/members
  app.post('/:poolId/members', async (req, reply) => {
    try {
      const { poolId } = poolIdParams.parse(req.params);
      const requestingUserId = req.user!.id;
      const { userId, role } = addMemberSchema.parse(req.body);
      const member = await poolsService.addPoolMember(poolId, requestingUserId, userId, role);
      return reply.code(201).send(member);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: err.errors });
      }
      if (handlePoolAccessError(reply, err)) {
        return;
      }
      throw err;
    }
  });

  // GET /pools/:poolId/members
  app.get('/:poolId/members', async (req, reply) => {
    try {
      const { poolId } = poolIdParams.parse(req.params);
      const userId = req.user!.id;
      const members = await poolsService.getPoolMembers(poolId, userId);
      return reply.send(members);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: err.errors });
      }
      if (handlePoolAccessError(reply, err)) {
        return;
      }
      throw err;
    }
  });

  // PUT /pools/:poolId/members/:userId
  app.put('/:poolId/members/:userId', async (req, reply) => {
    try {
      const { poolId, userId } = poolMemberParams.parse(req.params);
      const requestingUserId = req.user!.id;
      const { role } = updateMemberSchema.parse(req.body);
      const member = await poolsService.updatePoolMember(poolId, requestingUserId, userId, role);
      return reply.send(member);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: err.errors });
      }
      if (handlePoolAccessError(reply, err)) {
        return;
      }
      throw err;
    }
  });

  // GET /pools/:poolId/tests
  app.get('/:poolId/tests', async (req, reply) => {
    try {
      const { poolId } = poolIdParams.parse(req.params);
      const userId = req.user!.id;
      const { limit, cursorTestedAt, cursorSessionId } = getTestsQuery.parse(req.query);
      const cursor = cursorTestedAt
        ? { testedAt: new Date(cursorTestedAt), sessionId: cursorSessionId }
        : undefined;
      const tests = await poolsService.getTestsByPoolId(poolId, userId, limit, cursor);
      return reply.send(tests);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: err.errors });
      }
      if (handlePoolAccessError(reply, err)) {
        return;
      }
      throw err;
    }
  });

  // POST /pools/:poolId/tests
  app.post('/:poolId/tests', async (req, reply) => {
    try {
      const { poolId } = poolIdParams.parse(req.params);
      const userId = req.user!.id;
      const data = createTestSchema.parse(req.body);
      const test = await poolsService.createTest(poolId, userId, data);
      return reply.code(201).send(test);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: err.errors });
      }
      if (handlePoolAccessError(reply, err)) {
        return;
      }
      throw err;
    }
  });

  // POST /pools/:poolId/dosing
  app.post('/:poolId/dosing', async (req, reply) => {
    try {
      const { poolId } = poolIdParams.parse(req.params);
      const userId = req.user!.id;
      const data = createDosingSchema.parse(req.body);
      const dosingEvent = await poolsService.createDosingEvent(poolId, userId, data);
      return reply.code(201).send(dosingEvent);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: err.errors });
      }
      if (err instanceof Error && (err.message === 'Chemical not found' || err.message === 'Test does not belong to this pool')) {
        return reply.code(400).send({ error: err.message });
      }
      if (handlePoolAccessError(reply, err)) {
        return;
      }
      throw err;
    }
  });

  // GET /pools/:poolId/recommendations/preview
  app.get('/:poolId/recommendations/preview', async (req, reply) => {
    try {
      const { poolId } = poolIdParams.parse(req.params);
      const recommendations = await recommenderService.getRecommendations(poolId);
      if (!recommendations) {
        return reply.code(404).send({ error: 'Pool not found' });
      }
      return reply.send(recommendations);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: err.errors });
      }
      throw err;
    }
  });

  // DELETE /pools/:poolId/members/:userId
  app.delete('/:poolId/members/:userId', async (req, reply) => {
    try {
      const { poolId, userId } = poolMemberParams.parse(req.params);
      const requestingUserId = req.user!.id;
      await poolsService.removePoolMember(poolId, requestingUserId, userId);
      return reply.code(204).send();
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: err.errors });
      }
      if (handlePoolAccessError(reply, err)) {
        return;
      }
      throw err;
    }
  });
}
