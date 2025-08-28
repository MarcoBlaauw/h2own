import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { chemicalsService } from '../services/chemicals.js';

const getChemicalsQuery = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
});

export async function chemicalsRoutes(app: FastifyInstance) {
  app.get('/', async (req, reply) => {
    try {
      const { q, category } = getChemicalsQuery.parse(req.query);
      const chemicals = await chemicalsService.getChemicals(q, category);
      return reply.send(chemicals);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: err.errors });
      }
      throw err;
    }
  });
}
