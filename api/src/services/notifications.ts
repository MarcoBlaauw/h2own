import { db as dbClient } from '../db/index.js';
import * as schema from '../db/schema/index.js';
import { eq } from 'drizzle-orm';

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
