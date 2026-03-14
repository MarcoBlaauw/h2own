import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { hasAccountCapability } from '../services/authorization.js';
import { billingService } from '../services/billing.js';
import { writeAuditLog } from './audit.js';

const portalSessionSchema = z.object({
  returnUrl: z.string().url().optional(),
});

const webhookSchema = z.object({
  userId: z.string().uuid().optional(),
  customerId: z.string().optional(),
  subscriptionId: z.string().optional(),
  provider: z.string().optional(),
  tier: z.string().optional(),
  status: z.string().optional(),
  paymentStatus: z.string().optional(),
});

export async function billingRoutes(app: FastifyInstance) {
  app.get('/summary', { preHandler: app.auth.verifySession }, async (req, reply) => {
    if (!hasAccountCapability(req.user?.role, 'billing.read')) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    return reply.send(await billingService.getSummary(req.user!.id, req.user?.role));
  });

  app.post('/portal-session', { preHandler: app.auth.verifySession }, async (req, reply) => {
    if (!hasAccountCapability(req.user?.role, 'billing.manage')) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const body = portalSessionSchema.parse(req.body ?? {});
    const session = await billingService.createPortalSession(req.user!.id, body.returnUrl);

    await writeAuditLog(app, req, {
      action: 'billing.portal_session.requested',
      entity: 'billing',
      userId: req.user!.id,
      data: { provider: session.featureStatus, ok: session.ok },
    });

    return reply.send(session);
  });

  app.post('/webhook', async (req, reply) => {
    const signature = req.headers['x-billing-signature'];
    const rawBody = JSON.stringify(req.body ?? {});
    const body = webhookSchema.parse(req.body ?? {});

    try {
      const result = await billingService.ingestSubscriptionWebhook({
        signature: typeof signature === 'string' ? signature : undefined,
        body,
        rawBody,
      });

      return reply.send(result);
    } catch (error) {
      if (error instanceof Error && (error as Error & { code?: string }).code === 'invalid_signature') {
        return reply.code(401).send({ error: 'Invalid webhook signature' });
      }
      throw error;
    }
  });
}
