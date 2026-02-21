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

const systemRoleCapabilities: Record<SystemRole, ReadonlySet<SystemCapability>> = {
  admin: new Set(SYSTEM_CAPABILITIES),
  business: new Set(['admin.pools.manage']),
  member: new Set([]),
};

const accountRoleCapabilities: Record<SystemRole, ReadonlySet<AccountCapability>> = {
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

export function hasSystemCapability(
  role: string | null | undefined,
  capability: SystemCapability
) {
  if (!isSystemRole(role)) {
    return false;
  }
  return systemRoleCapabilities[role].has(capability);
}

export function hasAccountCapability(
  role: string | null | undefined,
  capability: AccountCapability
) {
  if (!isSystemRole(role)) {
    return false;
  }
  return accountRoleCapabilities[role].has(capability);
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
