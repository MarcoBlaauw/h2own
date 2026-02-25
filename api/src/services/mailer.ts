import nodemailer from "nodemailer";
import { env } from "../env.js";

interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
}

class MailerService {
  private readonly configured =
    Boolean(env.SMTP_HOST) &&
    Boolean(env.SMTP_PORT) &&
    Boolean(env.SMTP_FROM_EMAIL);

  private readonly transporter = this.configured
    ? nodemailer.createTransport({
        host: env.SMTP_HOST!,
        port: env.SMTP_PORT!,
        secure: env.SMTP_SECURE,
        auth:
          env.SMTP_USER && env.SMTP_PASS
            ? {
                user: env.SMTP_USER,
                pass: env.SMTP_PASS,
              }
            : undefined,
      })
    : null;

  isConfigured() {
    return this.configured;
  }

  async send(input: SendEmailInput) {
    if (!this.configured || !this.transporter) {
      return { sent: false, skipped: true };
    }

    await this.transporter.sendMail({
      from: env.SMTP_FROM_NAME
        ? `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`
        : env.SMTP_FROM_EMAIL,
      to: input.to,
      subject: input.subject,
      text: input.text,
    });

    return { sent: true, skipped: false };
  }

  async sendWelcomeEmail(to: string, name?: string | null) {
    const greeting = name?.trim() ? `Hi ${name.trim()},` : "Hi,";
    return this.send({
      to,
      subject: "Welcome to H2Own",
      text: `${greeting}

Welcome to H2Own. Your account is ready.

You can sign in at ${env.APP_BASE_URL}.

Thanks,
H2Own`,
    });
  }

  async sendPasswordResetEmail(to: string, resetUrl: string, ttlSeconds: number) {
    const minutes = Math.ceil(ttlSeconds / 60);
    return this.send({
      to,
      subject: "Reset your H2Own password",
      text: `We received a request to reset your H2Own password.

Use the link below to choose a new password:
${resetUrl}

This link expires in ${minutes} minute(s).

If you did not request this, you can ignore this email.`,
    });
  }

  async sendUsernameReminderEmail(to: string, loginEmail: string) {
    return this.send({
      to,
      subject: "Your H2Own sign-in username",
      text: `You requested your H2Own sign-in details.

Your username is: ${loginEmail}

You can sign in at ${env.APP_BASE_URL}.`,
    });
  }

  async sendEmailChangeVerificationEmail(to: string, verifyUrl: string, ttlSeconds: number) {
    const hours = Math.ceil(ttlSeconds / 3600);
    return this.send({
      to,
      subject: "Verify your new H2Own email address",
      text: `We received a request to change the email address on your H2Own account.

Use the link below to confirm your new email address:
${verifyUrl}

This link expires in ${hours} hour(s).

If you did not request this change, you can ignore this email.`,
    });
  }

  async sendAuthLockoutEscalationEmail(
    to: string,
    details: {
      email: string;
      ipAddress: string;
      offenseLevel: 2 | 3;
      lockoutUntil: string;
    },
  ) {
    return this.send({
      to,
      subject: `H2Own auth lockout escalation (offense ${details.offenseLevel})`,
      text: `An authentication lockout escalation was triggered.

User: ${details.email}
Source IP: ${details.ipAddress}
Offense level: ${details.offenseLevel}
Locked until: ${details.lockoutUntil}`,
    });
  }

  async sendAuthLockoutSupportRequestEmail(
    to: string,
    details: {
      email: string;
      ipAddress: string;
      message: string;
    },
  ) {
    return this.send({
      to,
      subject: "H2Own lockout support request",
      text: `A locked user submitted a support request.

User: ${details.email}
Source IP: ${details.ipAddress}

Message:
${details.message}`,
    });
  }

  async sendPublicContactEmail(
    to: string,
    details: {
      name: string;
      email: string;
      message: string;
      ipAddress?: string | null;
    },
  ) {
    return this.send({
      to,
      subject: `H2Own contact form: ${details.name}`,
      text: `New contact form submission:

Name: ${details.name}
Email: ${details.email}
IP: ${details.ipAddress ?? 'unknown'}

Message:
${details.message}`,
    });
  }
}

export const mailerService = new MailerService();
