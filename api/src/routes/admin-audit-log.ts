import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type {} from '../types/fastify.d.ts';
import { auditLogService, AuditLogForbiddenError } from '../services/audit-log.js';

const listAuditLogQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(25),
  user: z
    .string()
    .optional()
    .transform((value) => {
      const trimmed = value?.trim();
      return trimmed ? trimmed : undefined;
    }),
  action: z
    .string()
    .optional()
    .transform((value) => {
      const trimmed = value?.trim();
      return trimmed ? trimmed : undefined;
    }),
  entity: z
    .string()
    .optional()
    .transform((value) => {
      const trimmed = value?.trim();
      return trimmed ? trimmed : undefined;
    }),
});

export async function adminAuditLogRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.auth.verifySession);
  app.addHook('preHandler', app.auth.requireRole('admin'));

  app.get('/', async (req, reply) => {
    try {
      const filters = listAuditLogQuery.parse(req.query ?? {});
      const logs = await auditLogService.listEntries(req.user?.role, filters);
      return reply.send(logs);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply
          .code(400)
          .send({ error: 'ValidationError', details: error.errors });
      }

      if (error instanceof AuditLogForbiddenError) {
        return reply
          .code(403)
          .send({ error: error.code, message: error.message });
      }

      throw error;
    }
  });
}
