import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { notificationsService } from '../services/notifications.js';

const templateIdParam = z.object({
  templateId: z.string().uuid(),
});

const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  channel: z.enum(['email', 'sms', 'push', 'in_app']),
  subject: z.string().max(200).optional(),
  bodyTemplate: z.string().min(1),
  isActive: z.boolean().optional(),
});

const updateTemplateSchema = createTemplateSchema.partial().refine(
  (body) => Object.keys(body).length > 0,
  { message: 'At least one field is required.' }
);

export async function adminNotificationTemplateRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.auth.verifySession);
  app.addHook('preHandler', app.auth.requireRole('admin'));

  app.get('/', async (_req, reply) => {
    const templates = await notificationsService.listTemplates();
    return reply.send(templates);
  });

  app.post('/', async (req, reply) => {
    try {
      const body = createTemplateSchema.parse(req.body);
      const template = await notificationsService.createTemplate(body);
      return reply.code(201).send(template);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: err.errors });
      }
      throw err;
    }
  });

  app.patch('/:templateId', async (req, reply) => {
    try {
      const { templateId } = templateIdParam.parse(req.params);
      const body = updateTemplateSchema.parse(req.body ?? {});
      const template = await notificationsService.updateTemplate(templateId, body);
      if (!template) {
        return reply.code(404).send({ error: 'NotFound' });
      }
      return reply.send(template);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: err.errors });
      }
      throw err;
    }
  });
}
