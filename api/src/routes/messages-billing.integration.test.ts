import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { messagesRoutes } from './messages.js';
import { billingRoutes } from './billing.js';

describe('Messages and billing placeholder endpoints', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    app = Fastify();
    app.decorate('auth', {
      verifySession: vi.fn(async (req: any) => {
        req.user = { id: 'member-id', role: 'member' };
      }),
      requireRole: () => async () => {},
    } as any);

    await app.register(messagesRoutes, { prefix: '/messages' });
    await app.register(billingRoutes, { prefix: '/billing' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  it('returns messages placeholder payload', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/messages',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      featureStatus: 'placeholder',
      conversations: [],
      capabilities: { read: true, send: true },
    });
  });

  it('accepts placeholder send message request', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/messages/send',
      payload: {
        recipientUserId: '2ed4cad6-b10a-4eeb-8dce-a9295f45f03c',
        body: 'hello',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      featureStatus: 'placeholder',
    });
  });

  it('returns billing summary for member and rejects portal session manage action', async () => {
    const summaryRes = await app.inject({
      method: 'GET',
      url: '/billing/summary',
    });
    expect(summaryRes.statusCode).toBe(200);
    expect(summaryRes.json()).toMatchObject({
      featureStatus: 'placeholder',
      capabilities: { read: true, manage: false },
    });

    const portalRes = await app.inject({
      method: 'POST',
      url: '/billing/portal-session',
    });
    expect(portalRes.statusCode).toBe(403);
  });
});
