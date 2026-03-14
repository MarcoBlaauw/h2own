import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { messagesRoutes } from './messages.js';
import { billingRoutes } from './billing.js';
import { billingService } from '../services/billing.js';
import { messagesService } from '../services/messages.js';

describe('Messages and billing endpoints', () => {
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

  it('lists threads with pagination query', async () => {
    vi.spyOn(messagesService, 'listThreads').mockResolvedValue({
      items: [{ threadId: 'thread-1', unreadCount: 2 }],
      nextCursor: 'cursor-1',
    } as any);

    const response = await app.inject({ method: 'GET', url: '/messages?limit=10&unreadOnly=true' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ nextCursor: 'cursor-1' });
  });

  it('returns billing summary for member and rejects portal session manage action', async () => {
    vi.spyOn(billingService, 'getSummary').mockResolvedValue({
      featureStatus: 'hooked',
      provider: null,
      plan: { tier: 'free', isPaid: false },
      status: 'active',
      paymentStatus: 'unpaid',
      invoices: [],
      capabilities: { read: true, manage: false },
    });

    const summaryRes = await app.inject({ method: 'GET', url: '/billing/summary' });
    const portalRes = await app.inject({ method: 'POST', url: '/billing/portal-session' });

    expect(summaryRes.statusCode).toBe(200);
    expect(portalRes.statusCode).toBe(403);
  });

  it('creates portal session for billing manager roles', async () => {
    (app.auth.verifySession as any).mockImplementationOnce(async (req: any) => {
      req.user = { id: 'business-id', role: 'business' };
    });
    vi.spyOn(billingService, 'createPortalSession').mockResolvedValue({
      ok: true,
      featureStatus: 'hooked',
      url: 'https://billing.example/portal/session',
      message: 'Billing portal session created.',
    } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/billing/portal-session',
      payload: { returnUrl: 'http://localhost:3000/billing' },
    });

    expect(response.statusCode).toBe(200);
    expect(billingService.createPortalSession).toHaveBeenCalledWith('business-id', 'http://localhost:3000/billing');
  });

  it('ingests webhook payload', async () => {
    vi.spyOn(billingService, 'ingestSubscriptionWebhook').mockResolvedValue({ ok: true } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/billing/webhook',
      payload: {
        userId: '2ed4cad6-b10a-4eeb-8dce-a9295f45f03c',
        tier: 'pro',
        status: 'active',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(billingService.ingestSubscriptionWebhook).toHaveBeenCalled();
  });
});
