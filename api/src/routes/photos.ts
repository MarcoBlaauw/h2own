import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { photosService } from '../services/photos.js';
import { PoolForbiddenError, PoolNotFoundError } from '../services/pools/index.js';

const confirmSchema = z.object({
  fileUrl: z.string().url(),
  poolId: z.string().uuid(),
  testId: z.string().uuid().optional(),
  meta: z.record(z.unknown()).optional(),
});

export async function photosRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.auth.verifySession);

  app.post('/confirm', async (req, reply) => {
    try {
      const body = confirmSchema.parse(req.body);
      const photo = await photosService.confirmUpload(req.user!.id, body);
      return reply.code(201).send(photo);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: err.errors });
      }
      if (err instanceof Error) {
        if (err.message === 'Test does not belong to this pool') {
          return reply.code(400).send({ error: err.message });
        }
      }
      if (err instanceof PoolNotFoundError) {
        return reply.code(404).send({ error: 'Pool not found' });
      }
      if (err instanceof PoolForbiddenError) {
        return reply.code(403).send({ error: 'Forbidden' });
      }
      throw err;
    }
  });
}
