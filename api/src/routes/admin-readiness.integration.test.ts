import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminReadinessRoutes } from './admin-readiness.js';

describe('Admin readiness route', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    app = Fastify();
    app.decorate('auth', {
      verifySession: vi.fn(async (req: any) => {
        req.user = { id: 'admin-id', role: 'admin' };
      }),
      requireRole: () => async () => {},
    } as any);

    await app.register(adminReadinessRoutes, { prefix: '/admin/readiness' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  it('returns readiness modules', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/admin/readiness',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(Array.isArray(body.modules)).toBe(true);
    expect(body.modules.map((m: any) => m.key)).toEqual(
      expect.arrayContaining(['messages', 'billing', 'notifications'])
    );
  });
});
