import { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import * as schema from '../db/schema/index.js';
import { env } from '../env.js';
import { count, desc, inArray } from 'drizzle-orm';
import { notificationDispatcherService } from '../services/notification-dispatcher.js';

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
    const channelHealth = notificationDispatcherService.getChannelHealth();
    const counters = notificationDispatcherService.getCounters();

    let failedCount: number;
    try {
      const [failedCountRow] = await db
        .select({ value: count(schema.scheduleEventNotifications.reminderId) })
        .from(schema.scheduleEventNotifications)
        .where(inArray(schema.scheduleEventNotifications.status, ['failed', 'retry']));
      failedCount = Number(failedCountRow?.value ?? 0);
    } catch {
      failedCount = 0;
    }

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
          channels: channelHealth,
          counters,
          deadLetterCount: failedCount,
        },
      ],
      generatedAt: new Date().toISOString(),
    });
  });

  app.get('/notifications/dead-letter', async (req, reply) => {
    const role = req.user?.role ?? null;
    if (role !== 'admin' && role !== 'business') {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const items = await db
      .select({
        reminderId: schema.scheduleEventNotifications.reminderId,
        eventId: schema.scheduleEventNotifications.eventId,
        userId: schema.scheduleEventNotifications.userId,
        channel: schema.scheduleEventNotifications.channel,
        status: schema.scheduleEventNotifications.status,
        errorMessage: schema.scheduleEventNotifications.errorMessage,
        errorCategory: schema.scheduleEventNotifications.errorCategory,
        providerMessageId: schema.scheduleEventNotifications.providerMessageId,
        attemptCount: schema.scheduleEventNotifications.attemptCount,
        nextRetryAt: schema.scheduleEventNotifications.nextRetryAt,
        lastAttemptAt: schema.scheduleEventNotifications.lastAttemptAt,
        createdAt: schema.scheduleEventNotifications.createdAt,
      })
      .from(schema.scheduleEventNotifications)
      .where(inArray(schema.scheduleEventNotifications.status, ['failed', 'retry']))
      .orderBy(desc(schema.scheduleEventNotifications.createdAt))
      .limit(200);

    return reply.send({ items });
  });
}
