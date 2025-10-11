import { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  poolTestingService,
  PoolForbiddenError,
  PoolNotFoundError,
} from '../services/pools/index.js';

const sessionIdParams = z.object({ sessionId: z.string().uuid() });

function handlePoolAccessError(reply: FastifyReply, err: unknown) {
  if (err instanceof PoolNotFoundError) {
    reply.code(404).send({ error: 'Test not found' });
    return true;
  }

  if (err instanceof PoolForbiddenError) {
    reply.code(403).send({ error: 'Forbidden' });
    return true;
  }

  return false;
}

export async function testsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.auth.verifySession);

  app.get('/:sessionId', async (req, reply) => {
    try {
      const { sessionId } = sessionIdParams.parse(req.params);
      const userId = req.user!.id;
      const test = await poolTestingService.getTestById(sessionId, userId);
      if (!test) {
        return reply.code(404).send({ error: 'Test not found' });
      }
      return reply.send(test);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: err.errors });
      }
      if (handlePoolAccessError(reply, err)) {
        return;
      }
      throw err;
    }
  });
}
