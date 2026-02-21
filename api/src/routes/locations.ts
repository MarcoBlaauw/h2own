import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { locationsService, LocationTransferTargetError } from '../services/locations.js';
import {
  weatherService,
  WeatherProviderRateLimitError,
  WeatherProviderRequestError,
} from '../services/weather.js';

const locationIdParam = z.object({
  locationId: z.string().uuid(),
});

const optionalNumber = z.preprocess(
  (value) => {
    if (value === '' || value === null || value === undefined) {
      return undefined;
    }
    return value;
  },
  z.coerce.number().optional()
);

const optionalString = z.preprocess(
  (value) => {
    if (value === '' || value === null || value === undefined) {
      return undefined;
    }
    return value;
  },
  z.string().optional()
);

const createLocationSchema = z
  .object({
    name: z.string().min(1),
    formattedAddress: optionalString,
    googlePlaceId: optionalString,
    googlePlusCode: optionalString,
    latitude: optionalNumber,
    longitude: optionalNumber,
    timezone: optionalString,
    isPrimary: z.coerce.boolean().optional(),
  })
  .refine((data) => (data.latitude === undefined) === (data.longitude === undefined), {
    message: 'Latitude and longitude must both be provided together.',
    path: ['latitude'],
  })
  .refine(
    (data) =>
      data.latitude === undefined || (data.latitude >= -90 && data.latitude <= 90),
    {
      message: 'Latitude must be between -90 and 90.',
      path: ['latitude'],
    }
  )
  .refine(
    (data) =>
      data.longitude === undefined || (data.longitude >= -180 && data.longitude <= 180),
    {
      message: 'Longitude must be between -180 and 180.',
      path: ['longitude'],
    }
  );

const weatherQuery = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  granularity: z.enum(['day']).default('day'),
  refresh: z.coerce.boolean().optional(),
});

const updateLocationSchema = z
  .object({
    name: z.string().min(1).optional(),
    formattedAddress: optionalString.nullable().optional(),
    googlePlaceId: optionalString.nullable().optional(),
    googlePlusCode: optionalString.nullable().optional(),
    latitude: optionalNumber.nullable().optional(),
    longitude: optionalNumber.nullable().optional(),
    timezone: optionalString.nullable().optional(),
    isPrimary: z.coerce.boolean().optional(),
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

const deactivateLocationSchema = z
  .object({
    transferPoolsTo: z.string().uuid().nullable().optional(),
  })
  .optional();

export async function locationsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.auth.verifySession);

  const assertOwnedLocation = async (locationId: string, userId: string) => {
    const locations = await locationsService.listLocationsForUser(userId);
    return locations.find((location) => location.locationId === locationId) ?? null;
  };

  app.get('/', async (req, reply) => {
    const locations = await locationsService.listLocationsForUser(req.user!.id);
    return reply.send(locations);
  });

  app.post('/', async (req, reply) => {
    try {
      const body = createLocationSchema.parse(req.body ?? {});
      const location = await locationsService.createLocation({
        userId: req.user!.id,
        name: body.name,
        formattedAddress: body.formattedAddress,
        googlePlaceId: body.googlePlaceId,
        googlePlusCode: body.googlePlusCode,
        latitude: body.latitude,
        longitude: body.longitude,
        timezone: body.timezone,
        isPrimary: body.isPrimary,
      });
      return reply.code(201).send(location);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: err.errors });
      }
      throw err;
    }
  });

  app.patch('/:locationId', async (req, reply) => {
    try {
      const { locationId } = locationIdParam.parse(req.params);
      const payload = updateLocationSchema.parse(req.body ?? {});
      const owned = await assertOwnedLocation(locationId, req.user!.id);
      if (!owned) {
        return reply.code(404).send({ error: 'Location not found' });
      }
      const location = await locationsService.updateLocation(locationId, payload);
      if (!location) {
        return reply.code(404).send({ error: 'Location not found' });
      }
      return reply.send(location);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: err.errors });
      }
      throw err;
    }
  });

  app.post('/:locationId/deactivate', async (req, reply) => {
    try {
      const { locationId } = locationIdParam.parse(req.params);
      const payload = deactivateLocationSchema.parse(req.body ?? {});
      const owned = await assertOwnedLocation(locationId, req.user!.id);
      if (!owned) {
        return reply.code(404).send({ error: 'Location not found' });
      }

      if (payload?.transferPoolsTo) {
        const transferTarget = await assertOwnedLocation(payload.transferPoolsTo, req.user!.id);
        if (!transferTarget || transferTarget.isActive === false) {
          return reply.code(400).send({ error: 'Invalid transfer target' });
        }
      }

      const location = await locationsService.deactivateLocation(locationId, payload ?? {});
      if (!location) {
        return reply.code(404).send({ error: 'Location not found' });
      }
      return reply.send(location);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: err.errors });
      }
      if (err instanceof LocationTransferTargetError) {
        return reply.code(400).send({ error: 'Invalid transfer target', target: err.targetLocationId });
      }
      throw err;
    }
  });

  app.delete('/:locationId', async (req, reply) => {
    const { locationId } = locationIdParam.parse(req.params);
    const owned = await assertOwnedLocation(locationId, req.user!.id);
    if (!owned) {
      return reply.code(404).send({ error: 'Location not found' });
    }
    const deleted = await locationsService.deleteLocation(locationId);
    if (!deleted) {
      return reply.code(404).send({ error: 'Location not found' });
    }
    return reply.code(204).send();
  });

  app.post('/purge-legacy', async (req, reply) => {
    const result = await locationsService.purgeLegacyLocationsForUser(req.user!.id);
    return reply.send(result);
  });

  app.get('/:locationId/weather', async (req, reply) => {
    try {
      const { locationId } = locationIdParam.parse(req.params);
      const { from, to, granularity, refresh } = weatherQuery.parse(req.query);

      const weather = await weatherService.getWeatherForLocation({
        locationId,
        userId: req.user!.id,
        role: req.user?.role,
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
        granularity,
        refresh,
      });

      return reply.send(weather);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: err.errors });
      }
      if (err instanceof Error) {
        if (err.message === 'Location not found') {
          return reply.code(404).send({ error: err.message });
        }
        if (err.message === 'Forbidden') {
          return reply.code(403).send({ error: err.message });
        }
        if (err.message === 'Location inactive' || err.message === 'Location is missing coordinates') {
          return reply.code(400).send({ error: err.message });
        }
        if (err.message === 'Weather provider not configured') {
          return reply.code(503).send({ error: err.message });
        }
        if (err instanceof WeatherProviderRateLimitError) {
          return reply
            .code(429)
            .send({ error: err.message, retryAfterSeconds: err.retryAfterSeconds });
        }
        if (err instanceof WeatherProviderRequestError) {
          return reply.code(502).send({ error: err.message, upstreamStatus: err.statusCode });
        }
      }
      throw err;
    }
  });
}
