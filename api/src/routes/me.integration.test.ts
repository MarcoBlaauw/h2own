import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { meRoutes } from './me.js';
import { authService } from '../services/auth.js';
import { mailerService } from '../services/mailer.js';
import { profileService } from '../services/profile.js';
import { preferencesService } from '../services/preferences.js';
import { totpService } from '../services/totp.js';

describe('me routes', () => {
  let app: ReturnType<typeof Fastify>;
  const currentUserId = '2b5c4d1a-6e12-4d2a-b9f3-0a6f3a29e1f2';

  beforeEach(async () => {
    app = Fastify();
    app.decorate('auth', {
      verifySession: vi.fn(async (req: any) => {
        req.user = { id: currentUserId, role: 'member' };
        req.session = { id: 'sid-123' };
      }),
      requireRole: () => async () => {},
    } as any);
    app.decorate('sessions', {
      create: vi.fn(),
      destroy: vi.fn(async () => {}),
      touch: vi.fn(),
    } as any);
    app.decorate('redis', {
      set: vi.fn(async () => 'OK'),
      get: vi.fn(async () => null),
      del: vi.fn(async () => 1),
    } as any);

    await app.register(meRoutes, { prefix: '/me' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  it('returns profile data for authenticated user', async () => {
    vi.spyOn(profileService, 'getProfile').mockResolvedValue({
      userId: currentUserId,
      email: 'member@example.com',
      firstName: 'Member',
      lastName: 'User',
      nickname: 'PoolPro',
      address: '123 Main St',
      supervisors: [],
    });

    const response = await app.inject({ method: 'GET', url: '/me/profile' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      userId: currentUserId,
      email: 'member@example.com',
      firstName: 'Member',
      lastName: 'User',
      nickname: 'PoolPro',
      address: '123 Main St',
      supervisors: [],
    });
  });

  it('updates profile fields', async () => {
    vi.spyOn(profileService, 'updateProfile').mockResolvedValue({
      userId: currentUserId,
      email: 'member@example.com',
      firstName: 'Marco',
      lastName: 'Blaauw',
      nickname: 'webmeester',
      address: '1 Water Way',
      supervisors: [],
    });

    const response = await app.inject({
      method: 'PATCH',
      url: '/me/profile',
      payload: {
        firstName: 'Marco',
        lastName: 'Blaauw',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(profileService.updateProfile).toHaveBeenCalledWith(currentUserId, {
      firstName: 'Marco',
      lastName: 'Blaauw',
    });
  });

  it('returns 409 when requesting email change to an existing email', async () => {
    vi.spyOn(authService, 'getUserById').mockResolvedValue({
      userId: currentUserId,
      email: 'member@example.com',
      role: 'member',
      name: 'Member',
      createdAt: new Date().toISOString(),
    } as any);
    vi.spyOn(authService, 'getUserByEmail').mockResolvedValue({
      userId: 'another-user-id',
      email: 'exists@example.com',
      name: 'Other User',
      role: 'member',
      isActive: true,
    } as any);
    vi.spyOn(authService, 'verifyPasswordByUserId').mockResolvedValue(true);
    vi.spyOn(mailerService, 'sendEmailChangeVerificationEmail').mockResolvedValue({
      sent: true,
      skipped: false,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/me/email/change-request',
      payload: { email: 'exists@example.com', currentPassword: 'password-123' },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: 'ProfileEmailConflict',
      message: 'An account with that email already exists.',
    });
  });

  it('returns 400 when requesting email change with invalid current password', async () => {
    vi.spyOn(authService, 'getUserById').mockResolvedValue({
      userId: currentUserId,
      email: 'member@example.com',
      role: 'member',
      name: 'Member',
      createdAt: new Date().toISOString(),
    } as any);
    vi.spyOn(authService, 'verifyPasswordByUserId').mockResolvedValue(false);

    const response = await app.inject({
      method: 'POST',
      url: '/me/email/change-request',
      payload: { email: 'new-member@example.com', currentPassword: 'wrong-password' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: 'CurrentPasswordInvalid',
      message: 'Current password is incorrect.',
    });
  });

  it('returns preferences for authenticated user', async () => {
    vi.spyOn(preferencesService, 'getPreferences').mockResolvedValue({
      userId: currentUserId,
      theme: 'light',
      temperatureUnit: 'F',
      measurementSystem: 'imperial',
      currency: 'USD',
      preferredPoolTemp: 84,
      defaultPoolId: null,
      notificationEmailEnabled: true,
      notificationSmsEnabled: false,
      notificationPushEnabled: false,
      notificationEmailAddress: 'member@example.com',
      notificationPhoneNumber: null,
      notificationSmsVerified: false,
      notificationPushDeviceRegistered: false,
      reminderTimezone: null,
      reminderLeadMinutes: 1440,
      quietHoursStart: null,
      quietHoursEnd: null,
    });

    const response = await app.inject({ method: 'GET', url: '/me/preferences' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      userId: currentUserId,
      theme: 'light',
      preferredPoolTemp: 84,
    });
  });


  it('returns notification readiness for authenticated user', async () => {
    vi.spyOn(preferencesService, 'getPreferences').mockResolvedValue({
      userId: currentUserId,
      theme: 'light',
      temperatureUnit: 'F',
      measurementSystem: 'imperial',
      currency: 'USD',
      preferredPoolTemp: null,
      defaultPoolId: null,
      notificationEmailEnabled: true,
      notificationSmsEnabled: true,
      notificationPushEnabled: true,
      notificationEmailAddress: 'member@example.com',
      notificationPhoneNumber: null,
      notificationSmsVerified: false,
      notificationPushDeviceRegistered: false,
      reminderTimezone: null,
      reminderLeadMinutes: 1440,
      quietHoursStart: null,
      quietHoursEnd: null,
    });

    const response = await app.inject({ method: 'GET', url: '/me/notification-readiness' });
    expect(response.statusCode).toBe(200);
    expect(response.json().channels.map((c: any) => c.channel)).toEqual(
      expect.arrayContaining(['email', 'sms', 'push', 'in_app'])
    );
  });

  it('updates preferences fields', async () => {
    vi.spyOn(preferencesService, 'updatePreferences').mockResolvedValue({
      userId: currentUserId,
      theme: 'dark',
      temperatureUnit: 'C',
      measurementSystem: 'metric',
      currency: 'EUR',
      preferredPoolTemp: 27,
      defaultPoolId: null,
      notificationEmailEnabled: true,
      notificationSmsEnabled: false,
      notificationPushEnabled: true,
      notificationEmailAddress: 'member@example.com',
      notificationPhoneNumber: null,
      notificationSmsVerified: false,
      notificationPushDeviceRegistered: false,
      reminderTimezone: null,
      reminderLeadMinutes: 1440,
      quietHoursStart: null,
      quietHoursEnd: null,
    });

    const response = await app.inject({
      method: 'PATCH',
      url: '/me/preferences',
      payload: {
        theme: 'dark',
        temperatureUnit: 'C',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(preferencesService.updatePreferences).toHaveBeenCalledWith(currentUserId, {
      theme: 'dark',
      temperatureUnit: 'C',
    });
  });

  it('returns 400 when default pool selection is invalid', async () => {
    const error = new Error('Default pool must be a pool you can access.') as Error & { code?: string };
    error.code = 'ValidationError';
    vi.spyOn(preferencesService, 'updatePreferences').mockRejectedValueOnce(error);

    const response = await app.inject({
      method: 'PATCH',
      url: '/me/preferences',
      payload: {
        defaultPoolId: '11111111-1111-1111-1111-111111111111',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: 'ValidationError',
      message: 'Default pool must be a pool you can access.',
    });
  });

  it('updates password when current password is valid', async () => {
    vi.spyOn(authService, 'verifyPasswordByUserId').mockResolvedValue(true);
    vi.spyOn(authService, 'updatePasswordByUserId').mockResolvedValue(true);

    const response = await app.inject({
      method: 'POST',
      url: '/me/security/password',
      payload: {
        currentPassword: 'old-password-123',
        newPassword: 'new-password-123',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, requiresLogin: true });
    expect(authService.verifyPasswordByUserId).toHaveBeenCalledWith(currentUserId, 'old-password-123');
    expect(authService.updatePasswordByUserId).toHaveBeenCalledWith(currentUserId, 'new-password-123');
  });

  it('returns 400 when current password is invalid', async () => {
    vi.spyOn(authService, 'verifyPasswordByUserId').mockResolvedValue(false);

    const response = await app.inject({
      method: 'POST',
      url: '/me/security/password',
      payload: {
        currentPassword: 'wrong-password',
        newPassword: 'new-password-123',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: 'CurrentPasswordInvalid',
      message: 'Current password is incorrect.',
    });
  });

  it('returns totp status for the authenticated user', async () => {
    vi.spyOn(authService, 'getUserSecurityById').mockResolvedValue({
      userId: currentUserId,
      email: 'member@example.com',
      totpEnabled: true,
      totpSecretEncrypted: 'enc',
      totpPendingSecretEncrypted: null,
    } as any);

    const response = await app.inject({ method: 'GET', url: '/me/security/totp' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ enabled: true, pending: false });
  });

  it('initiates 2fa setup after current password verification', async () => {
    vi.spyOn(authService, 'verifyPasswordByUserId').mockResolvedValue(true);
    vi.spyOn(authService, 'getUserSecurityById').mockResolvedValue({
      userId: currentUserId,
      email: 'member@example.com',
      totpEnabled: false,
      totpSecretEncrypted: null,
      totpPendingSecretEncrypted: null,
    } as any);
    vi.spyOn(totpService, 'createEnrollment').mockResolvedValue({
      secret: 'ABCDEF123456',
      otpauthUrl: 'otpauth://totp/H2Own:member@example.com?secret=ABCDEF123456',
      qrCodeDataUrl: 'data:image/png;base64,abc',
    });
    vi.spyOn(totpService, 'encryptSecret').mockReturnValue('encrypted-pending');
    vi.spyOn(authService, 'setTotpPendingSecret').mockResolvedValue(true);

    const response = await app.inject({
      method: 'POST',
      url: '/me/security/totp/initiate',
      payload: { currentPassword: 'password-123' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      secret: 'ABCDEF123456',
      qrCodeDataUrl: 'data:image/png;base64,abc',
    });
    expect(authService.setTotpPendingSecret).toHaveBeenCalledWith(currentUserId, 'encrypted-pending');
  });

  it('enables 2fa when setup code is valid', async () => {
    vi.spyOn(authService, 'getUserSecurityById').mockResolvedValue({
      userId: currentUserId,
      email: 'member@example.com',
      totpEnabled: false,
      totpSecretEncrypted: null,
      totpPendingSecretEncrypted: 'encrypted-pending',
    } as any);
    vi.spyOn(totpService, 'decryptSecret').mockReturnValue('plain-secret');
    vi.spyOn(totpService, 'verifyToken').mockReturnValue(true);
    vi.spyOn(authService, 'enableTotp').mockResolvedValue(true);

    const response = await app.inject({
      method: 'POST',
      url: '/me/security/totp/enable',
      payload: { code: '123456' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, enabled: true });
    expect(authService.enableTotp).toHaveBeenCalledWith(currentUserId, 'encrypted-pending');
  });
});
