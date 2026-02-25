export const SYSTEM_ROLES = ['admin', 'business', 'member'] as const;
export type SystemRole = (typeof SYSTEM_ROLES)[number];

export const POOL_CAPABILITIES = [
  'pool.create',
  'pool.read',
  'pool.update',
  'pool.delete',
  'pool.members.manage',
  'pool.tests.create',
  'pool.dosing.create',
] as const;
export type PoolCapability = (typeof POOL_CAPABILITIES)[number];

type PoolCapabilityContext = {
  isOwner: boolean;
  poolRole?: string | null;
};

const OWNER_ONLY_CAPABILITIES = new Set<PoolCapability>([
  'pool.update',
  'pool.delete',
  'pool.members.manage',
]);

const poolRoleCapabilities: Record<string, ReadonlySet<PoolCapability>> = {
  owner: new Set(POOL_CAPABILITIES),
  manager: new Set(['pool.read', 'pool.tests.create', 'pool.dosing.create']),
  operator: new Set(['pool.read', 'pool.tests.create', 'pool.dosing.create']),
  member: new Set(['pool.read', 'pool.tests.create', 'pool.dosing.create']),
  viewer: new Set(['pool.read']),
};

export function isSystemRole(value: string | null | undefined): value is SystemRole {
  return Boolean(value && SYSTEM_ROLES.includes(value as SystemRole));
}

export const SYSTEM_CAPABILITIES = [
  'admin.users.read',
  'admin.users.manage',
  'admin.audit.read',
  'admin.tokens.manage',
  'admin.pools.manage',
] as const;
export type SystemCapability = (typeof SYSTEM_CAPABILITIES)[number];

export const ACCOUNT_CAPABILITIES = [
  'account.profile.read',
  'account.profile.update',
  'account.preferences.read',
  'account.preferences.update',
  'account.security.read',
  'account.security.update',
  'notifications.read',
  'notifications.manage',
  'messages.read',
  'messages.send',
  'billing.read',
  'billing.manage',
] as const;
export type AccountCapability = (typeof ACCOUNT_CAPABILITIES)[number];

export const DEFAULT_SYSTEM_ROLE_CAPABILITIES: Record<
  SystemRole,
  ReadonlySet<SystemCapability>
> = {
  admin: new Set(SYSTEM_CAPABILITIES),
  business: new Set(['admin.pools.manage']),
  member: new Set([]),
};

export const DEFAULT_ACCOUNT_ROLE_CAPABILITIES: Record<
  SystemRole,
  ReadonlySet<AccountCapability>
> = {
  admin: new Set(ACCOUNT_CAPABILITIES),
  business: new Set(ACCOUNT_CAPABILITIES),
  member: new Set([
    'account.profile.read',
    'account.profile.update',
    'account.preferences.read',
    'account.preferences.update',
    'account.security.read',
    'account.security.update',
    'notifications.read',
    'notifications.manage',
    'messages.read',
    'messages.send',
    'billing.read',
  ]),
};

type RoleCapabilityTemplateInput = {
  role: SystemRole;
  systemCapabilities: string[];
  accountCapabilities: string[];
};

const runtimeSystemRoleCapabilities: Record<SystemRole, Set<SystemCapability>> = {
  admin: new Set(DEFAULT_SYSTEM_ROLE_CAPABILITIES.admin),
  business: new Set(DEFAULT_SYSTEM_ROLE_CAPABILITIES.business),
  member: new Set(DEFAULT_SYSTEM_ROLE_CAPABILITIES.member),
};

const runtimeAccountRoleCapabilities: Record<SystemRole, Set<AccountCapability>> = {
  admin: new Set(DEFAULT_ACCOUNT_ROLE_CAPABILITIES.admin),
  business: new Set(DEFAULT_ACCOUNT_ROLE_CAPABILITIES.business),
  member: new Set(DEFAULT_ACCOUNT_ROLE_CAPABILITIES.member),
};

function isSystemCapability(value: string): value is SystemCapability {
  return SYSTEM_CAPABILITIES.includes(value as SystemCapability);
}

function isAccountCapability(value: string): value is AccountCapability {
  return ACCOUNT_CAPABILITIES.includes(value as AccountCapability);
}

export function resetRoleCapabilityTemplates() {
  for (const role of SYSTEM_ROLES) {
    runtimeSystemRoleCapabilities[role] = new Set(DEFAULT_SYSTEM_ROLE_CAPABILITIES[role]);
    runtimeAccountRoleCapabilities[role] = new Set(DEFAULT_ACCOUNT_ROLE_CAPABILITIES[role]);
  }
}

export function applyRoleCapabilityTemplates(templates: RoleCapabilityTemplateInput[]) {
  resetRoleCapabilityTemplates();

  for (const template of templates) {
    runtimeSystemRoleCapabilities[template.role] = new Set(
      template.systemCapabilities.filter((capability): capability is SystemCapability =>
        isSystemCapability(capability)
      )
    );
    runtimeAccountRoleCapabilities[template.role] = new Set(
      template.accountCapabilities.filter((capability): capability is AccountCapability =>
        isAccountCapability(capability)
      )
    );
  }
}

export function getSystemCapabilitiesForRole(role: SystemRole): SystemCapability[] {
  return [...runtimeSystemRoleCapabilities[role]];
}

export function getAccountCapabilitiesForRole(role: SystemRole): AccountCapability[] {
  return [...runtimeAccountRoleCapabilities[role]];
}

export function hasSystemCapability(
  role: string | null | undefined,
  capability: SystemCapability,
  roleCapabilities?: ReadonlySet<SystemCapability>
) {
  if (!isSystemRole(role)) {
    return false;
  }
  const capabilities = roleCapabilities ?? runtimeSystemRoleCapabilities[role];
  return capabilities.has(capability);
}

export function hasAccountCapability(
  role: string | null | undefined,
  capability: AccountCapability,
  roleCapabilities?: ReadonlySet<AccountCapability>
) {
  if (!isSystemRole(role)) {
    return false;
  }
  const capabilities = roleCapabilities ?? runtimeAccountRoleCapabilities[role];
  return capabilities.has(capability);
}

export function canAssignPoolOwner(systemRole: string | null | undefined) {
  return systemRole === 'admin' || systemRole === 'business';
}

export function requiresOwnerForCapability(capability: PoolCapability) {
  return OWNER_ONLY_CAPABILITIES.has(capability);
}

export function hasPoolCapability(capability: PoolCapability, context: PoolCapabilityContext) {
  if (context.isOwner) {
    return true;
  }

  const role = context.poolRole?.trim().toLowerCase() ?? 'viewer';
  const allowed = poolRoleCapabilities[role] ?? poolRoleCapabilities.viewer;
  return allowed.has(capability);
}
