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
  poolEquipmentService,
  poolMembershipService,
  poolRecommendationsService,
  poolTestingService,
  poolCostsService,
} from '../services/pools/index.js';
import { photosService } from '../services/photos.js';
import { recommenderService } from '../services/recommender.js';
import { wrapPoolRoute } from './route-utils.js';
import { writeAuditLog } from './audit.js';

const createPoolSchema = z.object({
  ownerId: z.string().uuid().optional(),
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
  photoId: z.string().uuid().optional(),
});

const createDosingSchema = z.object({
  chemicalId: z.string().uuid(),
  amount: z.number(),
  unit: z.string(),
  addedAt: z.string().datetime().optional(),
  linkedTestId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

const createPhotoUploadSchema = z.object({
  filename: z.string().optional(),
  contentType: z.string().optional(),
});

const createCostSchema = z.object({
  categoryId: z.string().uuid().optional(),
  amount: z.coerce.number().positive(),
  currency: z.string().length(3).optional(),
  description: z.string().optional(),
  chemicalActionId: z.string().uuid().optional(),
  maintenanceEventId: z.string().uuid().optional(),
  equipmentId: z.string().uuid().optional(),
  vendor: z.string().optional(),
  receiptUrl: z.string().url().optional(),
  incurredAt: z.string().datetime().optional(),
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
const getRecommendationsQuery = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: recommendationStatusSchema.optional(),
});
const getCostsQuery = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
});
const getCostSummaryQuery = z.object({
  window: z.enum(['week', 'month', 'year']).default('month'),
});
const getDosingQuery = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
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

function serializeEquipment(detail: Awaited<ReturnType<typeof poolEquipmentService.getEquipment>>) {
  return {
    ...detail,
    createdAt: detail.createdAt ? detail.createdAt.toISOString() : null,
    updatedAt: detail.updatedAt ? detail.updatedAt.toISOString() : null,
  };
}

function serializeTemperaturePreferences(
  detail: Awaited<ReturnType<typeof poolEquipmentService.getTemperaturePreferences>>
) {
  return {
    ...detail,
    createdAt: detail.createdAt ? detail.createdAt.toISOString() : null,
    updatedAt: detail.updatedAt ? detail.updatedAt.toISOString() : null,
  };
}

export async function poolsRoutes(app: FastifyInstance) {
  // 🔒 All /pools/* endpoints require a valid session
  app.addHook('preHandler', app.auth.verifySession);

  // POST /pools
  app.post(
    '/',
    wrapPoolRoute(async (req, reply) => {
      const userId = req.user!.id; // set by verifySession
      const data = createPoolSchema.parse(req.body);
      const pool = await poolCoreService.createPool(userId, data, req.user?.role);
      await writeAuditLog(app, req, {
        action: 'pool.created',
        entity: 'pool',
        entityId: pool.poolId,
        userId,
        poolId: pool.poolId,
        data: { ownerId: pool.ownerId ?? data.ownerId ?? userId },
      });
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
      await writeAuditLog(app, req, {
        action: 'pool.updated',
        entity: 'pool',
        entityId: poolId,
        userId,
        poolId,
        data,
      });
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
      await writeAuditLog(app, req, {
        action: 'pool.deleted',
        entity: 'pool',
        entityId: poolId,
        userId,
        poolId,
      });
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
    wrapPoolRoute(
      async (req, reply) => {
        const { poolId } = poolIdParams.parse(req.params);
        const userId = req.user!.id;
        const data = createTestSchema.parse(req.body);
        const test = await poolTestingService.createTest(poolId, userId, data);
        return reply.code(201).send(test);
      },
      {
        onError: (err, _req, reply) => {
          if (err instanceof Error && err.message === 'Photo does not belong to this pool') {
            reply.code(400).send({ error: err.message });
            return true;
          }
          return false;
        },
      }
    )
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

  // GET /pools/:poolId/dosing
  app.get(
    '/:poolId/dosing',
    wrapPoolRoute(async (req, reply) => {
      const { poolId } = poolIdParams.parse(req.params);
      const userId = req.user!.id;
      const { limit } = getDosingQuery.parse(req.query);
      const dosingEvents = await poolTestingService.getDosingEventsByPoolId(poolId, userId, limit);
      return reply.send(dosingEvents);
    })
  );

  // POST /pools/:poolId/photos
  app.post(
    '/:poolId/photos',
    wrapPoolRoute(async (req, reply) => {
      const { poolId } = poolIdParams.parse(req.params);
      const userId = req.user!.id;
      const data = createPhotoUploadSchema.parse(req.body ?? {});
      const upload = await photosService.createPresignedUpload(poolId, userId, data);
      return reply.send(upload);
    })
  );

  // POST /pools/:poolId/costs
  app.post(
    '/:poolId/costs',
    wrapPoolRoute(
      async (req, reply) => {
        const { poolId } = poolIdParams.parse(req.params);
        const userId = req.user!.id;
        const data = createCostSchema.parse(req.body);
        const cost = await poolCostsService.createCost(poolId, userId, data);
        return reply.code(201).send(cost);
      },
      {
        onError: (err, _req, reply) => {
          if (
            err instanceof Error &&
            (err.message === 'Cost category not found' ||
              err.message === 'Chemical action not found' ||
              err.message === 'Chemical action does not belong to this pool')
          ) {
            reply.code(400).send({ error: err.message });
            return true;
          }
          return false;
        },
      }
    )
  );

  // GET /pools/:poolId/costs
  app.get(
    '/:poolId/costs',
    wrapPoolRoute(async (req, reply) => {
      const { poolId } = poolIdParams.parse(req.params);
      const userId = req.user!.id;
      const { from, to, limit } = getCostsQuery.parse(req.query);
      const costs = await poolCostsService.getCostsByPoolId(poolId, userId, {
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
        limit,
      });
      return reply.send(costs);
    })
  );

  // GET /pools/:poolId/costs/summary
  app.get(
    '/:poolId/costs/summary',
    wrapPoolRoute(async (req, reply) => {
      const { poolId } = poolIdParams.parse(req.params);
      const userId = req.user!.id;
      const { window } = getCostSummaryQuery.parse(req.query);
      const summary = await poolCostsService.getCostsSummary(poolId, userId, window);
      return reply.send(summary);
    })
  );

  // GET /pools/:poolId/equipment
  app.get(
    '/:poolId/equipment',
    wrapPoolRoute(async (req, reply) => {
      const { poolId } = poolIdParams.parse(req.params);
      const userId = req.user!.id;
      const equipment = await poolEquipmentService.getEquipment(poolId, userId);
      return reply.send(serializeEquipment(equipment));
    })
  );

  // PUT /pools/:poolId/equipment
  app.put(
    '/:poolId/equipment',
    wrapPoolRoute(async (req, reply) => {
      const { poolId } = poolIdParams.parse(req.params);
      const userId = req.user!.id;
      const data = updateEquipmentSchema.parse(req.body ?? {});
      const equipment = await poolEquipmentService.upsertEquipment(poolId, userId, {
        ...data,
        metadata: data.metadata ?? null,
      });
      await writeAuditLog(app, req, {
        action: 'pool.equipment.updated',
        entity: 'pool_equipment',
        entityId: equipment.equipmentId ?? poolId,
        userId,
        poolId,
        data,
      });
      return reply.send(serializeEquipment(equipment));
    })
  );

  // GET /pools/:poolId/temperature-preferences
  app.get(
    '/:poolId/temperature-preferences',
    wrapPoolRoute(async (req, reply) => {
      const { poolId } = poolIdParams.parse(req.params);
      const userId = req.user!.id;
      const prefs = await poolEquipmentService.getTemperaturePreferences(poolId, userId);
      return reply.send(serializeTemperaturePreferences(prefs));
    })
  );

  // PUT /pools/:poolId/temperature-preferences
  app.put(
    '/:poolId/temperature-preferences',
    wrapPoolRoute(async (req, reply) => {
      const { poolId } = poolIdParams.parse(req.params);
      const userId = req.user!.id;
      const data = updateTemperaturePreferencesSchema.parse(req.body ?? {});
      const prefs = await poolEquipmentService.upsertTemperaturePreferences(poolId, userId, data);
      await writeAuditLog(app, req, {
        action: 'pool.temperature_preferences.updated',
        entity: 'pool_temperature_prefs',
        entityId: poolId,
        userId,
        poolId,
        data,
      });
      return reply.send(serializeTemperaturePreferences(prefs));
    })
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

  // GET /pools/:poolId/recommendations
  app.get(
    '/:poolId/recommendations',
    wrapPoolRoute(async (req, reply) => {
      const { poolId } = poolIdParams.parse(req.params);
      const userId = req.user!.id;
      const { limit, status } = getRecommendationsQuery.parse(req.query);
      const recommendations = await poolRecommendationsService.getRecommendationsByPoolId(
        poolId,
        userId,
        limit,
        status
      );
      return reply.send(recommendations);
    })
  );

  // GET /pools/:poolId/recommendations/:recommendationId
  app.get(
    '/:poolId/recommendations/:recommendationId',
    wrapPoolRoute(async (req, reply) => {
      const { poolId, recommendationId } = poolRecommendationParams.parse(req.params);
      const userId = req.user!.id;
      const recommendation = await poolRecommendationsService.getRecommendationById(
        poolId,
        recommendationId,
        userId
      );
      if (!recommendation) {
        return reply.code(404).send({ error: 'Recommendation not found' });
      }
      return reply.send(recommendation);
    })
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
