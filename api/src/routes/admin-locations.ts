import { FastifyInstance } from 'fastify';
import type {} from '../types/fastify.d.ts';
import { z } from 'zod';
import {
  locationsService,
  LocationTransferTargetError,
  type LocationDetail,
} from '../services/locations.js';

const toOptionalCoordinate = (min: number, max: number) =>
  z.preprocess(
    (value) => {
      if (value === '' || value === undefined) return undefined;
      if (value === null) return null;
      return value;
    },
    z.coerce.number().min(min).max(max).nullable().optional()
  );

const optionalLatitude = toOptionalCoordinate(-90, 90);
const optionalLongitude = toOptionalCoordinate(-180, 180);

const timezoneSchema = z
  .preprocess(
    (value) => {
      if (value === '' || value === undefined) return undefined;
      if (value === null) return null;
      return value;
    },
    z.union([z.string().min(1), z.null()]).optional()
  );

const optionalText = z
  .preprocess(
    (value) => {
      if (value === '' || value === undefined) return undefined;
      if (value === null) return null;
      return value;
    },
    z.union([z.string().min(1), z.null()]).optional()
  );

const createLocationSchema = z
  .object({
    userId: z.string().uuid(),
    name: z.string().min(1),
    formattedAddress: optionalText,
    googlePlaceId: optionalText,
    googlePlusCode: optionalText,
    latitude: optionalLatitude,
    longitude: optionalLongitude,
    timezone: timezoneSchema,
    isPrimary: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => (data.latitude === undefined) === (data.longitude === undefined), {
    message: 'Latitude and longitude must both be provided together.',
    path: ['latitude'],
  });

const updateLocationSchema = z
  .object({
    userId: z.string().uuid().optional(),
    name: z.string().min(1).optional(),
    formattedAddress: optionalText,
    googlePlaceId: optionalText,
    googlePlusCode: optionalText,
    latitude: optionalLatitude,
    longitude: optionalLongitude,
    timezone: timezoneSchema,
    isPrimary: z.boolean().optional(),
    assignPools: z.array(z.string().uuid()).optional(),
    unassignPools: z.array(z.string().uuid()).optional(),
  })
  .refine(
    (data) =>
      !(
        (data.latitude === undefined && data.longitude !== undefined) ||
        (data.longitude === undefined && data.latitude !== undefined)
      ),
    {
      message: 'Latitude and longitude must both be provided together.',
      path: ['latitude'],
    }
  )
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one property must be provided.',
  });

const locationIdParams = z.object({ locationId: z.string().uuid() });

const deactivateSchema = z
  .object({
    transferPoolsTo: z
      .preprocess(
        (value) => {
          if (value === '' || value === undefined) return undefined;
          if (value === null) return null;
          return value;
        },
        z.union([z.string().uuid(), z.null()]).optional()
      )
      .optional(),
  })
  .optional();

function toResponse(detail: LocationDetail | null) {
  if (!detail) return null;
  return {
    ...detail,
    createdAt: detail.createdAt.toISOString(),
  };
}

export async function adminLocationsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.auth.verifySession);
  app.addHook('preHandler', app.auth.requireRole('admin'));

  app.get('/', async (_req, reply) => {
    const locations = await locationsService.listLocations();
    return reply.send(
      locations.map((location) => ({
        ...location,
        createdAt: location.createdAt.toISOString(),
      }))
    );
  });

  app.post('/', async (req, reply) => {
    try {
      const payload = createLocationSchema.parse(req.body ?? {});
      const location = await locationsService.createLocation(payload);
      if (!location) {
        return reply.code(500).send({ error: 'CreateFailed' });
      }
      return reply.code(201).send(toResponse(location));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: error.errors });
      }
      throw error;
    }
  });

  app.patch('/:locationId', async (req, reply) => {
    try {
      const { locationId } = locationIdParams.parse(req.params);
      const payload = updateLocationSchema.parse(req.body ?? {});
      const location = await locationsService.updateLocation(locationId, payload);
      if (!location) {
        return reply.code(404).send({ error: 'NotFound' });
      }
      return reply.send(toResponse(location));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: error.errors });
      }
      throw error;
    }
  });

  app.post('/:locationId/deactivate', async (req, reply) => {
    try {
      const { locationId } = locationIdParams.parse(req.params);
      const payload = deactivateSchema.parse(req.body ?? {});
      const location = await locationsService.deactivateLocation(locationId, payload ?? {});
      if (!location) {
        return reply.code(404).send({ error: 'NotFound' });
      }
      return reply.send(toResponse(location));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: error.errors });
      }
      if (error instanceof LocationTransferTargetError) {
        return reply
          .code(400)
          .send({ error: 'InvalidTransferTarget', message: error.message, target: error.targetLocationId });
      }
      throw error;
    }
  });
}
