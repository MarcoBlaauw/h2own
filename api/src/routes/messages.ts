import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { hasAccountCapability } from '../services/authorization.js';
import { messagesService } from '../services/messages.js';
import { writeAuditLog } from './audit.js';

const listThreadsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  cursor: z.string().optional(),
  poolId: z.string().uuid().optional(),
  unreadOnly: z.coerce.boolean().optional(),
});

const threadParamsSchema = z.object({
  threadId: z.string().uuid(),
});

const listMessagesQuerySchema = z.object({
  before: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const createThreadBodySchema = z.object({
  participantIds: z.array(z.string().uuid()).min(1),
  poolId: z.string().uuid().optional(),
  subject: z.string().trim().max(200).optional(),
  initialMessage: z.object({
    body: z.string().trim().min(1).max(4000),
    attachments: z.unknown().optional(),
  }),
});

const sendMessageBodySchema = z.object({
  body: z.string().trim().min(1).max(4000),
  attachments: z.unknown().optional(),
});

const markReadBodySchema = z.object({
  readAt: z.coerce.date().optional(),
});

export async function messagesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.auth.verifySession);

  app.get('/', async (req, reply) => {
    if (!hasAccountCapability(req.user?.role, 'messages.read')) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    try {
      const query = listThreadsQuerySchema.parse(req.query ?? {});
      const threads = await messagesService.listThreads(req.user!.id, query);
      return reply.send(threads);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: error.errors });
      }
      throw error;
    }
  });

  app.get('/:threadId', async (req, reply) => {
    if (!hasAccountCapability(req.user?.role, 'messages.read')) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    try {
      const { threadId } = threadParamsSchema.parse(req.params ?? {});
      const query = listMessagesQuerySchema.parse(req.query ?? {});
      const thread = await messagesService.getThread(threadId, req.user!.id);
      if (!thread) {
        return reply.code(404).send({ error: 'NotFound' });
      }

      const messages = await messagesService.listMessages(threadId, req.user!.id, query);
      if (!messages) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      return reply.send({ thread, messages });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: error.errors });
      }
      throw error;
    }
  });

  app.post('/threads', async (req, reply) => {
    if (!hasAccountCapability(req.user?.role, 'messages.send')) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    try {
      const body = createThreadBodySchema.parse(req.body ?? {});
      const created = await messagesService.createThread(
        req.user!.id,
        body.participantIds,
        {
          body: body.initialMessage.body,
          attachments: body.initialMessage.attachments,
          subject: body.subject,
        },
        body.poolId
      );

      await writeAuditLog(app, req, {
        action: 'messages.thread.created',
        entity: 'message_thread',
        entityId: created.thread.threadId,
        userId: req.user!.id,
        poolId: created.thread.poolId,
        data: {
          recipientCount: Math.max(0, created.participantCount - 1),
          messageLength: body.initialMessage.body.length,
        },
      });

      return reply.code(201).send(created);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: error.errors });
      }
      throw error;
    }
  });

  app.post('/:threadId/messages', async (req, reply) => {
    if (!hasAccountCapability(req.user?.role, 'messages.send')) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    try {
      const { threadId } = threadParamsSchema.parse(req.params ?? {});
      const body = sendMessageBodySchema.parse(req.body ?? {});
      const sent = await messagesService.sendMessage(
        threadId,
        req.user!.id,
        body.body,
        body.attachments
      );

      if (!sent) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      await writeAuditLog(app, req, {
        action: 'messages.message.sent',
        entity: 'message',
        entityId: String(sent.message.messageId),
        userId: req.user!.id,
        data: {
          threadId,
          messageLength: body.body.length,
          recipientCount: sent.recipientCount,
        },
      });

      return reply.code(201).send(sent);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: error.errors });
      }
      throw error;
    }
  });

  app.post('/:threadId/read', async (req, reply) => {
    if (!hasAccountCapability(req.user?.role, 'messages.read')) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    try {
      const { threadId } = threadParamsSchema.parse(req.params ?? {});
      const body = markReadBodySchema.parse(req.body ?? {});
      const readAt = body.readAt ?? new Date();
      const marked = await messagesService.markThreadRead(threadId, req.user!.id, readAt);
      if (!marked) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      await writeAuditLog(app, req, {
        action: 'messages.thread.read',
        entity: 'message_thread',
        entityId: threadId,
        userId: req.user!.id,
        data: { readAt: readAt.toISOString() },
      });

      return reply.send({ ok: true, threadId, readAt: readAt.toISOString() });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: error.errors });
      }
      throw error;
    }
  });
}
