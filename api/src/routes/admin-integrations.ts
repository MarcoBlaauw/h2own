import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { integrationService, INTEGRATION_PROVIDERS } from '../services/integrations.js';
import { writeAuditLog } from './audit.js';

const providerParam = z.object({
  provider: z.enum(INTEGRATION_PROVIDERS),
});

const updateIntegrationBody = z
  .object({
    enabled: z.boolean().optional(),
    cacheTtlSeconds: z.number().int().positive().nullable().optional(),
    rateLimitCooldownSeconds: z.number().int().positive().nullable().optional(),
    config: z.record(z.unknown()).nullable().optional(),
    credentials: z.record(z.unknown()).nullable().optional(),
    apiKey: z.string().min(1).max(2048).nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one property must be provided.',
  });

export async function adminIntegrationsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.auth.verifySession);
  app.addHook('preHandler', app.auth.requireRole('admin'));

  app.get('/', async (_req, reply) => {
    const integrations = await integrationService.listIntegrations();
    return reply.send(integrations);
  });

  app.get('/:provider', async (req, reply) => {
    try {
      const { provider } = providerParam.parse(req.params);
      const integrations = await integrationService.listIntegrations();
      const integration = integrations.find((item) => item.provider === provider) ?? null;
      if (!integration) {
        return reply.code(404).send({ error: 'NotFound' });
      }

      return reply.send(integration);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: error.errors });
      }
      throw error;
    }
  });

  app.patch('/:provider', async (req, reply) => {
    try {
      const { provider } = providerParam.parse(req.params);
      const body = updateIntegrationBody.parse(req.body ?? {});
      const mergedCredentials = (() => {
        if (body.credentials === undefined && body.apiKey === undefined) {
          return undefined;
        }
        if (body.credentials === null) {
          return body.apiKey === undefined ? null : { apiKey: body.apiKey };
        }
        const base = body.credentials ?? {};
        if (body.apiKey === undefined) return base;
        return { ...base, apiKey: body.apiKey };
      })();

      const updated = await integrationService.updateIntegration(
        provider,
        {
          enabled: body.enabled,
          cacheTtlSeconds: body.cacheTtlSeconds,
          rateLimitCooldownSeconds: body.rateLimitCooldownSeconds,
          config: body.config,
          credentials: mergedCredentials,
        },
        req.user?.id
      );

      await writeAuditLog(app, req, {
        action: 'admin.integration.updated',
        entity: 'external_integration',
        entityId: updated.integrationId,
        data: {
          provider,
          enabled: body.enabled,
          cacheTtlSeconds: body.cacheTtlSeconds,
          rateLimitCooldownSeconds: body.rateLimitCooldownSeconds,
          configChanged: body.config !== undefined,
          credentialsChanged: body.credentials !== undefined,
          apiKeyChanged: body.apiKey !== undefined,
        },
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
