import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminNotificationTemplateRoutes } from './admin-notification-templates.js';
import { notificationsService } from '../services/notifications.js';

describe('Admin notification templates endpoints', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    app = Fastify();
    app.decorate('auth', {
      verifySession: vi.fn(async (req: any) => {
        req.user = { id: 'admin-id', role: 'admin' };
      }),
      requireRole: () => async () => {},
    } as any);

    await app.register(adminNotificationTemplateRoutes, { prefix: '/admin/notification-templates' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  it('lists templates', async () => {
    const templates = [
      {
        templateId: 'b3d9a9d2-3d7c-4d9b-8d8c-0f07c3e7c2f1',
        name: 'Pool Report',
        channel: 'email',
        subject: 'Weekly update',
        bodyTemplate: 'Hello {{user.name}}',
        isActive: true,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      },
    ];

    vi.spyOn(notificationsService, 'listTemplates').mockResolvedValue(templates as any);

    const response = await app.inject({
      method: 'GET',
      url: '/admin/notification-templates',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      {
        ...templates[0],
        createdAt: templates[0].createdAt.toISOString(),
      },
    ]);
  });

  it('creates a template', async () => {
    const created = {
      templateId: '0cbe0c37-9e7a-4aab-bc7a-bc631f4b7f6d',
      name: 'Alert',
      channel: 'email',
      subject: 'Heads up',
      bodyTemplate: 'Alert body',
      isActive: true,
      createdAt: new Date('2024-02-01T00:00:00.000Z'),
    };

    vi.spyOn(notificationsService, 'createTemplate').mockResolvedValue(created as any);

    const response = await app.inject({
      method: 'POST',
      url: '/admin/notification-templates',
      payload: {
        name: 'Alert',
        channel: 'email',
        subject: 'Heads up',
        bodyTemplate: 'Alert body',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      ...created,
      createdAt: created.createdAt.toISOString(),
    });
    expect(notificationsService.createTemplate).toHaveBeenCalledWith({
      name: 'Alert',
      channel: 'email',
      subject: 'Heads up',
      bodyTemplate: 'Alert body',
    });
  });

  it('updates a template', async () => {
    const updated = {
      templateId: '0cbe0c37-9e7a-4aab-bc7a-bc631f4b7f6d',
      name: 'Alert',
      channel: 'email',
      subject: 'Updated',
      bodyTemplate: 'Alert body',
      isActive: false,
      createdAt: new Date('2024-02-01T00:00:00.000Z'),
    };

    vi.spyOn(notificationsService, 'updateTemplate').mockResolvedValue(updated as any);

    const response = await app.inject({
      method: 'PATCH',
      url: `/admin/notification-templates/${updated.templateId}`,
      payload: {
        subject: 'Updated',
        isActive: false,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ...updated,
      createdAt: updated.createdAt.toISOString(),
    });
    expect(notificationsService.updateTemplate).toHaveBeenCalledWith(updated.templateId, {
      subject: 'Updated',
      isActive: false,
    });
  });
});
