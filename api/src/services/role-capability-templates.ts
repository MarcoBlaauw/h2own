import { asc, eq } from 'drizzle-orm';
import { db as dbClient } from '../db/index.js';
import * as schema from '../db/schema/index.js';
import {
  ACCOUNT_CAPABILITIES,
  DEFAULT_ACCOUNT_ROLE_CAPABILITIES,
  DEFAULT_SYSTEM_ROLE_CAPABILITIES,
  SYSTEM_CAPABILITIES,
  SYSTEM_ROLES,
  type AccountCapability,
  type SystemCapability,
  type SystemRole,
} from './authorization.js';

type CapabilityScope = 'system' | 'account';

type CapabilityRow = {
  role: string;
  scope: string;
  capability: string;
};

export interface RoleCapabilityTemplate {
  role: SystemRole;
  systemCapabilities: SystemCapability[];
  accountCapabilities: AccountCapability[];
}

export class RoleCapabilityTemplatesForbiddenError extends Error {
  readonly statusCode = 403;
  readonly code = 'RoleCapabilityTemplatesForbidden';

  constructor(message = 'Only administrators can manage role capability templates.') {
    super(message);
    this.name = 'RoleCapabilityTemplatesForbiddenError';
  }
}

function toSorted<T extends string>(values: Iterable<T>): T[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function isSystemCapability(value: string): value is SystemCapability {
  return SYSTEM_CAPABILITIES.includes(value as SystemCapability);
}

function isAccountCapability(value: string): value is AccountCapability {
  return ACCOUNT_CAPABILITIES.includes(value as AccountCapability);
}

function defaultTemplatesByRole() {
  return new Map<SystemRole, RoleCapabilityTemplate>(
    SYSTEM_ROLES.map((role) => [
      role,
      {
        role,
        systemCapabilities: toSorted(DEFAULT_SYSTEM_ROLE_CAPABILITIES[role]),
        accountCapabilities: toSorted(DEFAULT_ACCOUNT_ROLE_CAPABILITIES[role]),
      },
    ])
  );
}

function applyRows(
  templates: Map<SystemRole, RoleCapabilityTemplate>,
  rows: CapabilityRow[]
): Map<SystemRole, RoleCapabilityTemplate> {
  for (const row of rows) {
    if (!SYSTEM_ROLES.includes(row.role as SystemRole)) {
      continue;
    }

    const role = row.role as SystemRole;
    const existing = templates.get(role);
    if (!existing) {
      continue;
    }

    if (row.scope === 'system' && isSystemCapability(row.capability)) {
      existing.systemCapabilities.push(row.capability);
    }

    if (row.scope === 'account' && isAccountCapability(row.capability)) {
      existing.accountCapabilities.push(row.capability);
    }
  }

  for (const [role, template] of templates.entries()) {
    templates.set(role, {
      role,
      systemCapabilities: toSorted(template.systemCapabilities),
      accountCapabilities: toSorted(template.accountCapabilities),
    });
  }

  return templates;
}

function normalizeCapabilities(scope: CapabilityScope, capabilities: string[]) {
  const sorted = toSorted(capabilities);
  if (scope === 'system') {
    return sorted.filter((capability): capability is SystemCapability => isSystemCapability(capability));
  }
  return sorted.filter((capability): capability is AccountCapability => isAccountCapability(capability));
}

export class RoleCapabilityTemplatesService {
  constructor(private readonly db = dbClient) {}

  async listTemplates() {
    const rows = await this.db
      .select({
        role: schema.roleCapabilityTemplates.role,
        scope: schema.roleCapabilityTemplates.scope,
        capability: schema.roleCapabilityTemplates.capability,
      })
      .from(schema.roleCapabilityTemplates)
      .orderBy(
        asc(schema.roleCapabilityTemplates.role),
        asc(schema.roleCapabilityTemplates.scope),
        asc(schema.roleCapabilityTemplates.capability)
      );

    const defaults = defaultTemplatesByRole();

    if (rows.length === 0) {
      return [...defaults.values()];
    }

    // If a role has persisted rows, treat persisted capabilities as source of truth for both scopes.
    const hasPersistedForRole = new Set(rows.map((row) => row.role));
    for (const role of SYSTEM_ROLES) {
      const template = defaults.get(role);
      if (!template) continue;
      if (hasPersistedForRole.has(role)) {
        template.systemCapabilities = [];
        template.accountCapabilities = [];
      }
    }

    return [...applyRows(defaults, rows).values()];
  }

  async updateTemplate(
    role: SystemRole,
    update: { systemCapabilities?: string[]; accountCapabilities?: string[] }
  ) {
    const current =
      (await this.listTemplates()).find((template) => template.role === role) ?? {
        role,
        systemCapabilities: toSorted(DEFAULT_SYSTEM_ROLE_CAPABILITIES[role]),
        accountCapabilities: toSorted(DEFAULT_ACCOUNT_ROLE_CAPABILITIES[role]),
      };
    const nextSystemCapabilities =
      update.systemCapabilities !== undefined
        ? normalizeCapabilities('system', update.systemCapabilities)
        : current.systemCapabilities;
    const nextAccountCapabilities =
      update.accountCapabilities !== undefined
        ? normalizeCapabilities('account', update.accountCapabilities)
        : current.accountCapabilities;
    const now = new Date();

    await this.db.transaction(async (tx) => {
      await tx
        .delete(schema.roleCapabilityTemplates)
        .where(eq(schema.roleCapabilityTemplates.role, role));

      if (nextSystemCapabilities.length > 0) {
        await tx.insert(schema.roleCapabilityTemplates).values(
          nextSystemCapabilities.map((capability) => ({
            role,
            scope: 'system',
            capability,
            updatedAt: now,
          }))
        );
      }

      if (nextAccountCapabilities.length > 0) {
        await tx.insert(schema.roleCapabilityTemplates).values(
          nextAccountCapabilities.map((capability) => ({
            role,
            scope: 'account',
            capability,
            updatedAt: now,
          }))
        );
      }
    });

    const templates = await this.listTemplates();
    return templates.find((template) => template.role === role) ?? null;
  }
}

export const roleCapabilityTemplatesService = new RoleCapabilityTemplatesService();
