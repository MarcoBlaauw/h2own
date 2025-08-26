import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import { env } from './env.js';
import { db, healthCheck } from './db/index.js';

const app = Fastify({ 
  logger: {
    level: env.LOG_LEVEL
  }
});

await app.register(helmet);
await app.register(cors, { 
  origin: env.CORS_ORIGIN, 
  credentials: true 
});
await app.register(cookie, { 
  secret: env.SESSION_SECRET 
});

// health
app.get('/healthz', async () => ({ ok: true }));

app.get('/db-health', async (request, reply) => {
  try {
    await healthCheck();
    reply.send({ ok: true, message: 'Database connection successful' });
  } catch (error) {
    reply.status(500).send({ ok: false, message: 'Database connection failed' });
  }
});

// placeholder routes so compose doesn't 404
app.get('/', async () => ({ 
  name: 'H2Own API',
  version: '1.0.0',
  environment: env.NODE_ENV,
  timestamp: new Date().toISOString()
}));

const start = async () => {
  try {
    await healthCheck();
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
