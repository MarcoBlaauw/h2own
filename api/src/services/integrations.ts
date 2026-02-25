import { eq } from 'drizzle-orm';
import { db as dbClient } from '../db/index.js';
import * as schema from '../db/schema/index.js';
import { env } from '../env.js';

export const INTEGRATION_PROVIDERS = [
  'tomorrow_io',
  'google_maps',
  'captcha',
  'billing',
] as const;

export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

export type IntegrationCredentials = {
  apiKey?: string | null;
  [key: string]: unknown;
};

export type IntegrationRuntimeUpdate = {
  lastResponseCode: number;
  lastResponseText?: string | null;
  lastResponseAt?: Date;
  lastSuccessAt?: Date | null;
  nextAllowedRequestAt?: Date | null;
};

export type IntegrationUpdate = {
  enabled?: boolean;
  cacheTtlSeconds?: number | null;
  rateLimitCooldownSeconds?: number | null;
  config?: Record<string, unknown> | null;
  credentials?: IntegrationCredentials | null;
};

export type IntegrationRecord = {
  integrationId: string;
  provider: IntegrationProvider;
  displayName: string;
  enabled: boolean;
  cacheTtlSeconds: number | null;
  rateLimitCooldownSeconds: number | null;
  config: Record<string, unknown> | null;
  credentials: IntegrationCredentials | null;
  lastResponseCode: number | null;
  lastResponseText: string | null;
  lastResponseAt: Date | null;
  lastSuccessAt: Date | null;
  nextAllowedRequestAt: Date | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const DEFAULT_DISPLAY_NAMES: Record<IntegrationProvider, string> = {
  tomorrow_io: 'Tomorrow.io',
  google_maps: 'Google Maps',
  captcha: 'CAPTCHA Provider',
  billing: 'Billing Provider',
};

type IntegrationSeed = {
  enabled?: boolean;
  cacheTtlSeconds?: number | null;
  rateLimitCooldownSeconds?: number | null;
  config?: Record<string, unknown>;
  credentials?: Record<string, unknown>;
};

const getProviderSeedFromEnv = (provider: IntegrationProvider): IntegrationSeed => {
  if (provider === 'tomorrow_io') {
    const credentials =
      env.TOMORROW_API_KEY && env.TOMORROW_API_KEY.trim().length > 0
        ? { apiKey: env.TOMORROW_API_KEY.trim() }
        : undefined;

    const config =
      env.TOMORROW_API_BASE && env.TOMORROW_API_BASE.trim().length > 0
        ? { baseUrl: env.TOMORROW_API_BASE.trim() }
        : undefined;

    return {
      enabled: true,
      cacheTtlSeconds: env.WEATHER_CACHE_TTL_MINUTES * 60,
      rateLimitCooldownSeconds: env.WEATHER_RATE_LIMIT_COOLDOWN_SECONDS,
      config,
      credentials,
    };
  }

  if (provider === 'captcha') {
    const credentials =
      env.CAPTCHA_SECRET && env.CAPTCHA_SECRET.trim().length > 0
        ? { secret: env.CAPTCHA_SECRET.trim() }
        : undefined;
    const config = {
      provider: env.CAPTCHA_PROVIDER ?? null,
      siteKey: env.CAPTCHA_SITE_KEY ?? null,
    };

    const hasConfigValues = Object.values(config).some((value) => value !== null);

    return {
      enabled: true,
      config: hasConfigValues ? config : undefined,
      credentials,
    };
  }

  return {};
};

const mergeMissingValues = (
  current: Record<string, unknown> | null | undefined,
  defaults: Record<string, unknown> | undefined
) => {
  if (!defaults) {
    return { changed: false, value: current ?? null };
  }

  const next: Record<string, unknown> = { ...(current ?? {}) };
  let changed = false;

  for (const [key, value] of Object.entries(defaults)) {
    const existing = next[key];
    if (existing === null || existing === undefined || existing === '') {
      next[key] = value;
      changed = true;
    }
  }

  return { changed, value: changed ? next : current ?? null };
};

const maskApiKey = (apiKey: string) => {
  const trimmed = apiKey.trim();
  if (trimmed.length <= 6) return '******';
  return `${trimmed.slice(0, 4)}****${trimmed.slice(-2)}`;
};

const toIntegrationRecord = (row: typeof schema.externalIntegrations.$inferSelect): IntegrationRecord => ({
  integrationId: row.integrationId,
  provider: row.provider as IntegrationProvider,
  displayName: row.displayName,
  enabled: row.enabled,
  cacheTtlSeconds: row.cacheTtlSeconds ?? null,
  rateLimitCooldownSeconds: row.rateLimitCooldownSeconds ?? null,
  config: (row.config as Record<string, unknown> | null) ?? null,
  credentials: (row.credentials as IntegrationCredentials | null) ?? null,
  lastResponseCode: row.lastResponseCode ?? null,
  lastResponseText: row.lastResponseText ?? null,
  lastResponseAt: row.lastResponseAt ?? null,
  lastSuccessAt: row.lastSuccessAt ?? null,
  nextAllowedRequestAt: row.nextAllowedRequestAt ?? null,
  updatedBy: row.updatedBy ?? null,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const buildStoredCredentials = (input: IntegrationCredentials | null | undefined) => {
  if (input === undefined) return undefined;
  if (input === null) return null;
  const apiKey = typeof input.apiKey === 'string' ? input.apiKey.trim() : input.apiKey;
  return {
    ...input,
    apiKey: typeof apiKey === 'string' && apiKey.length > 0 ? apiKey : null,
  };
};

const toPublicCredentials = (credentials: IntegrationCredentials | null) => {
  if (!credentials) {
    return { hasApiKey: false, apiKeyPreview: null };
  }

  const apiKey = typeof credentials.apiKey === 'string' ? credentials.apiKey.trim() : '';
  if (!apiKey) {
    return { hasApiKey: false, apiKeyPreview: null };
  }

  return {
    hasApiKey: true,
    apiKeyPreview: maskApiKey(apiKey),
  };
};

export class IntegrationService {
  constructor(private readonly db = dbClient) {}

  private async ensureProvider(provider: IntegrationProvider) {
    const seed = getProviderSeedFromEnv(provider);
    const [existing] = await this.db
      .select()
      .from(schema.externalIntegrations)
      .where(eq(schema.externalIntegrations.provider, provider));

    if (existing) {
      const configMerge = mergeMissingValues(
        (existing.config as Record<string, unknown> | null) ?? null,
        seed.config
      );
      const credentialsMerge = mergeMissingValues(
        (existing.credentials as Record<string, unknown> | null) ?? null,
        seed.credentials
      );

      const patch: Partial<typeof schema.externalIntegrations.$inferInsert> = {};

      if (existing.cacheTtlSeconds == null && seed.cacheTtlSeconds != null) {
        patch.cacheTtlSeconds = seed.cacheTtlSeconds;
      }
      if (
        existing.rateLimitCooldownSeconds == null &&
        seed.rateLimitCooldownSeconds != null
      ) {
        patch.rateLimitCooldownSeconds = seed.rateLimitCooldownSeconds;
      }
      if (configMerge.changed) {
        patch.config = configMerge.value;
      }
      if (credentialsMerge.changed) {
        patch.credentials = credentialsMerge.value;
      }
      if (Object.keys(patch).length === 0) {
        return existing;
      }

      const [updated] = await this.db
        .update(schema.externalIntegrations)
        .set({
          ...patch,
          updatedAt: new Date(),
        })
        .where(eq(schema.externalIntegrations.integrationId, existing.integrationId))
        .returning();

      return updated;
    }

    const [created] = await this.db
      .insert(schema.externalIntegrations)
      .values({
        provider,
        displayName: DEFAULT_DISPLAY_NAMES[provider],
        enabled: seed.enabled ?? true,
        config: seed.config,
        credentials: seed.credentials,
        cacheTtlSeconds: seed.cacheTtlSeconds ?? null,
        rateLimitCooldownSeconds: seed.rateLimitCooldownSeconds ?? null,
      })
      .returning();

    return created;
  }

  async listIntegrations() {
    for (const provider of INTEGRATION_PROVIDERS) {
      await this.ensureProvider(provider);
    }

    const rows = await this.db
      .select()
      .from(schema.externalIntegrations);

    return rows.map((row) => {
      const record = toIntegrationRecord(row);
      return {
        ...record,
        credentials: toPublicCredentials(record.credentials),
      };
    });
  }

  async getIntegration(provider: IntegrationProvider) {
    const row = await this.ensureProvider(provider);
    return toIntegrationRecord(row);
  }

  async updateIntegration(provider: IntegrationProvider, updates: IntegrationUpdate, updatedBy?: string) {
    const existing = await this.ensureProvider(provider);
    const credentials = buildStoredCredentials(updates.credentials);

    const [row] = await this.db
      .update(schema.externalIntegrations)
      .set({
        enabled: updates.enabled ?? existing.enabled,
        cacheTtlSeconds:
          updates.cacheTtlSeconds === undefined
            ? existing.cacheTtlSeconds
            : updates.cacheTtlSeconds,
        rateLimitCooldownSeconds:
          updates.rateLimitCooldownSeconds === undefined
            ? existing.rateLimitCooldownSeconds
            : updates.rateLimitCooldownSeconds,
        config: updates.config === undefined ? existing.config : updates.config,
        credentials: credentials === undefined ? existing.credentials : credentials,
        updatedBy: updatedBy ?? existing.updatedBy,
        updatedAt: new Date(),
      })
      .where(eq(schema.externalIntegrations.integrationId, existing.integrationId))
      .returning();

    const record = toIntegrationRecord(row);
    return {
      ...record,
      credentials: toPublicCredentials(record.credentials),
    };
  }

  async updateRuntimeStatus(provider: IntegrationProvider, runtime: IntegrationRuntimeUpdate) {
    const existing = await this.ensureProvider(provider);
    const [row] = await this.db
      .update(schema.externalIntegrations)
      .set({
        lastResponseCode: runtime.lastResponseCode,
        lastResponseText: runtime.lastResponseText ?? null,
        lastResponseAt: runtime.lastResponseAt ?? new Date(),
        lastSuccessAt: runtime.lastSuccessAt ?? existing.lastSuccessAt,
        nextAllowedRequestAt:
          runtime.nextAllowedRequestAt === undefined
            ? existing.nextAllowedRequestAt
            : runtime.nextAllowedRequestAt,
        updatedAt: new Date(),
      })
      .where(eq(schema.externalIntegrations.integrationId, existing.integrationId))
      .returning();

    return toIntegrationRecord(row);
  }
}

export const integrationService = new IntegrationService();
