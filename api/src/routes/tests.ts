import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { poolsService } from '../services/pools.js';

const sessionIdParams = z.object({ sessionId: z.string().uuid() });

export async function testsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.auth.verifySession);

  app.get('/:sessionId', async (req, reply) => {
    try {
      const { sessionId } = sessionIdParams.parse(req.params);
      const test = await poolsService.getTestById(sessionId);
      if (!test) {
        return reply.code(404).send({ error: 'Test not found' });
      }
      return reply.send(test);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: err.errors });
      }
      throw err;
    }
  });
}
