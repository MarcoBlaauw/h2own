import { describe, expect, it } from 'vitest';
import {
  canAssignPoolOwner,
  hasAccountCapability,
  hasPoolCapability,
  hasSystemCapability,
  isSystemRole,
  requiresOwnerForCapability,
} from './authorization.js';

describe('authorization capability registry', () => {
  it('validates supported system roles', () => {
    expect(isSystemRole('admin')).toBe(true);
    expect(isSystemRole('business')).toBe(true);
    expect(isSystemRole('member')).toBe(true);
    expect(isSystemRole('viewer')).toBe(false);
    expect(isSystemRole(undefined)).toBe(false);
  });

  it('allows admin/business to create pools for other owners', () => {
    expect(canAssignPoolOwner('admin')).toBe(true);
    expect(canAssignPoolOwner('business')).toBe(true);
    expect(canAssignPoolOwner('member')).toBe(false);
    expect(canAssignPoolOwner(undefined)).toBe(false);
  });

  it('resolves system capabilities by system role', () => {
    expect(hasSystemCapability('admin', 'admin.users.manage')).toBe(true);
    expect(hasSystemCapability('admin', 'admin.audit.read')).toBe(true);
    expect(hasSystemCapability('business', 'admin.pools.manage')).toBe(true);
    expect(hasSystemCapability('business', 'admin.users.manage')).toBe(false);
    expect(hasSystemCapability('member', 'admin.audit.read')).toBe(false);
  });

  it('resolves account capabilities including messaging and billing hooks', () => {
    expect(hasAccountCapability('member', 'messages.read')).toBe(true);
    expect(hasAccountCapability('member', 'messages.send')).toBe(true);
    expect(hasAccountCapability('member', 'billing.read')).toBe(true);
    expect(hasAccountCapability('member', 'billing.manage')).toBe(false);
    expect(hasAccountCapability('business', 'billing.manage')).toBe(true);
    expect(hasAccountCapability('admin', 'billing.manage')).toBe(true);
  });

  it('enforces owner-only destructive capabilities', () => {
    expect(requiresOwnerForCapability('pool.update')).toBe(true);
    expect(requiresOwnerForCapability('pool.delete')).toBe(true);
    expect(requiresOwnerForCapability('pool.members.manage')).toBe(true);
    expect(requiresOwnerForCapability('pool.tests.create')).toBe(false);
  });

  it('resolves pool capabilities by pool role', () => {
    expect(
      hasPoolCapability('pool.tests.create', { isOwner: false, poolRole: 'operator' })
    ).toBe(true);
    expect(
      hasPoolCapability('pool.delete', { isOwner: false, poolRole: 'operator' })
    ).toBe(false);
    expect(hasPoolCapability('pool.read', { isOwner: false, poolRole: 'viewer' })).toBe(true);
    expect(
      hasPoolCapability('pool.dosing.create', { isOwner: false, poolRole: 'viewer' })
    ).toBe(false);
    expect(hasPoolCapability('pool.delete', { isOwner: true, poolRole: 'member' })).toBe(true);
  });
});
