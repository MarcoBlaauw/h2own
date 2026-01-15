import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { notificationsService } from '../services/notifications.js';

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
