import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { hasAccountCapability } from '../services/authorization.js';
import { writeAuditLog } from './audit.js';

const sendMessageBodySchema = z.object({
  recipientUserId: z.string().uuid(),
  body: z.string().trim().min(1).max(2000),
});

export async function messagesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.auth.verifySession);

  app.get('/', async (req, reply) => {
    if (!hasAccountCapability(req.user?.role, 'messages.read')) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    return reply.send({
      featureStatus: 'placeholder',
      conversations: [],
      capabilities: {
        read: hasAccountCapability(req.user?.role, 'messages.read'),
        send: hasAccountCapability(req.user?.role, 'messages.send'),
      },
    });
  });

  app.post('/send', async (req, reply) => {
    if (!hasAccountCapability(req.user?.role, 'messages.send')) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    try {
      const body = sendMessageBodySchema.parse(req.body ?? {});

      await writeAuditLog(app, req, {
        action: 'messages.placeholder.sent',
        entity: 'message',
        userId: req.user!.id,
        data: {
          recipientUserId: body.recipientUserId,
          messageLength: body.body.length,
        },
      });

      return reply.send({
        ok: true,
        featureStatus: 'placeholder',
        queued: false,
        message: 'Direct messaging is planned and not fully enabled yet.',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: error.errors });
      }
      throw error;
    }
  });
}
