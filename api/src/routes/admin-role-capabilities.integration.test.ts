import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminRoleCapabilitiesRoutes } from './admin-role-capabilities.js';
import { roleCapabilityTemplatesService } from '../services/role-capability-templates.js';

describe('admin role capabilities routes', () => {
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

    await app.register(adminRoleCapabilitiesRoutes, { prefix: '/admin/role-capabilities' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  it('lists role templates and available capability registry', async () => {
    vi.spyOn(roleCapabilityTemplatesService, 'listTemplates').mockResolvedValue([
      {
        role: 'admin',
        systemCapabilities: ['admin.audit.read'],
        accountCapabilities: ['account.profile.read'],
      },
    ] as any);

    const response = await app.inject({ method: 'GET', url: '/admin/role-capabilities' });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.roles).toHaveLength(1);
    expect(body.roles[0].role).toBe('admin');
    expect(Array.isArray(body.available.systemCapabilities)).toBe(true);
    expect(Array.isArray(body.available.accountCapabilities)).toBe(true);
  });

  it('updates capabilities for a role', async () => {
    const updateSpy = vi.spyOn(roleCapabilityTemplatesService, 'updateTemplate').mockResolvedValue({
      role: 'business',
      systemCapabilities: ['admin.pools.manage'],
      accountCapabilities: ['account.profile.read', 'messages.send'],
    } as any);
    vi.spyOn(roleCapabilityTemplatesService, 'listTemplates').mockResolvedValue([
      {
        role: 'admin',
        systemCapabilities: ['admin.users.read'],
        accountCapabilities: ['account.profile.read'],
      },
      {
        role: 'business',
        systemCapabilities: ['admin.pools.manage'],
        accountCapabilities: ['account.profile.read', 'messages.send'],
      },
      {
        role: 'member',
        systemCapabilities: [],
        accountCapabilities: ['messages.read'],
      },
    ] as any);

    const response = await app.inject({
      method: 'PATCH',
      url: '/admin/role-capabilities/business',
      payload: {
        systemCapabilities: ['admin.pools.manage'],
        accountCapabilities: ['account.profile.read', 'messages.send'],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(updateSpy).toHaveBeenCalledWith('business', {
      systemCapabilities: ['admin.pools.manage'],
      accountCapabilities: ['account.profile.read', 'messages.send'],
    });
    expect(response.json().role).toBe('business');
  });

  it('validates patch payloads', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/admin/role-capabilities/admin',
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe('ValidationError');
  });
});
