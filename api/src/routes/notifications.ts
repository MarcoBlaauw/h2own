import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { notificationsService } from '../services/notifications.js';
import { writeAuditLog } from './audit.js';

const previewSchema = z
  .object({
    templateId: z.string().uuid().optional(),
    inline: z
      .object({
        subject: z.string().optional(),
        body: z.string().min(1),
      })
      .optional(),
    channel: z.enum(['email', 'sms', 'push', 'in_app']).optional(),
    to: z
      .object({
        userId: z.string().uuid().optional(),
      })
      .optional(),
    data: z.record(z.unknown()).optional(),
  })
  .refine((body) => body.templateId || body.inline, {
    message: 'templateId or inline is required',
  });

export async function notificationRoutes(app: FastifyInstance) {
  const listQuerySchema = z.object({
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
    unreadOnly: z.coerce.boolean().optional(),
  });

  app.get(
    '/',
    {
      preHandler: [app.auth.verifySession],
    },
    async (req, reply) => {
      try {
        const query = listQuerySchema.parse(req.query ?? {});
        const result = await notificationsService.listUserNotifications(req.user!.id, query);
        return reply.send(result);
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.code(400).send({ error: 'ValidationError', details: err.errors });
        }
        throw err;
      }
    }
  );

  app.get(
    '/summary',
    {
      preHandler: [app.auth.verifySession],
    },
    async (req, reply) => {
      const unreadCount = await notificationsService.getUnreadCount(req.user!.id);
      return reply.send({ unreadCount });
    }
  );

  app.post(
    '/read-all',
    {
      preHandler: [app.auth.verifySession],
    },
    async (req, reply) => {
      const result = await notificationsService.markAllRead(req.user!.id);
      await writeAuditLog(app, req, {
        action: 'notifications.read_all',
        entity: 'notification',
        userId: req.user!.id,
        data: result,
      });
      return reply.send({ ok: true, ...result });
    }
  );

  app.post(
    '/:notificationId/read',
    {
      preHandler: [app.auth.verifySession],
    },
    async (req, reply) => {
      const paramsSchema = z.object({ notificationId: z.string().uuid() });
      try {
        const { notificationId } = paramsSchema.parse(req.params);
        const updated = await notificationsService.markNotificationRead(req.user!.id, notificationId);
        if (!updated) {
          return reply.code(404).send({ error: 'NotFound' });
        }
        await writeAuditLog(app, req, {
          action: 'notifications.read',
          entity: 'notification',
          entityId: notificationId,
          userId: req.user!.id,
        });
        return reply.send({ ok: true, notificationId, readAt: updated.readAt });
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.code(400).send({ error: 'ValidationError', details: err.errors });
        }
        throw err;
      }
    }
  );

  app.post(
    '/preview',
    {
      preHandler: [app.auth.verifySession, app.auth.requireRole('admin')],
    },
    async (req, reply) => {
      try {
        const body = previewSchema.parse(req.body);
        const preview = await notificationsService.renderPreview({
          templateId: body.templateId,
          inline: body.inline,
          data: body.data ?? {},
        });
        return reply.send(preview);
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.code(400).send({ error: 'ValidationError', details: err.errors });
        }
        if (err instanceof Error && err.message === 'Template not found') {
          return reply.code(404).send({ error: 'Template not found' });
        }
        throw err;
      }
    }
  );
}
