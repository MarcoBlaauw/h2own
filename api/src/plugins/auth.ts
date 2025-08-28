import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { authRoutes } from '../routes/auth';

async function authPlugin(fastify: FastifyInstance) {
  fastify.register(authRoutes);
}

export default fp(authPlugin);
