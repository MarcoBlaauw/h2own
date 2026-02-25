import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  ACCOUNT_CAPABILITIES,
  SYSTEM_CAPABILITIES,
  SYSTEM_ROLES,
  applyRoleCapabilityTemplates,
  type SystemRole,
} from '../services/authorization.js';
import { roleCapabilityTemplatesService } from '../services/role-capability-templates.js';
import { writeAuditLog } from './audit.js';

const systemRoleSchema = z.enum(SYSTEM_ROLES);

const roleParams = z.object({
  role: systemRoleSchema,
});

const updateTemplateBody = z
  .object({
    systemCapabilities: z.array(z.enum(SYSTEM_CAPABILITIES)).optional(),
    accountCapabilities: z.array(z.enum(ACCOUNT_CAPABILITIES)).optional(),
  })
  .refine((data) => data.systemCapabilities !== undefined || data.accountCapabilities !== undefined, {
    message: 'At least one capability set must be provided.',
  });

export async function adminRoleCapabilitiesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.auth.verifySession);
  app.addHook('preHandler', app.auth.requireRole('admin'));

  app.get('/', async (_req, reply) => {
    const templates = await roleCapabilityTemplatesService.listTemplates();
    return reply.send({
      roles: templates,
      available: {
        systemCapabilities: SYSTEM_CAPABILITIES,
        accountCapabilities: ACCOUNT_CAPABILITIES,
      },
    });
  });

  app.patch('/:role', async (req, reply) => {
    try {
      const { role } = roleParams.parse(req.params);
      const body = updateTemplateBody.parse(req.body ?? {});
      const updated = await roleCapabilityTemplatesService.updateTemplate(role as SystemRole, body);
      const templates = await roleCapabilityTemplatesService.listTemplates();
      applyRoleCapabilityTemplates(templates);

      await writeAuditLog(app, req, {
        action: 'admin.role_capability_template.updated',
        entity: 'role_capability_template',
        entityId: role,
        data: body,
      });

      return reply.send(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: error.errors });
      }
      throw error;
    }
  });
}
