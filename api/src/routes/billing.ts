import { FastifyInstance } from 'fastify';
import { hasAccountCapability } from '../services/authorization.js';
import { writeAuditLog } from './audit.js';

export async function billingRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.auth.verifySession);

  app.get('/summary', async (req, reply) => {
    if (!hasAccountCapability(req.user?.role, 'billing.read')) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    return reply.send({
      featureStatus: 'placeholder',
      plan: null,
      status: 'not_configured',
      capabilities: {
        read: hasAccountCapability(req.user?.role, 'billing.read'),
        manage: hasAccountCapability(req.user?.role, 'billing.manage'),
      },
    });
  });

  app.post('/portal-session', async (req, reply) => {
    if (!hasAccountCapability(req.user?.role, 'billing.manage')) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    await writeAuditLog(app, req, {
      action: 'billing.placeholder.portal_session.requested',
      entity: 'billing',
      userId: req.user!.id,
      data: { provider: null },
    });

    return reply.send({
      ok: true,
      featureStatus: 'placeholder',
      url: null,
      message: 'Billing portal integration is planned and not fully enabled yet.',
    });
  });
}
