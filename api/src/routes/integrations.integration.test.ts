import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { integrationsRoutes } from './integrations.js';
import { accountIntegrationsService } from '../services/account-integrations.js';

describe('integrations routes', () => {
  let app: ReturnType<typeof Fastify>;
  const currentUserId = 'f2081cbc-3d8d-48fb-86cc-1315d5cba29f';

  beforeEach(async () => {
    app = Fastify();
    app.decorate('auth', {
      verifySession: vi.fn(async (req: any) => {
        req.user = { id: currentUserId, role: 'member' };
      }),
      requireRole: () => async () => {},
    } as any);
    app.decorate('audit', {
      log: vi.fn(async () => {}),
    } as any);

    await app.register(integrationsRoutes, { prefix: '/integrations' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  it('lists user integrations', async () => {
    vi.spyOn(accountIntegrationsService, 'listIntegrations').mockResolvedValue([
      {
        integrationId: 'a52de42f-1c3f-4367-9ca9-799768d29f1c',
        userId: currentUserId,
        provider: 'weather_station',
        status: 'connected',
        scopes: ['read'],
        externalAccountId: 'acct-1',
        createdAt: new Date('2026-02-22T09:00:00.000Z'),
        updatedAt: new Date('2026-02-22T10:00:00.000Z'),
      },
    ] as any);

    const response = await app.inject({ method: 'GET', url: '/integrations' });
    expect(response.statusCode).toBe(200);
    expect(accountIntegrationsService.listIntegrations).toHaveBeenCalledWith(currentUserId);
  });

  it('connects an integration provider', async () => {
    vi.spyOn(accountIntegrationsService, 'connect').mockResolvedValue({
      integrationId: 'a52de42f-1c3f-4367-9ca9-799768d29f1c',
      userId: currentUserId,
      provider: 'weather_station',
      status: 'connected',
    } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/integrations/weather_station/connect',
      payload: { payload: { externalAccountId: 'acct-1' } },
    });
    expect(response.statusCode).toBe(201);
    expect(accountIntegrationsService.connect).toHaveBeenCalledWith(currentUserId, 'weather_station', {
      payload: { externalAccountId: 'acct-1' },
    });
  });

  it('returns not found when integration devices are inaccessible', async () => {
    vi.spyOn(accountIntegrationsService, 'listDevices').mockResolvedValue(null);
    const response = await app.inject({
      method: 'GET',
      url: '/integrations/3ef2d491-9d4f-4d7f-8f59-cc1dd861a4c1/devices',
    });
    expect(response.statusCode).toBe(404);
  });

  it('links a discovered device to a pool', async () => {
    vi.spyOn(accountIntegrationsService, 'linkDeviceToPool').mockResolvedValue({
      deviceId: '95e6ff79-fc2b-41ac-8e49-4d8ddf8bcf01',
      poolId: 'a9388c9e-df46-4bb5-94e4-6ecf8a4860a7',
      status: 'linked',
    } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/integrations/3ef2d491-9d4f-4d7f-8f59-cc1dd861a4c1/devices/95e6ff79-fc2b-41ac-8e49-4d8ddf8bcf01/link-pool',
      payload: { poolId: 'a9388c9e-df46-4bb5-94e4-6ecf8a4860a7' },
    });
    expect(response.statusCode).toBe(200);
    expect(accountIntegrationsService.linkDeviceToPool).toHaveBeenCalledWith(
      currentUserId,
      '3ef2d491-9d4f-4d7f-8f59-cc1dd861a4c1',
      '95e6ff79-fc2b-41ac-8e49-4d8ddf8bcf01',
      { poolId: 'a9388c9e-df46-4bb5-94e4-6ecf8a4860a7' }
    );
  });

  it('discovers integration devices and returns list payload', async () => {
    vi.spyOn(accountIntegrationsService, 'discoverDevices').mockResolvedValue([
      {
        deviceId: '95e6ff79-fc2b-41ac-8e49-4d8ddf8bcf01',
        providerDeviceId: 'ws-001',
        deviceType: 'weather_station',
        label: 'Backyard Sensor',
        status: 'discovered',
      },
    ] as any);

    const response = await app.inject({
      method: 'POST',
      url: '/integrations/3ef2d491-9d4f-4d7f-8f59-cc1dd861a4c1/devices/discover',
      payload: {
        payload: {
          devices: [{ providerDeviceId: 'ws-001', deviceType: 'weather_station', label: 'Backyard Sensor' }],
        },
      },
    });
    expect(response.statusCode).toBe(200);
    expect(accountIntegrationsService.discoverDevices).toHaveBeenCalledWith(
      currentUserId,
      '3ef2d491-9d4f-4d7f-8f59-cc1dd861a4c1',
      {
        devices: [{ providerDeviceId: 'ws-001', deviceType: 'weather_station', label: 'Backyard Sensor' }],
      }
    );
    expect(response.json().items).toHaveLength(1);
  });

  it('rejects webhook without signature', async () => {
    const error = new Error('Missing webhook signature') as Error & { code?: string };
    error.code = 'Unauthorized';
    vi.spyOn(accountIntegrationsService, 'ingestWebhook').mockRejectedValueOnce(error);
    const response = await app.inject({
      method: 'POST',
      url: '/integrations/weather_station/webhook',
      payload: { payload: { readings: [] } },
    });
    expect(response.statusCode).toBe(401);
  });

  it('accepts webhook with signature', async () => {
    vi.spyOn(accountIntegrationsService, 'ingestWebhook').mockResolvedValue({
      accepted: true,
      ingested: 1,
    });
    const response = await app.inject({
      method: 'POST',
      url: '/integrations/weather_station/webhook',
      headers: {
        'x-integration-signature': 'sig-123',
      },
      payload: { payload: { readings: [{ providerDeviceId: 'dev-1', metric: 'temp_f', value: 82 }] } },
    });
    expect(response.statusCode).toBe(200);
    expect(accountIntegrationsService.ingestWebhook).toHaveBeenCalledWith('weather_station', {
      headers: { 'x-integration-signature': 'sig-123' },
      payload: { readings: [{ providerDeviceId: 'dev-1', metric: 'temp_f', value: 82 }] },
    });
  });

  it('returns queued-for-retry payload when ingestion is dead-lettered', async () => {
    vi.spyOn(accountIntegrationsService, 'ingestWebhook').mockResolvedValue({
      accepted: false,
      ingested: 0,
      queuedForRetry: true,
      failureId: 42,
    } as any);
    const response = await app.inject({
      method: 'POST',
      url: '/integrations/weather_station/webhook',
      headers: {
        'x-integration-signature': 'sig-123',
      },
      payload: { payload: { readings: [] } },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      accepted: false,
      ingested: 0,
      queuedForRetry: true,
      failureId: 42,
    });
    const auditLog = (app as any).audit.log;
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'integration.webhook.queued_retry',
        entity: 'integration_provider',
        entityId: 'weather_station',
        data: { failureId: 42 },
      })
    );
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'integration.webhook.received',
        entity: 'integration_provider',
        entityId: 'weather_station',
        data: { ingested: 0, accepted: false },
      })
    );
  });

  it('maps removed provider service errors to 410', async () => {
    const error = new Error('Provider govee has been removed') as Error & { code?: string };
    error.code = 'ProviderRemoved';
    vi.spyOn(accountIntegrationsService, 'connect').mockRejectedValueOnce(error);

    const response = await app.inject({
      method: 'POST',
      url: '/integrations/govee/connect',
      payload: { payload: { externalAccountId: 'acct-1' } },
    });
    expect(response.statusCode).toBe(410);
    expect(response.json()).toEqual({ error: 'ProviderRemoved' });
  });

  it('maps validation service errors to 400', async () => {
    const error = new Error('Invalid payload') as Error & { code?: string };
    error.code = 'ValidationError';
    vi.spyOn(accountIntegrationsService, 'connect').mockRejectedValueOnce(error);

    const response = await app.inject({
      method: 'POST',
      url: '/integrations/weather_station/connect',
      payload: { payload: { invalid: true } },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: 'ValidationError',
      message: 'Invalid payload',
    });
  });
});
