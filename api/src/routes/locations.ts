import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { locationsService } from '../services/locations.js';
import { weatherService } from '../services/weather.js';

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

export async function locationsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.auth.verifySession);

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
        if (err.message.startsWith('Tomorrow.io request failed')) {
          return reply.code(502).send({ error: err.message });
        }
      }
      throw err;
    }
  });
}
