import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { scheduleEventsService, ScheduleEventAccessError, ScheduleEventNotFoundError } from '../services/schedule-events.js';
import { writeAuditLog } from './audit.js';

const isoDateSchema = z.string().datetime({ offset: true });
const timeOfDaySchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format');

const createEventBodySchema = z.object({
  poolId: z.string().uuid(),
  eventType: z.enum(['dosage', 'test', 'maintenance']),
  title: z.string().trim().min(1).max(160),
  notes: z.string().trim().max(2000).nullable().optional(),
  dueAt: isoDateSchema,
  timezone: z.string().trim().min(1).max(64).optional(),
  recurrence: z.enum(['once', 'daily', 'weekly', 'monthly']).optional(),
  recurrenceInterval: z.coerce.number().int().min(1).max(365).optional(),
  reminderLeadMinutes: z.coerce.number().int().min(0).max(60 * 24 * 30).nullable().optional(),
});

const updateEventBodySchema = createEventBodySchema
  .partial()
  .extend({
    status: z.enum(['scheduled', 'completed', 'canceled']).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one property must be provided.',
  });

const listQuerySchema = z.object({
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  poolId: z.string().uuid().optional(),
  status: z.enum(['scheduled', 'completed', 'canceled']).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const eventParamsSchema = z.object({
  eventId: z.string().uuid(),
});

const handleScheduleError = (reply: any, error: unknown) => {
  if (error instanceof z.ZodError) {
    return reply.code(400).send({ error: 'ValidationError', details: error.errors });
  }
  if (error instanceof ScheduleEventAccessError || error instanceof ScheduleEventNotFoundError) {
    return reply.code(error.statusCode).send({ error: error.code, message: error.message });
  }
  throw error;
};

export async function scheduleRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.auth.verifySession);

  app.get('/events', async (req, reply) => {
    try {
      const query = listQuerySchema.parse(req.query ?? {});
      const items = await scheduleEventsService.listEvents(req.user!.id, {
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
        poolId: query.poolId,
        status: query.status,
        limit: query.limit,
      });
      return reply.send({ items });
    } catch (error) {
      return handleScheduleError(reply, error);
    }
  });

  app.get('/summary', async (req, reply) => {
    return reply.send(await scheduleEventsService.getSummary(req.user!.id));
  });

  app.post('/events', async (req, reply) => {
    try {
      const payload = createEventBodySchema.parse(req.body ?? {});
      const event = await scheduleEventsService.createEvent(req.user!.id, payload);
      await writeAuditLog(app, req, {
        action: 'schedule.event.created',
        entity: 'schedule_event',
        entityId: event.eventId,
        userId: req.user!.id,
        poolId: event.poolId,
        data: { eventType: event.eventType, dueAt: event.dueAt },
      });
      return reply.code(201).send(event);
    } catch (error) {
      return handleScheduleError(reply, error);
    }
  });

  app.patch('/events/:eventId', async (req, reply) => {
    try {
      const { eventId } = eventParamsSchema.parse(req.params);
      const payload = updateEventBodySchema.parse(req.body ?? {});
      const event = await scheduleEventsService.updateEvent(req.user!.id, eventId, payload);
      await writeAuditLog(app, req, {
        action: 'schedule.event.updated',
        entity: 'schedule_event',
        entityId: event.eventId,
        userId: req.user!.id,
        poolId: event.poolId,
        data: { changed: Object.keys(payload) },
      });
      return reply.send(event);
    } catch (error) {
      return handleScheduleError(reply, error);
    }
  });

  app.post('/events/:eventId/complete', async (req, reply) => {
    try {
      const { eventId } = eventParamsSchema.parse(req.params);
      const event = await scheduleEventsService.completeEvent(req.user!.id, eventId);
      await writeAuditLog(app, req, {
        action: 'schedule.event.completed',
        entity: 'schedule_event',
        entityId: event.eventId,
        userId: req.user!.id,
        poolId: event.poolId,
        data: { recurrence: event.recurrence, nextDueAt: event.dueAt },
      });
      return reply.send(event);
    } catch (error) {
      return handleScheduleError(reply, error);
    }
  });

  app.delete('/events/:eventId', async (req, reply) => {
    try {
      const { eventId } = eventParamsSchema.parse(req.params);
      await scheduleEventsService.deleteEvent(req.user!.id, eventId);
      await writeAuditLog(app, req, {
        action: 'schedule.event.deleted',
        entity: 'schedule_event',
        entityId: eventId,
        userId: req.user!.id,
      });
      return reply.code(204).send();
    } catch (error) {
      return handleScheduleError(reply, error);
    }
  });
}
