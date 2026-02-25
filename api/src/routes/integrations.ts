import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { accountIntegrationsService } from '../services/account-integrations.js';
import { writeAuditLog } from './audit.js';

const providerParams = z.object({
  provider: z.string().min(1).max(64),
});

const integrationParams = z.object({
  integrationId: z.string().uuid(),
});

const integrationDeviceParams = z.object({
  integrationId: z.string().uuid(),
  deviceId: z.string().uuid(),
});

const connectBody = z
  .object({
    payload: z.record(z.unknown()).optional(),
  })
  .optional();

const callbackBody = z
  .object({
    payload: z.record(z.unknown()).optional(),
  })
  .optional();

const linkPoolBody = z.object({
  poolId: z.string().uuid(),
});

const discoverDevicesBody = z
  .object({
    payload: z.record(z.unknown()).optional(),
  })
  .optional();

const webhookBody = z
  .object({
    payload: z.record(z.unknown()).optional(),
  })
  .optional();

function handleServiceError(reply: any, error: unknown) {
  const code = (error as { code?: string })?.code;
  if (code === 'ProviderDisabled') {
    reply.code(403).send({ error: 'ProviderDisabled' });
    return true;
  }
  if (code === 'ProviderRemoved') {
    reply.code(410).send({ error: 'ProviderRemoved' });
    return true;
  }
  if (code === 'ValidationError') {
    reply.code(400).send({ error: 'ValidationError', message: (error as Error).message });
    return true;
  }
  if (code === 'Unauthorized') {
    reply.code(401).send({ error: 'Unauthorized', message: (error as Error).message });
    return true;
  }
  return false;
}

export async function integrationsRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: app.auth.verifySession }, async (req, reply) => {
    const integrations = await accountIntegrationsService.listIntegrations(req.user!.id);
    return reply.send(integrations);
  });

  app.post('/:provider/connect', { preHandler: app.auth.verifySession }, async (req, reply) => {
    try {
      const { provider } = providerParams.parse(req.params);
      const body = connectBody.parse(req.body ?? undefined);
      const integration = await accountIntegrationsService.connect(req.user!.id, provider, body);
      await writeAuditLog(app, req, {
        action: 'integration.connected',
        entity: 'integration',
        entityId: integration.integrationId,
        data: { provider },
      });
      return reply.code(201).send(integration);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: error.errors });
      }
      if (handleServiceError(reply, error)) {
        return;
      }
      throw error;
    }
  });

  app.post('/:provider/callback', { preHandler: app.auth.verifySession }, async (req, reply) => {
    try {
      const { provider } = providerParams.parse(req.params);
      const body = callbackBody.parse(req.body ?? undefined);
      const integration = await accountIntegrationsService.callback(req.user!.id, provider, body);
      await writeAuditLog(app, req, {
        action: 'integration.callback_received',
        entity: 'integration',
        entityId: integration.integrationId,
        data: { provider },
      });
      return reply.send(integration);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: error.errors });
      }
      if (handleServiceError(reply, error)) {
        return;
      }
      throw error;
    }
  });

  app.delete('/:integrationId', { preHandler: app.auth.verifySession }, async (req, reply) => {
    try {
      const { integrationId } = integrationParams.parse(req.params);
      const deleted = await accountIntegrationsService.disconnect(req.user!.id, integrationId);
      if (!deleted) {
        return reply.code(404).send({ error: 'NotFound' });
      }
      await writeAuditLog(app, req, {
        action: 'integration.disconnected',
        entity: 'integration',
        entityId: integrationId,
      });
      return reply.code(204).send();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: error.errors });
      }
      throw error;
    }
  });

  app.get('/:integrationId/devices', { preHandler: app.auth.verifySession }, async (req, reply) => {
    try {
      const { integrationId } = integrationParams.parse(req.params);
      const devices = await accountIntegrationsService.listDevices(req.user!.id, integrationId);
      if (devices === null) {
        return reply.code(404).send({ error: 'NotFound' });
      }
      return reply.send(devices);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: error.errors });
      }
      throw error;
    }
  });

  app.post(
    '/:integrationId/devices/:deviceId/link-pool',
    { preHandler: app.auth.verifySession },
    async (req, reply) => {
    try {
      const { integrationId, deviceId } = integrationDeviceParams.parse(req.params);
      const body = linkPoolBody.parse(req.body ?? {});
      const linked = await accountIntegrationsService.linkDeviceToPool(
        req.user!.id,
        integrationId,
        deviceId,
        body
      );
      if (!linked) {
        return reply.code(404).send({ error: 'NotFound' });
      }
      await writeAuditLog(app, req, {
        action: 'integration.device.linked_pool',
        entity: 'integration_device',
        entityId: deviceId,
        poolId: body.poolId,
        data: { integrationId, deviceId, poolId: body.poolId },
      });
      return reply.send(linked);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: error.errors });
      }
      throw error;
    }
    }
  );

  app.post(
    '/:integrationId/devices/discover',
    { preHandler: app.auth.verifySession },
    async (req, reply) => {
      try {
        const { integrationId } = integrationParams.parse(req.params);
        const body = discoverDevicesBody.parse(req.body ?? undefined);
        const devices = await accountIntegrationsService.discoverDevices(
          req.user!.id,
          integrationId,
          body?.payload
        );
        if (devices === null) {
          return reply.code(404).send({ error: 'NotFound' });
        }
        await writeAuditLog(app, req, {
          action: 'integration.devices.discovered',
          entity: 'integration',
          entityId: integrationId,
          data: { discoveredCount: devices.length },
        });
        return reply.send({ items: devices });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: 'ValidationError', details: error.errors });
        }
        if (handleServiceError(reply, error)) {
          return;
        }
        throw error;
      }
    }
  );

  app.post('/:provider/webhook', async (req, reply) => {
    try {
      const { provider } = providerParams.parse(req.params);
      const body = webhookBody.parse(req.body ?? undefined);
      const signature = req.headers['x-integration-signature'];

      const result = await accountIntegrationsService.ingestWebhook(provider, {
        headers: {
          'x-integration-signature': Array.isArray(signature) ? signature[0] : signature ?? undefined,
        },
        payload: body?.payload,
      });
      if ('queuedForRetry' in result && result.queuedForRetry) {
        await writeAuditLog(app, req, {
          action: 'integration.webhook.queued_retry',
          entity: 'integration_provider',
          entityId: provider,
          data: { failureId: result.failureId },
        });
      }
      await writeAuditLog(app, req, {
        action: 'integration.webhook.received',
        entity: 'integration_provider',
        entityId: provider,
        data: { ingested: result.ingested, accepted: result.accepted },
      });
      return reply.send(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: error.errors });
      }
      if (handleServiceError(reply, error)) {
        return;
      }
      throw error;
    }
  });
}
