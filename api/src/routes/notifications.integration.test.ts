import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { notificationRoutes } from './notifications.js';
import { notificationsService } from '../services/notifications.js';

describe('Notifications preview endpoint', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    app = Fastify();
    app.decorate('auth', {
      verifySession: vi.fn(async (req: any) => {
        req.user = { id: 'admin-id', role: 'admin' };
      }),
      requireRole: () => async () => {},
    } as any);

    await app.register(notificationRoutes, { prefix: '/notifications' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  it('renders a preview from templateId', async () => {
    vi.spyOn(notificationsService, 'renderPreview').mockResolvedValue({
      subject: 'Pool update',
      body: 'Hello Jordan',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/notifications/preview',
      payload: {
        templateId: 'adca0bda-7b43-4d50-905d-9606a5a4e74e',
        data: { user: { name: 'Jordan' } },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ subject: 'Pool update', body: 'Hello Jordan' });
    expect(notificationsService.renderPreview).toHaveBeenCalledWith({
      templateId: 'adca0bda-7b43-4d50-905d-9606a5a4e74e',
      inline: undefined,
      data: { user: { name: 'Jordan' } },
    });
  });

  it('renders a preview from inline content', async () => {
    vi.spyOn(notificationsService, 'renderPreview').mockResolvedValue({
      subject: 'Inline',
      body: 'Inline body',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/notifications/preview',
      payload: {
        inline: { subject: 'Inline', body: 'Inline body' },
        data: {},
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ subject: 'Inline', body: 'Inline body' });
  });

  it('lists current user notifications', async () => {
    vi.spyOn(notificationsService, 'listUserNotifications').mockResolvedValue({
      items: [
        {
          notificationId: '9d99b419-f96f-48ba-a4f6-72bbba706f40',
          message: 'Pool alert',
          readAt: null,
        },
      ] as any,
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
      unreadCount: 1,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/notifications?unreadOnly=true',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      total: 1,
      unreadCount: 1,
    });
    expect(notificationsService.listUserNotifications).toHaveBeenCalledWith('admin-id', {
      unreadOnly: true,
    });
  });

  it('returns notifications summary', async () => {
    vi.spyOn(notificationsService, 'getUnreadCount').mockResolvedValue(3);
    const response = await app.inject({ method: 'GET', url: '/notifications/summary' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ unreadCount: 3 });
  });

  it('marks one notification as read', async () => {
    vi.spyOn(notificationsService, 'markNotificationRead').mockResolvedValue({
      notificationId: '9d99b419-f96f-48ba-a4f6-72bbba706f40',
      readAt: new Date().toISOString(),
    } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/notifications/9d99b419-f96f-48ba-a4f6-72bbba706f40/read',
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().ok).toBe(true);
  });

  it('marks all notifications as read', async () => {
    vi.spyOn(notificationsService, 'markAllRead').mockResolvedValue({ updatedCount: 4 });

    const response = await app.inject({
      method: 'POST',
      url: '/notifications/read-all',
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, updatedCount: 4 });
  });
});
