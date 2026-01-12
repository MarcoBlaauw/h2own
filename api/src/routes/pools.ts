import { FastifyInstance } from 'fastify';
import type {} from '../types/fastify.d.ts';
import { z } from 'zod';
import {
  optionalPoolFields,
  parseCreateLocationId,
  parseUpdateLocationId,
} from './pools.schemas.js';
import {
  poolCoreService,
  poolMembershipService,
  poolRecommendationsService,
  poolTestingService,
} from '../services/pools/index.js';
import { recommenderService } from '../services/recommender.js';
import { wrapPoolRoute } from './route-utils.js';

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

const recommendationStatusSchema = z.enum(['pending', 'saved', 'applied', 'dismissed']);

const createRecommendationSchema = z.object({
  type: z.string(),
  title: z.string(),
  description: z.string().optional(),
  payload: z.unknown().optional(),
  priorityScore: z.number().int().min(1).max(10).optional(),
  confidenceScore: z.number().min(0).max(1).optional(),
  factorsConsidered: z.unknown().optional(),
  expiresAt: z.string().datetime().optional(),
  linkedTestId: z.string().uuid().optional(),
  status: recommendationStatusSchema.optional(),
  userAction: z.unknown().optional(),
});

const updateRecommendationSchema = z
  .object({
    status: recommendationStatusSchema.optional(),
    userFeedback: z.string().optional(),
    userAction: z.unknown().optional(),
  })
  .refine((data) => data.status || data.userFeedback || data.userAction, {
    message: 'At least one field is required',
  });

// Params / Query schemas
const poolIdParams = z.object({ poolId: z.string().uuid() });
const poolMemberParams = z.object({ poolId: z.string().uuid(), userId: z.string().uuid() });
const poolRecommendationParams = z.object({
  poolId: z.string().uuid(),
  recommendationId: z.string().uuid(),
});
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

export async function poolsRoutes(app: FastifyInstance) {
  // 🔒 All /pools/* endpoints require a valid session
  app.addHook('preHandler', app.auth.verifySession);

  // POST /pools
  app.post(
    '/',
    wrapPoolRoute(async (req, reply) => {
      const userId = req.user!.id; // set by verifySession
      const data = createPoolSchema.parse(req.body);
      const pool = await poolCoreService.createPool(userId, data);
      return reply.code(201).send(pool);
    })
  );

  // GET /pools
  app.get(
    '/',
    wrapPoolRoute(async (req, reply) => {
      const userId = req.user!.id;
      const { owner = false } = getPoolsQuery.parse(req.query);
      const pools = await poolCoreService.getPools(userId, owner);
      return reply.send(pools);
    })
  );

  // GET /pools/:poolId
  app.get(
    '/:poolId',
    wrapPoolRoute(async (req, reply) => {
      const { poolId } = poolIdParams.parse(req.params);
      const userId = req.user!.id;
      const pool = await poolCoreService.getPoolById(poolId, userId);
      return reply.send(pool);
    })
  );

  // PATCH /pools/:poolId
  app.patch(
    '/:poolId',
    wrapPoolRoute(async (req, reply) => {
      const { poolId } = poolIdParams.parse(req.params);
      const userId = req.user!.id;
      const data = updatePoolSchema.parse(req.body);
      const pool = await poolCoreService.updatePool(poolId, userId, data);
      return reply.send(pool);
    })
  );

  // DELETE /pools/:poolId
  app.delete(
    '/:poolId',
    wrapPoolRoute(async (req, reply) => {
      const { poolId } = poolIdParams.parse(req.params);
      const userId = req.user!.id;
      await poolCoreService.deletePool(poolId, userId);
      return reply.code(204).send();
    })
  );

  // POST /pools/:poolId/members
  app.post(
    '/:poolId/members',
    wrapPoolRoute(async (req, reply) => {
      const { poolId } = poolIdParams.parse(req.params);
      const requestingUserId = req.user!.id;
      const { userId, role } = addMemberSchema.parse(req.body);
      const member = await poolMembershipService.addPoolMember(poolId, requestingUserId, userId, role);
      return reply.code(201).send(member);
    })
  );

  // GET /pools/:poolId/members
  app.get(
    '/:poolId/members',
    wrapPoolRoute(async (req, reply) => {
      const { poolId } = poolIdParams.parse(req.params);
      const userId = req.user!.id;
      const members = await poolMembershipService.getPoolMembers(poolId, userId);
      return reply.send(members);
    })
  );

  // PUT /pools/:poolId/members/:userId
  app.put(
    '/:poolId/members/:userId',
    wrapPoolRoute(async (req, reply) => {
      const { poolId, userId } = poolMemberParams.parse(req.params);
      const requestingUserId = req.user!.id;
      const { role } = updateMemberSchema.parse(req.body);
      const member = await poolMembershipService.updatePoolMember(poolId, requestingUserId, userId, role);
      return reply.send(member);
    })
  );

  // GET /pools/:poolId/tests
  app.get(
    '/:poolId/tests',
    wrapPoolRoute(async (req, reply) => {
      const { poolId } = poolIdParams.parse(req.params);
      const userId = req.user!.id;
      const { limit, cursorTestedAt, cursorSessionId } = getTestsQuery.parse(req.query);
      const cursor = cursorTestedAt
        ? { testedAt: new Date(cursorTestedAt), sessionId: cursorSessionId }
        : undefined;
      const tests = await poolTestingService.getTestsByPoolId(poolId, userId, limit, cursor);
      return reply.send(tests);
    })
  );

  // POST /pools/:poolId/tests
  app.post(
    '/:poolId/tests',
    wrapPoolRoute(async (req, reply) => {
      const { poolId } = poolIdParams.parse(req.params);
      const userId = req.user!.id;
      const data = createTestSchema.parse(req.body);
      const test = await poolTestingService.createTest(poolId, userId, data);
      return reply.code(201).send(test);
    })
  );

  // POST /pools/:poolId/dosing
  app.post(
    '/:poolId/dosing',
    wrapPoolRoute(
      async (req, reply) => {
        const { poolId } = poolIdParams.parse(req.params);
        const userId = req.user!.id;
        const data = createDosingSchema.parse(req.body);
        const dosingEvent = await poolTestingService.createDosingEvent(poolId, userId, data);
        return reply.code(201).send(dosingEvent);
      },
      {
        onError: (err, _req, reply) => {
          if (
            err instanceof Error &&
            (err.message === 'Chemical not found' || err.message === 'Test does not belong to this pool')
          ) {
            reply.code(400).send({ error: err.message });
            return true;
          }
          return false;
        },
      }
    )
  );

  // GET /pools/:poolId/recommendations/preview
  app.get(
    '/:poolId/recommendations/preview',
    wrapPoolRoute(async (req, reply) => {
      const { poolId } = poolIdParams.parse(req.params);
      const recommendations = await recommenderService.getRecommendations(poolId);
      if (!recommendations) {
        return reply.code(404).send({ error: 'Pool not found' });
      }
      return reply.send(recommendations);
    })
  );

  // POST /pools/:poolId/recommendations
  app.post(
    '/:poolId/recommendations',
    wrapPoolRoute(
      async (req, reply) => {
        const { poolId } = poolIdParams.parse(req.params);
        const userId = req.user!.id;
        const data = createRecommendationSchema.parse(req.body);
        const recommendation = await poolRecommendationsService.createRecommendation(
          poolId,
          userId,
          data
        );
        return reply.code(201).send(recommendation);
      },
      {
        onError: (err, _req, reply) => {
          if (err instanceof Error && err.message === 'Test does not belong to this pool') {
            reply.code(400).send({ error: err.message });
            return true;
          }
          return false;
        },
      }
    )
  );

  // PATCH /pools/:poolId/recommendations/:recommendationId
  app.patch(
    '/:poolId/recommendations/:recommendationId',
    wrapPoolRoute(async (req, reply) => {
      const { poolId, recommendationId } = poolRecommendationParams.parse(req.params);
      const userId = req.user!.id;
      const data = updateRecommendationSchema.parse(req.body);
      const recommendation = await poolRecommendationsService.updateRecommendation(
        poolId,
        recommendationId,
        userId,
        data
      );
      if (!recommendation) {
        return reply.code(404).send({ error: 'Recommendation not found' });
      }
      return reply.send(recommendation);
    })
  );

  // DELETE /pools/:poolId/members/:userId
  app.delete(
    '/:poolId/members/:userId',
    wrapPoolRoute(async (req, reply) => {
      const { poolId, userId } = poolMemberParams.parse(req.params);
      const requestingUserId = req.user!.id;
      await poolMembershipService.removePoolMember(poolId, requestingUserId, userId);
      return reply.code(204).send();
    })
  );
}
