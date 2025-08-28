import { FastifyInstance } from 'fastify';
import type {} from '../types/fastify.d.ts';
import { authService } from '../services/auth.js';
import { env } from '../env.js';


export async function authRoutes(app: FastifyInstance) {
  // POST /auth/register
  app.post('/register', async (req, reply) => {
    try {
      const userId = await authService.createUser(req.body as any);
      const user = await authService.getUserById(userId);
      return reply.code(201).send(user);
    } catch (err) {
      // TODO: Handle unique constraint violation for email
      throw err;
    }
  });
  // POST /auth/login  (prefix applied in app.ts)
  app.post('/login', async (req, reply) => {
    const user = await authService.validateCredentials(req.body as any);
    if (!user) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Invalid email or password',
      });
    }

    // ⬇️ Create opaque server-side session + set signed 'sid' cookie
    await app.sessions.create(reply, user.userId /*, user.role */);

    return reply.code(201).send({
      user: { id: user.userId, email: user.email, name: user.name },
    });
  });

  // POST /auth/logout
  app.post('/logout', async (req, reply) => {
    await app.sessions.destroy(reply, req.session?.id ?? null);
    return reply.send({ ok: true });
  });

  // (optional) GET /auth/me – quick probe that auth works
  app.get('/me', { preHandler: app.auth.verifySession }, async (req) => {
    const user = await authService.getUserById(req.user!.id);
    return { user: { id: user!.userId, email: user!.email, name: user!.name } };
  });
}
