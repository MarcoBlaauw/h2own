import { FastifyInstance } from 'fastify';
import type {} from '../types/fastify.d.ts';
import { z } from 'zod';
import { usersService, UsersForbiddenError } from '../services/users.js';

const listUsersQuery = z.object({
  search: z.string().optional(),
  role: z.string().optional(),
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      return value === 'true';
    }),
});

const updateUserBody = z
  .object({
    role: z.string().min(1).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one property must be provided.',
  });

const userIdParams = z.object({
  userId: z.string().uuid(),
});

const resetPasswordBody = z
  .object({
    newPassword: z.string().min(8).max(128).optional(),
  })
  .optional();

function handleForbidden(reply: any, error: unknown) {
  if (error instanceof UsersForbiddenError) {
    reply.code(403).send({ error: error.code, message: error.message });
    return true;
  }
  return false;
}

export async function adminUsersRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.auth.verifySession);
  app.addHook('preHandler', app.auth.requireRole('admin'));

  app.get('/', async (req, reply) => {
    try {
      const filters = listUsersQuery.parse(req.query ?? {});
      const users = await usersService.listUsers(req.user?.role, filters);
      return reply.send(users);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: error.errors });
      }
      if (handleForbidden(reply, error)) {
        return;
      }
      throw error;
    }
  });

  app.patch('/:userId', async (req, reply) => {
    try {
      const { userId } = userIdParams.parse(req.params);
      const body = updateUserBody.parse(req.body ?? {});
      const updated = await usersService.updateUser(req.user?.role, userId, body);

      if (!updated) {
        return reply.code(404).send({ error: 'NotFound' });
      }

      return reply.send(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: error.errors });
      }
      if (handleForbidden(reply, error)) {
        return;
      }
      throw error;
    }
  });

  app.post('/:userId/reset-password', async (req, reply) => {
    try {
      const { userId } = userIdParams.parse(req.params);
      const payload = resetPasswordBody.parse(req.body ?? undefined);
      const result = await usersService.resetPassword(
        req.user?.role,
        userId,
        payload?.newPassword
      );

      if (!result) {
        return reply.code(404).send({ error: 'NotFound' });
      }

      return reply.send(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: error.errors });
      }
      if (handleForbidden(reply, error)) {
        return;
      }
      throw error;
    }
  });
}
