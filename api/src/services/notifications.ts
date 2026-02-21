import { db as dbClient } from '../db/index.js';
import * as schema from '../db/schema/index.js';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';

export type NotificationChannel = 'email' | 'sms' | 'push' | 'in_app';

export interface NotificationTemplateInput {
  name: string;
  channel: NotificationChannel;
  subject?: string;
  bodyTemplate: string;
  isActive?: boolean;
}

export interface NotificationTemplateUpdate {
  name?: string;
  channel?: NotificationChannel;
  subject?: string;
  bodyTemplate?: string;
  isActive?: boolean;
}

const resolveTemplateValue = (data: Record<string, unknown>, path: string) => {
  const segments = path.split('.').map((segment) => segment.trim()).filter(Boolean);
  let current: unknown = data;
  for (const segment of segments) {
    if (current && typeof current === 'object' && segment in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[segment];
    } else {
      return '';
    }
  }
  if (current === null || current === undefined) return '';
  return String(current);
};

const renderTemplateString = (template: string, data: Record<string, unknown>) =>
  template.replace(/{{\s*([^}]+)\s*}}/g, (_match, token) => resolveTemplateValue(data, token));

export class NotificationsService {
  constructor(private readonly db = dbClient) {}

  async listUserNotifications(
    userId: string,
    options: { page?: number; pageSize?: number; unreadOnly?: boolean } = {}
  ) {
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
    const unreadOnly = options.unreadOnly ?? false;
    const offset = (page - 1) * pageSize;
    const whereClause = unreadOnly
      ? and(eq(schema.notifications.userId, userId), isNull(schema.notifications.readAt))
      : eq(schema.notifications.userId, userId);

    const [totalRow, unreadRow, items] = await Promise.all([
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.notifications)
        .where(whereClause)
        .then((rows) => rows[0]),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.notifications)
        .where(and(eq(schema.notifications.userId, userId), isNull(schema.notifications.readAt)))
        .then((rows) => rows[0]),
      this.db
        .select({
          notificationId: schema.notifications.notificationId,
          userId: schema.notifications.userId,
          poolId: schema.notifications.poolId,
          templateId: schema.notifications.templateId,
          channel: schema.notifications.channel,
          title: schema.notifications.title,
          message: schema.notifications.message,
          data: schema.notifications.data,
          status: schema.notifications.status,
          sentAt: schema.notifications.sentAt,
          deliveredAt: schema.notifications.deliveredAt,
          readAt: schema.notifications.readAt,
          createdAt: schema.notifications.createdAt,
        })
        .from(schema.notifications)
        .where(whereClause)
        .orderBy(desc(schema.notifications.createdAt))
        .limit(pageSize)
        .offset(offset),
    ]);

    const total = Number(totalRow?.count ?? 0);
    const unreadCount = Number(unreadRow?.count ?? 0);

    return {
      items,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      unreadCount,
    };
  }

  async getUnreadCount(userId: string) {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.notifications)
      .where(and(eq(schema.notifications.userId, userId), isNull(schema.notifications.readAt)));
    return Number(row?.count ?? 0);
  }

  async markNotificationRead(userId: string, notificationId: string) {
    const [updated] = await this.db
      .update(schema.notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(schema.notifications.notificationId, notificationId),
          eq(schema.notifications.userId, userId),
          isNull(schema.notifications.readAt)
        )
      )
      .returning({ notificationId: schema.notifications.notificationId, readAt: schema.notifications.readAt });

    return updated ?? null;
  }

  async markAllRead(userId: string) {
    const updated = await this.db
      .update(schema.notifications)
      .set({ readAt: new Date() })
      .where(and(eq(schema.notifications.userId, userId), isNull(schema.notifications.readAt)))
      .returning({ notificationId: schema.notifications.notificationId });
    return { updatedCount: updated.length };
  }

  async listTemplates() {
    return this.db
      .select()
      .from(schema.notificationTemplates)
      .orderBy(schema.notificationTemplates.name);
  }

  async createTemplate(data: NotificationTemplateInput) {
    const [template] = await this.db
      .insert(schema.notificationTemplates)
      .values({
        name: data.name,
        channel: data.channel,
        subject: data.subject,
        bodyTemplate: data.bodyTemplate,
        isActive: data.isActive ?? true,
      })
      .returning();

    return template;
  }

  async updateTemplate(templateId: string, data: NotificationTemplateUpdate) {
    const [template] = await this.db
      .update(schema.notificationTemplates)
      .set({
        name: data.name,
        channel: data.channel,
        subject: data.subject,
        bodyTemplate: data.bodyTemplate,
        isActive: data.isActive,
      })
      .where(eq(schema.notificationTemplates.templateId, templateId))
      .returning();

    return template ?? null;
  }

  async getTemplate(templateId: string) {
    const [template] = await this.db
      .select()
      .from(schema.notificationTemplates)
      .where(eq(schema.notificationTemplates.templateId, templateId));

    return template ?? null;
  }

  async renderPreview(options: {
    templateId?: string;
    inline?: { subject?: string; body: string };
    data: Record<string, unknown>;
  }) {
    if (options.templateId) {
      const template = await this.getTemplate(options.templateId);
      if (!template) {
        throw new Error('Template not found');
      }
      return {
        subject: template.subject ? renderTemplateString(template.subject, options.data) : null,
        body: renderTemplateString(template.bodyTemplate, options.data),
      };
    }

    if (options.inline) {
      return {
        subject: options.inline.subject
          ? renderTemplateString(options.inline.subject, options.data)
          : null,
        body: renderTemplateString(options.inline.body, options.data),
      };
    }

    throw new Error('Template source required');
  }
}

export const notificationsService = new NotificationsService();
