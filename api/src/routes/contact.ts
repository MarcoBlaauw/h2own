import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { env } from '../env.js';
import { authService } from '../services/auth.js';
import { mailerService } from '../services/mailer.js';
import { writeAuditLog } from './audit.js';

const contactBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email(),
  message: z.string().trim().min(10).max(4000),
  captchaToken: z.string().trim().min(1).optional(),
});

const contactRecipients = () =>
  (env.SUPPORT_CONTACT_EMAILS ?? 'support@h2own.com')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

export async function contactRoutes(app: FastifyInstance) {
  app.post('/submit', async (req, reply) => {
    try {
      const body = contactBodySchema.parse(req.body ?? {});
      const captchaConfigured = Boolean(env.CAPTCHA_PROVIDER && env.CAPTCHA_SECRET);
      if (captchaConfigured) {
        if (!body.captchaToken) {
          await writeAuditLog(app, req, {
            action: 'contact.captcha.required',
            entity: 'contact_submission',
            entityId: body.email,
          });
          return reply
            .code(400)
            .send({ error: 'CaptchaRequired', message: 'CAPTCHA verification is required.' });
        }
        const validCaptcha = await authService.verifyCaptcha(body.captchaToken);
        if (!validCaptcha) {
          await writeAuditLog(app, req, {
            action: 'contact.captcha.failed',
            entity: 'contact_submission',
            entityId: body.email,
          });
          return reply
            .code(400)
            .send({ error: 'InvalidCaptcha', message: 'CAPTCHA verification failed.' });
        }
      }

      const recipients = contactRecipients();
      for (const recipient of recipients) {
        await mailerService.sendPublicContactEmail(recipient, {
          name: body.name,
          email: body.email,
          message: body.message,
          ipAddress: req.ip ?? null,
        });
      }

      await writeAuditLog(app, req, {
        action: 'contact.submitted',
        entity: 'contact_submission',
        entityId: body.email,
        data: { recipients: recipients.length },
      });

      return reply.send({
        ok: true,
        message: 'Thanks for reaching out. We will respond within one business day.',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'ValidationError', details: error.errors });
      }
      throw error;
    }
  });
}
