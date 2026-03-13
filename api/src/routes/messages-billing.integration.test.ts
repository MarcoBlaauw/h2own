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

    const response = await app.inject({
      method: 'GET',
      url: '/messages?limit=10&unreadOnly=true',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ nextCursor: 'cursor-1' });
    expect(messagesService.listThreads).toHaveBeenCalledWith('member-id', {
      limit: 10,
      unreadOnly: true,
    });
  });

  it('returns thread and paginated messages', async () => {
    vi.spyOn(messagesService, 'getThread').mockResolvedValue({ threadId: 'thread-1' } as any);
    vi.spyOn(messagesService, 'listMessages').mockResolvedValue({ items: [], nextCursor: null } as any);

    const response = await app.inject({
      method: 'GET',
      url: '/messages/2ed4cad6-b10a-4eeb-8dce-a9295f45f03c?limit=25',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ thread: { threadId: 'thread-1' }, messages: { items: [] } });
  });

  it('creates a thread', async () => {
    vi.spyOn(messagesService, 'createThread').mockResolvedValue({
      thread: { threadId: 'thread-1', poolId: null },
      message: { messageId: 1 },
      participantCount: 2,
    } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/messages/threads',
      payload: {
        participantIds: ['2ed4cad6-b10a-4eeb-8dce-a9295f45f03c'],
        initialMessage: { body: 'hello' },
      },
    });

    expect(response.statusCode).toBe(201);
    expect(messagesService.createThread).toHaveBeenCalled();
  });

  it('sends a message for thread member', async () => {
    vi.spyOn(messagesService, 'sendMessage').mockResolvedValue({
      message: { messageId: 99, body: 'ping' },
      recipientCount: 1,
    } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/messages/2ed4cad6-b10a-4eeb-8dce-a9295f45f03c/messages',
      payload: { body: 'ping' },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ recipientCount: 1 });
  });

  it('marks thread as read', async () => {
    vi.spyOn(messagesService, 'markThreadRead').mockResolvedValue({
      threadId: '2ed4cad6-b10a-4eeb-8dce-a9295f45f03c',
    } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/messages/2ed4cad6-b10a-4eeb-8dce-a9295f45f03c/read',
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().ok).toBe(true);
  });

  it('enforces capability checks and validation', async () => {
    (app.auth.verifySession as any).mockImplementationOnce(async (req: any) => {
      req.user = { id: 'member-id', role: 'guest' };
    });

    const forbidden = await app.inject({ method: 'GET', url: '/messages' });
    expect(forbidden.statusCode).toBe(403);

    const invalid = await app.inject({
      method: 'POST',
      url: '/messages/threads',
      payload: { participantIds: [], initialMessage: { body: '' } },
    });
    expect(invalid.statusCode).toBe(400);
  });

  it('returns billing summary for member and rejects portal session manage action', async () => {
    vi.spyOn(billingService, 'getSummary').mockResolvedValue({
      featureStatus: 'hooked',
      plan: {
        tier: 'free',
        isPaid: false,
      },
      status: 'active',
      capabilities: {
        read: true,
        manage: false,
      },
    });

    const summaryRes = await app.inject({
      method: 'GET',
      url: '/billing/summary',
    });
    expect(summaryRes.statusCode).toBe(200);

    const portalRes = await app.inject({
      method: 'POST',
      url: '/billing/portal-session',
    });
    expect(portalRes.statusCode).toBe(403);
  });
});
