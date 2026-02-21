import { eq } from 'drizzle-orm';
import { db as dbClient } from '../db/index.js';
import * as schema from '../db/schema/index.js';

export type PreferencesData = {
  userId: string;
  theme: 'light' | 'dark' | 'system';
  temperatureUnit: 'F' | 'C';
  measurementSystem: 'imperial' | 'metric';
  currency: string;
  preferredPoolTemp: number | null;
  notificationEmailEnabled: boolean;
  notificationSmsEnabled: boolean;
  notificationPushEnabled: boolean;
  notificationEmailAddress: string | null;
};

export type UpdatePreferencesData = Partial<Omit<PreferencesData, 'userId'>>;

const defaultPreferences = (userId: string, email: string): PreferencesData => ({
  userId,
  theme: 'light',
  temperatureUnit: 'F',
  measurementSystem: 'imperial',
  currency: 'USD',
  preferredPoolTemp: null,
  notificationEmailEnabled: true,
  notificationSmsEnabled: false,
  notificationPushEnabled: false,
  notificationEmailAddress: email,
});

const normalizeCurrency = (value: string | undefined) => {
  if (!value) return undefined;
  return value.trim().toUpperCase();
};

const normalizeEmail = (value: string | null | undefined) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

export class PreferencesService {
  constructor(private readonly db = dbClient) {}

  async getPreferences(userId: string): Promise<PreferencesData | null> {
    const [user] = await this.db
      .select({ userId: schema.users.userId, email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.userId, userId))
      .limit(1);

    if (!user) return null;

    const [row] = await this.db
      .select({
        userId: schema.userPreferences.userId,
        theme: schema.userPreferences.theme,
        temperatureUnit: schema.userPreferences.temperatureUnit,
        measurementSystem: schema.userPreferences.measurementSystem,
        currency: schema.userPreferences.currency,
        preferredPoolTemp: schema.userPreferences.preferredPoolTemp,
        notificationEmailEnabled: schema.userPreferences.notificationEmailEnabled,
        notificationSmsEnabled: schema.userPreferences.notificationSmsEnabled,
        notificationPushEnabled: schema.userPreferences.notificationPushEnabled,
        notificationEmailAddress: schema.userPreferences.notificationEmailAddress,
      })
      .from(schema.userPreferences)
      .where(eq(schema.userPreferences.userId, userId))
      .limit(1);

    if (!row) return defaultPreferences(userId, user.email);

    return {
      userId: row.userId,
      theme: (row.theme as PreferencesData['theme']) ?? 'light',
      temperatureUnit: (row.temperatureUnit as PreferencesData['temperatureUnit']) ?? 'F',
      measurementSystem: (row.measurementSystem as PreferencesData['measurementSystem']) ?? 'imperial',
      currency: row.currency ?? 'USD',
      preferredPoolTemp: row.preferredPoolTemp === null ? null : Number(row.preferredPoolTemp),
      notificationEmailEnabled: row.notificationEmailEnabled ?? true,
      notificationSmsEnabled: row.notificationSmsEnabled ?? false,
      notificationPushEnabled: row.notificationPushEnabled ?? false,
      notificationEmailAddress: row.notificationEmailAddress ?? user.email,
    };
  }

  async updatePreferences(userId: string, data: UpdatePreferencesData): Promise<PreferencesData | null> {
    const current = await this.getPreferences(userId);
    if (!current) return null;

    const merged: PreferencesData = {
      ...current,
      ...data,
      currency: normalizeCurrency(data.currency) ?? current.currency,
      notificationEmailAddress: normalizeEmail(data.notificationEmailAddress) ?? current.notificationEmailAddress,
    };

    const [existing] = await this.db
      .select({ userId: schema.userPreferences.userId })
      .from(schema.userPreferences)
      .where(eq(schema.userPreferences.userId, userId))
      .limit(1);

    if (existing) {
      await this.db
        .update(schema.userPreferences)
        .set({
          theme: merged.theme,
          temperatureUnit: merged.temperatureUnit,
          measurementSystem: merged.measurementSystem,
          currency: merged.currency,
          preferredPoolTemp: merged.preferredPoolTemp === null ? null : String(merged.preferredPoolTemp),
          notificationEmailEnabled: merged.notificationEmailEnabled,
          notificationSmsEnabled: merged.notificationSmsEnabled,
          notificationPushEnabled: merged.notificationPushEnabled,
          notificationEmailAddress: merged.notificationEmailAddress,
          updatedAt: new Date(),
        })
        .where(eq(schema.userPreferences.userId, userId));
    } else {
      await this.db.insert(schema.userPreferences).values({
        userId,
        theme: merged.theme,
        temperatureUnit: merged.temperatureUnit,
        measurementSystem: merged.measurementSystem,
        currency: merged.currency,
        preferredPoolTemp: merged.preferredPoolTemp === null ? null : String(merged.preferredPoolTemp),
        notificationEmailEnabled: merged.notificationEmailEnabled,
        notificationSmsEnabled: merged.notificationSmsEnabled,
        notificationPushEnabled: merged.notificationPushEnabled,
        notificationEmailAddress: merged.notificationEmailAddress,
      });
    }

    return this.getPreferences(userId);
  }
}

export const preferencesService = new PreferencesService();
