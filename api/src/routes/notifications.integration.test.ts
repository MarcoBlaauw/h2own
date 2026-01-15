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
});
