import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';

const app = Fastify({ logger: true });

const PORT = Number(process.env.PORT ?? 3001);
const ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:3000';
const SESSION_SECRET = process.env.SESSION_SECRET ?? 'dev-secret';

await app.register(helmet);
await app.register(cors, { origin: ORIGIN, credentials: true });
await app.register(cookie, { secret: SESSION_SECRET });

// health
app.get('/healthz', async () => ({ ok: true }));

// placeholder routes so compose doesn’t 404
app.get('/', async () => ({ name: 'H2Own API' }));

app.listen({ port: PORT, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
