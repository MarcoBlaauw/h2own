import { FastifyInstance } from 'fastify';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { authService } from '../services/auth.js';
import { profileService, ProfileEmailConflictError } from '../services/profile.js';
import { preferencesService } from '../services/preferences.js';
import { mailerService } from '../services/mailer.js';
import { env } from '../env.js';
import { writeAuditLog } from './audit.js';

const nullableTrimmedString = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .transform((value) => (value === '' ? null : value))
    .nullable();

const updateProfileBodySchema = z
  .object({
    firstName: nullableTrimmedString(80).optional(),
    lastName: nullableTrimmedString(80).optional(),
    nickname: nullableTrimmedString(80).optional(),
    address: nullableTrimmedString(500).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one property must be provided.',
  });

const requestEmailChangeBodySchema = z.object({
  email: z.string().trim().email(),
  currentPassword: z.string().min(1, 'Current password is required'),
});

const updatePreferencesBodySchema = z
  .object({
    theme: z.enum(['light', 'dark', 'system']).optional(),
    temperatureUnit: z.enum(['F', 'C']).optional(),
    measurementSystem: z.enum(['imperial', 'metric']).optional(),
    currency: z.string().trim().length(3).optional(),
    preferredPoolTemp: z.number().min(40).max(110).nullable().optional(),
    defaultPoolId: z.string().uuid().nullable().optional(),
    notificationEmailEnabled: z.boolean().optional(),
    notificationSmsEnabled: z.boolean().optional(),
    notificationPushEnabled: z.boolean().optional(),
    notificationEmailAddress: z.string().trim().email().nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one property must be provided.',
  });

const updatePasswordBodySchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters long'),
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from current password.',
    path: ['newPassword'],
  });

export async function meRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.auth.verifySession);

  app.get('/profile', async (req, reply) => {
    const profile = await profileService.getProfile(req.user!.id);
    if (!profile) {
      return reply.code(404).send({ error: 'NotFound' });
    }

    return reply.send(profile);
  });

  app.patch('/profile', async (req, reply) => {
    try {
      const payload = updateProfileBodySchema.parse(req.body ?? {});
      const profile = await profileService.updateProfile(req.user!.id, payload);
      if (!profile) {
        return reply.code(404).send({ error: 'NotFound' });
      }

      await writeAuditLog(app, req, {
        action: 'account.profile.updated',
        entity: 'user',
        entityId: req.user!.id,
        userId: req.user!.id,
        data: {
          changed: Object.keys(payload),
        },
      });

      return reply.send(profile);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: error.errors });
      }
      if (error instanceof ProfileEmailConflictError) {
        return reply.code(error.statusCode).send({ error: error.code, message: error.message });
      }
      throw error;
    }
  });

  app.post('/email/change-request', async (req, reply) => {
    try {
      const payload = requestEmailChangeBodySchema.parse(req.body ?? {});
      const requestedEmail = payload.email.trim().toLowerCase();
      const user = await authService.getUserById(req.user!.id);
      if (!user) {
        return reply.code(404).send({ error: 'NotFound' });
      }

      if (requestedEmail === user.email.toLowerCase()) {
        return reply.code(400).send({
          error: 'SameEmail',
          message: 'New email must be different from your current email.',
        });
      }

      const isCurrentValid = await authService.verifyPasswordByUserId(req.user!.id, payload.currentPassword);
      if (!isCurrentValid) {
        return reply.code(400).send({
          error: 'CurrentPasswordInvalid',
          message: 'Current password is incorrect.',
        });
      }

      const existing = await authService.getUserByEmail(requestedEmail);
      if (existing && existing.userId !== req.user!.id) {
        return reply.code(409).send({
          error: 'ProfileEmailConflict',
          message: 'An account with that email already exists.',
        });
      }

      const token = randomBytes(32).toString('hex');
      const tokenKey = `email-change:${token}`;
      await app.redis.set(
        tokenKey,
        JSON.stringify({
          userId: req.user!.id,
          email: requestedEmail,
        }),
        'EX',
        env.EMAIL_CHANGE_TOKEN_TTL_SECONDS
      );

      const verifyUrl = `${env.APP_BASE_URL.replace(/\/$/, '')}/auth/verify-email-change?token=${encodeURIComponent(token)}`;
      void mailerService
        .sendEmailChangeVerificationEmail(
          requestedEmail,
          verifyUrl,
          env.EMAIL_CHANGE_TOKEN_TTL_SECONDS
        )
        .catch((mailError) => {
          req.log.warn(
            { err: mailError, userId: req.user!.id, email: requestedEmail },
            'failed to send email change verification email'
          );
        });

      await writeAuditLog(app, req, {
        action: 'account.email_change.requested',
        entity: 'user',
        entityId: req.user!.id,
        userId: req.user!.id,
        data: { email: requestedEmail },
      });

      return reply.send({
        ok: true,
        message: 'Verification email sent. Confirm the new email address from your inbox.',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: error.errors });
      }
      if ((error as { code?: string })?.code === 'ValidationError') {
        return reply.code(400).send({ error: 'ValidationError', message: (error as Error).message });
      }
      throw error;
    }
  });

  app.get('/preferences', async (req, reply) => {
    const preferences = await preferencesService.getPreferences(req.user!.id);
    if (!preferences) {
      return reply.code(404).send({ error: 'NotFound' });
    }

    return reply.send(preferences);
  });

  app.patch('/preferences', async (req, reply) => {
    try {
      const payload = updatePreferencesBodySchema.parse(req.body ?? {});
      const preferences = await preferencesService.updatePreferences(req.user!.id, payload);
      if (!preferences) {
        return reply.code(404).send({ error: 'NotFound' });
      }

      await writeAuditLog(app, req, {
        action: 'account.preferences.updated',
        entity: 'user',
        entityId: req.user!.id,
        userId: req.user!.id,
        data: {
          changed: Object.keys(payload),
        },
      });

      return reply.send(preferences);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: error.errors });
      }
      if ((error as { code?: string })?.code === 'ValidationError') {
        return reply.code(400).send({ error: 'ValidationError', message: (error as Error).message });
      }
      throw error;
    }
  });

  app.post('/security/password', async (req, reply) => {
    try {
      const payload = updatePasswordBodySchema.parse(req.body ?? {});
      const isCurrentValid = await authService.verifyPasswordByUserId(req.user!.id, payload.currentPassword);
      if (!isCurrentValid) {
        return reply.code(400).send({
          error: 'CurrentPasswordInvalid',
          message: 'Current password is incorrect.',
        });
      }

      const updated = await authService.updatePasswordByUserId(req.user!.id, payload.newPassword);
      if (!updated) {
        return reply.code(404).send({ error: 'NotFound' });
      }

      await writeAuditLog(app, req, {
        action: 'account.security.password_updated',
        entity: 'user',
        entityId: req.user!.id,
        userId: req.user!.id,
      });

      await app.sessions.destroy(reply, req.session?.id ?? null);
      return reply.send({ ok: true, requiresLogin: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: error.errors });
      }
      throw error;
    }
  });
}
