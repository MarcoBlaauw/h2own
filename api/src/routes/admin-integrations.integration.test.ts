import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminIntegrationsRoutes } from './admin-integrations.js';
import { integrationService } from '../services/integrations.js';

describe('admin integrations routes', () => {
  let app: ReturnType<typeof Fastify>;
  const currentUserId = 'f2081cbc-3d8d-48fb-86cc-1315d5cba29f';

  beforeEach(async () => {
    app = Fastify();
    app.decorate('auth', {
      verifySession: vi.fn(async (req: any) => {
        req.user = { id: currentUserId, role: 'admin' };
      }),
      requireRole: () => async () => {},
    } as any);
    app.decorate('audit', {
      log: vi.fn(async () => {}),
    } as any);

    await app.register(adminIntegrationsRoutes, { prefix: '/admin/integrations' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  it('lists integrations for admins', async () => {
    vi.spyOn(integrationService, 'listIntegrations').mockResolvedValue([
      {
        integrationId: 'a52de42f-1c3f-4367-9ca9-799768d29f1c',
        provider: 'tomorrow_io',
        displayName: 'Tomorrow.io',
        enabled: true,
        cacheTtlSeconds: 1800,
        rateLimitCooldownSeconds: 300,
        config: { baseUrl: 'https://api.tomorrow.io/v4' },
        credentials: { hasApiKey: true, apiKeyPreview: 'ABCD****YZ' },
        lastResponseCode: 200,
        lastResponseText: 'ok',
        lastResponseAt: new Date('2026-02-20T10:00:00.000Z'),
        lastSuccessAt: new Date('2026-02-20T10:00:00.000Z'),
        nextAllowedRequestAt: null,
        updatedBy: currentUserId,
        createdAt: new Date('2026-02-20T09:00:00.000Z'),
        updatedAt: new Date('2026-02-20T10:00:00.000Z'),
      },
    ] as any);

    const response = await app.inject({ method: 'GET', url: '/admin/integrations' });
    expect(response.statusCode).toBe(200);
    expect(response.json()[0].provider).toBe('tomorrow_io');
    expect(response.json()[0].credentials).toEqual({ hasApiKey: true, apiKeyPreview: 'ABCD****YZ' });
  });

  it('updates integration settings and key metadata', async () => {
    const updateSpy = vi.spyOn(integrationService, 'updateIntegration').mockResolvedValue({
      integrationId: 'a52de42f-1c3f-4367-9ca9-799768d29f1c',
      provider: 'tomorrow_io',
      displayName: 'Tomorrow.io',
      enabled: true,
      cacheTtlSeconds: 3600,
      rateLimitCooldownSeconds: 900,
      config: { baseUrl: 'https://api.tomorrow.io/v4' },
      credentials: { hasApiKey: true, apiKeyPreview: 'ABCD****YZ' },
      lastResponseCode: 200,
      lastResponseText: 'ok',
      lastResponseAt: new Date('2026-02-20T10:00:00.000Z'),
      lastSuccessAt: new Date('2026-02-20T10:00:00.000Z'),
      nextAllowedRequestAt: null,
      updatedBy: currentUserId,
      createdAt: new Date('2026-02-20T09:00:00.000Z'),
      updatedAt: new Date('2026-02-20T10:05:00.000Z'),
    } as any);

    const response = await app.inject({
      method: 'PATCH',
      url: '/admin/integrations/tomorrow_io',
      payload: {
        cacheTtlSeconds: 3600,
        rateLimitCooldownSeconds: 900,
        apiKey: 'abc123secret',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(updateSpy).toHaveBeenCalledWith(
      'tomorrow_io',
      expect.objectContaining({
        cacheTtlSeconds: 3600,
        rateLimitCooldownSeconds: 900,
        credentials: { apiKey: 'abc123secret' },
      }),
      currentUserId
    );
  });
});
