import { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import * as schema from '../db/schema/index.js';
import { env } from '../env.js';
import { count } from 'drizzle-orm';

export async function adminReadinessRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.auth.verifySession);

  app.get('/', async (req, reply) => {
    const role = req.user?.role ?? null;
    if (role !== 'admin' && role !== 'business') {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    let templateCount: number;
    try {
      const [templateCountRow] = await db
        .select({ value: count(schema.notificationTemplates.templateId) })
        .from(schema.notificationTemplates);
      templateCount = Number(templateCountRow?.value ?? 0);
    } catch {
      templateCount = 0;
    }

    const smtpConfigured = Boolean(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_FROM_EMAIL);

    return reply.send({
      modules: [
        {
          key: 'messages',
          label: 'Messages',
          wired: true,
          providerStatus: 'placeholder',
          details: 'No external messaging provider connected yet.',
        },
        {
          key: 'billing',
          label: 'Billing',
          wired: true,
          providerStatus: 'placeholder',
          details: 'No billing provider configured yet.',
        },
        {
          key: 'notifications',
          label: 'Notifications',
          wired: true,
          providerStatus: smtpConfigured ? 'configured' : 'not_configured',
          details: smtpConfigured
            ? `SMTP configured. Templates: ${templateCount}.`
            : `SMTP not configured. Templates: ${templateCount}.`,
        },
      ],
      generatedAt: new Date().toISOString(),
    });
  });
}
