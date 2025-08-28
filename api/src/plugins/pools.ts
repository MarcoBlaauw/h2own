import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { poolsRoutes } from '../routes/pools';

async function poolsPlugin(fastify: FastifyInstance) {
  fastify.register(poolsRoutes);
}

export default fp(poolsPlugin);
