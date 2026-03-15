import { FastifyInstance } from 'fastify';
import { vendorsService } from '../services/vendors.js';

export async function vendorsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.auth.verifySession);

  app.get('/', async (_req, reply) => {
    const vendors = await vendorsService.listVendors();
    return reply.send(vendors);
  });
}
