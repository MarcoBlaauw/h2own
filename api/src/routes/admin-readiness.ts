import { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import * as schema from '../db/schema/index.js';
import { env } from '../env.js';
import { count, desc, inArray } from 'drizzle-orm';
import { notificationDispatcherService } from '../services/notification-dispatcher.js';
import { integrationService } from '../services/integrations.js';

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
    const llmIntegration = await integrationService.getIntegration('llm').catch(() => null);
    const llmConfig =
      llmIntegration?.config && typeof llmIntegration.config === 'object' && !Array.isArray(llmIntegration.config)
        ? (llmIntegration.config as Record<string, unknown>)
        : {};
    const llmProvider =
      typeof llmConfig.provider === 'string' && llmConfig.provider.trim()
        ? llmConfig.provider.trim()
        : 'none';
    const llmModelFamily =
      typeof llmConfig.modelFamily === 'string' && llmConfig.modelFamily.trim()
        ? llmConfig.modelFamily.trim()
        : 'balanced';
    const llmModelId =
      typeof llmConfig.modelId === 'string' && llmConfig.modelId.trim()
        ? llmConfig.modelId.trim()
        : null;
    const llmHasApiKey =
      Boolean(llmIntegration?.credentials) &&
      typeof llmIntegration?.credentials?.apiKey === 'string' &&
      llmIntegration.credentials.apiKey.trim().length > 0;
    const llmStatus = (() => {
      if (!llmIntegration?.enabled || llmProvider === 'none' || !llmHasApiKey) return 'not_configured';
      if ((llmIntegration.lastResponseCode ?? 0) >= 400) return 'degraded';
      if (llmIntegration.lastSuccessAt) return 'healthy';
      return 'configured';
    })();
    const llmDetails = (() => {
      if (llmStatus === 'not_configured') {
        return 'LLM provider not configured or disabled. Treatment plans will fall back to computed preview.';
      }
      const modelSummary = llmModelId ? `${llmProvider}/${llmModelId}` : `${llmProvider}/${llmModelFamily}`;
      if (llmStatus === 'degraded') {
        return `Configured for ${modelSummary}, but recent provider calls failed.`;
      }
      if (llmStatus === 'healthy') {
        return `Configured for ${modelSummary}. Last success ${llmIntegration?.lastSuccessAt?.toISOString() ?? 'unknown'}.`;
      }
      return `Configured for ${modelSummary}. No successful calls recorded yet.`;
    })();

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
          key: 'llm',
          label: 'LLM',
          wired: true,
          providerStatus: llmStatus,
          details: llmDetails,
        },
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
