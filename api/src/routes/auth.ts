import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type {} from "../types/fastify.d.ts";
import { randomBytes } from "crypto";
import { z } from "zod";
import { UserAlreadyExistsError, authService } from "../services/auth.js";
import { authLockoutService } from "../services/auth-lockout.js";
import { mailerService } from "../services/mailer.js";
import { env } from "../env.js";
import { writeAuditLog } from "./audit.js";

const registerBodySchema = z.object({
  email: z
    .string({
      required_error: "Email is required",
      invalid_type_error: "Email must be a string",
    })
    .email("Email must be a valid email address"),
  password: z
    .string({
      required_error: "Password is required",
      invalid_type_error: "Password must be a string",
    })
    .min(8, "Password must be at least 8 characters long"),
  name: z
    .string({ invalid_type_error: "Name must be a string" })
    .trim()
    .min(1, "Name must not be empty")
    .optional(),
  captchaToken: z.string().trim().min(1).optional(),
});

const loginBodySchema = z.object({
  email: z
    .string({
      required_error: "Email is required",
      invalid_type_error: "Email must be a string",
    })
    .email("Email must be a valid email address"),
  password: z
    .string({
      required_error: "Password is required",
      invalid_type_error: "Password must be a string",
    })
    .min(1, "Password is required"),
  captchaToken: z.string().trim().min(1).optional(),
});

const forgotPasswordBodySchema = z.object({
  email: z
    .string({
      required_error: "Email is required",
      invalid_type_error: "Email must be a string",
    })
    .email("Email must be a valid email address"),
  captchaToken: z.string().trim().min(1).optional(),
});

const resetPasswordBodySchema = z.object({
  token: z
    .string({
      required_error: "Token is required",
      invalid_type_error: "Token must be a string",
    })
    .min(32, "Token is invalid"),
  password: z
    .string({
      required_error: "Password is required",
      invalid_type_error: "Password must be a string",
    })
    .min(8, "Password must be at least 8 characters long"),
  captchaToken: z.string().trim().min(1).optional(),
});

const forgotUsernameBodySchema = z.object({
  email: z
    .string({
      required_error: "Email is required",
      invalid_type_error: "Email must be a string",
    })
    .email("Email must be a valid email address"),
  captchaToken: z.string().trim().min(1).optional(),
});

const verifyEmailChangeBodySchema = z.object({
  token: z
    .string({
      required_error: "Token is required",
      invalid_type_error: "Token must be a string",
    })
    .min(32, "Token is invalid"),
});

const lockoutSupportBodySchema = z.object({
  email: z
    .string({
      required_error: "Email is required",
      invalid_type_error: "Email must be a string",
    })
    .email("Email must be a valid email address"),
  message: z
    .string({
      required_error: "Message is required",
      invalid_type_error: "Message must be a string",
    })
    .trim()
    .min(10, "Message must be at least 10 characters long")
    .max(2000, "Message must be at most 2000 characters"),
});

interface DomainError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;
}

const isDomainError = (error: unknown): error is DomainError => {
  return (
    error instanceof Error &&
    typeof (error as Partial<DomainError>).statusCode === "number" &&
    typeof (error as Partial<DomainError>).code === "string"
  );
};

const handleDomainError = (reply: FastifyReply, error: unknown) => {
  if (isDomainError(error)) {
    return reply.code(error.statusCode).send({
      error: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    });
  }

  if (error instanceof UserAlreadyExistsError) {
    return reply.code(error.statusCode).send({
      error: error.code,
      message: error.message,
    });
  }

  throw error;
};

const handleValidationError = (reply: FastifyReply, error: z.ZodError) => {
  return reply.code(400).send({
    error: "ValidationError",
    details: error.errors,
  });
};

export async function authRoutes(app: FastifyInstance) {
  const lockoutAlertRecipients = (env.AUTH_LOCKOUT_ALERT_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const getSourceIp = (req: FastifyRequest) => req.ip || "unknown";

  const verifyCaptchaIfRequired = async (
    req: FastifyRequest,
    reply: FastifyReply,
    action: string,
    email: string | null,
    captchaToken?: string,
  ) => {
    const captchaConfigured = Boolean(env.CAPTCHA_PROVIDER && env.CAPTCHA_SECRET);
    if (!captchaConfigured) {
      return true;
    }

    if (!captchaToken) {
      await writeAuditLog(app, req, {
        action: "auth.captcha.required",
        entity: "auth_flow",
        entityId: action,
        data: { action, email },
      });
      reply.code(400).send({
        error: "CaptchaRequired",
        message: "CAPTCHA verification is required.",
      });
      return false;
    }

    if (!captchaToken) {
      return true;
    }

    const captchaValid = await authService.verifyCaptcha(captchaToken);
    if (!captchaValid) {
      await writeAuditLog(app, req, {
        action: "auth.captcha.failed",
        entity: "auth_flow",
        entityId: action,
        data: { action, email },
      });
      reply.code(400).send({
        error: "InvalidCaptcha",
        message: "CAPTCHA verification failed.",
      });
      return false;
    }

    return true;
  };

  const sendLockoutEscalationEmails = (
    req: FastifyRequest,
    details: {
      email: string;
      ipAddress: string;
      offenseLevel: 2 | 3;
      lockoutUntil: string;
    },
  ) => {
    if (lockoutAlertRecipients.length === 0) {
      return;
    }

    for (const recipient of lockoutAlertRecipients) {
      sendEmailInBackground(
        req,
        () => mailerService.sendAuthLockoutEscalationEmail(recipient, details),
        "failed to send lockout escalation alert",
        { recipient, ...details },
      );
    }
  };

  const lockoutMessageForLevel = (offenseLevel: 1 | 2 | 3) => {
    if (offenseLevel === 1) {
      return "Too many failed sign-in attempts. Please try again in 15 minutes.";
    }
    if (offenseLevel === 2) {
      return "Too many failed sign-in attempts. Please try again in 1 hour.";
    }
    return "Too many failed sign-in attempts. Access is locked for the rest of today.";
  };

  app.get("/captcha-config", async () => {
    const configured = Boolean(env.CAPTCHA_PROVIDER && env.CAPTCHA_SITE_KEY);
    const enabled = configured;
    return {
      enabled,
      provider: enabled ? env.CAPTCHA_PROVIDER : null,
      siteKey: enabled ? env.CAPTCHA_SITE_KEY : null,
    };
  });

  const sendEmailInBackground = (
    req: FastifyRequest,
    send: () => Promise<unknown>,
    logMessage: string,
    context: Record<string, unknown>,
  ) => {
    void send().catch((mailError) => {
      req.log.warn({ err: mailError, ...context }, logMessage);
    });
  };

  const buildRequestBaseUrl = (req: FastifyRequest) => {
    const forwardedProtoRaw = req.headers["x-forwarded-proto"];
    const forwardedHostRaw = req.headers["x-forwarded-host"];
    const hostRaw = req.headers.host;

    const forwardedProto = Array.isArray(forwardedProtoRaw)
      ? forwardedProtoRaw[0]
      : forwardedProtoRaw;
    const forwardedHost = Array.isArray(forwardedHostRaw)
      ? forwardedHostRaw[0]
      : forwardedHostRaw;
    const host = Array.isArray(hostRaw) ? hostRaw[0] : hostRaw;

    if (typeof forwardedProto === "string" && typeof forwardedHost === "string") {
      return `${forwardedProto}://${forwardedHost}`;
    }

    if (typeof host === "string") {
      const protocol = req.protocol || "http";
      return `${protocol}://${host}`;
    }

    return env.APP_BASE_URL;
  };

  const normalizeResetToken = (rawToken: string) => {
    const tokenCandidate = rawToken.trim();

    // Support users pasting either the raw token or the full reset URL.
    if (tokenCandidate.includes("://")) {
      try {
        const url = new URL(tokenCandidate);
        const fromQuery = url.searchParams.get("token");
        if (fromQuery) {
          return fromQuery.trim();
        }
      } catch {
        // Fall through and try raw token handling.
      }
    }

    try {
      return decodeURIComponent(tokenCandidate).trim();
    } catch {
      return tokenCandidate;
    }
  };

  // POST /auth/register
  app.post("/register", async (req, reply) => {
    try {
      const body = registerBodySchema.parse(req.body);
      const captchaOk = await verifyCaptchaIfRequired(
        req,
        reply,
        "register",
        body.email,
        body.captchaToken,
      );
      if (!captchaOk) {
        return;
      }

      let userId: string;
      try {
        userId = await authService.createUser(body);
      } catch (error) {
        return handleDomainError(reply, error);
      }

      const user = await authService.getUserById(userId);
      if (user) {
        sendEmailInBackground(
          req,
          () => mailerService.sendWelcomeEmail(user.email, user.name ?? null),
          "failed to send welcome email",
          { userId: user.userId, email: user.email },
        );
      }
      await writeAuditLog(app, req, {
        action: "user.register",
        entity: "user",
        entityId: userId,
        userId,
      });
      return reply.code(201).send(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleValidationError(reply, error);
      }

      throw error;
    }
  });
  // POST /auth/login  (prefix applied in app.ts)
  app.post("/login", async (req, reply) => {
    try {
      const body = loginBodySchema.parse(req.body);
      const sourceIp = getSourceIp(req);
      const captchaOk = await verifyCaptchaIfRequired(
        req,
        reply,
        "login",
        body.email,
        body.captchaToken,
      );
      if (!captchaOk) {
        return;
      }

      const lockoutState = await authLockoutService.getStatus(
        app.redis as any,
        body.email,
        sourceIp,
      );
      if (lockoutState.locked && lockoutState.until) {
        await writeAuditLog(app, req, {
          action: "auth.lockout.blocked",
          entity: "user",
          entityId: body.email,
          data: {
            email: body.email,
            offenseLevel: lockoutState.offenseLevel,
            lockoutUntil: lockoutState.until,
            sourceIp,
          },
        });
        return reply.code(423).send({
          error: "LockedOut",
          message: lockoutMessageForLevel(lockoutState.offenseLevel as 1 | 2 | 3),
          lockout: {
            offenseLevel: lockoutState.offenseLevel,
            until: lockoutState.until,
            remainingSeconds: lockoutState.remainingSeconds,
            supportRequired: lockoutState.supportRequired,
            redirectTo: "/auth/lockout",
          },
        });
      }

      let user;
      try {
        user = await authService.validateCredentials(body);
      } catch (error) {
        return handleDomainError(reply, error);
      }

      if (!user) {
        const failureState = await authLockoutService.recordFailure(
          app.redis as any,
          body.email,
          sourceIp,
        );
        if (failureState.locked && failureState.until) {
          await writeAuditLog(app, req, {
            action: "auth.lockout.triggered",
            entity: "user",
            entityId: body.email,
            data: {
              email: body.email,
              offenseLevel: failureState.offenseLevel,
              lockoutUntil: failureState.until,
              sourceIp,
            },
          });
          if (failureState.offenseLevel >= 2) {
            sendLockoutEscalationEmails(req, {
              email: body.email,
              ipAddress: sourceIp,
              offenseLevel: failureState.offenseLevel as 2 | 3,
              lockoutUntil: failureState.until,
            });
          }

          return reply.code(423).send({
            error: "LockedOut",
            message: lockoutMessageForLevel(failureState.offenseLevel as 1 | 2 | 3),
            lockout: {
              offenseLevel: failureState.offenseLevel,
              until: failureState.until,
              remainingSeconds: failureState.remainingSeconds,
              supportRequired: failureState.supportRequired,
              redirectTo: "/auth/lockout",
            },
          });
        }

        await writeAuditLog(app, req, {
          action: "auth.login.failed",
          entity: "user",
          entityId: body.email,
          data: {
            email: body.email,
            sourceIp,
            warning: failureState.warning,
          },
        });
        return reply.code(401).send({
          error: "Unauthorized",
          message: "Invalid email or password",
          warning: failureState.warning,
        });
      }

      await authLockoutService.clearFailureHistory(app.redis as any, body.email, sourceIp);

      // ⬇️ Create opaque server-side session + set signed 'sid' cookie
      await app.sessions.create(reply, user.userId, user.role ?? undefined);

      await writeAuditLog(app, req, {
        action: "auth.login",
        entity: "session",
        entityId: req.session?.id ?? null,
        userId: user.userId,
      });

      return reply.code(201).send({
        user: {
          id: user.userId,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleValidationError(reply, error);
      }

      throw error;
    }
  });

  // POST /auth/logout
  app.post("/logout", async (req, reply) => {
    await writeAuditLog(app, req, {
      action: "auth.logout",
      entity: "session",
      entityId: req.session?.id ?? null,
      userId: req.user?.id ?? null,
    });
    await app.sessions.destroy(reply, req.session?.id ?? null);
    return reply.send({ ok: true });
  });

  // POST /auth/forgot-password
  app.post("/forgot-password", async (req, reply) => {
    try {
      const body = forgotPasswordBodySchema.parse(req.body);
      const captchaOk = await verifyCaptchaIfRequired(
        req,
        reply,
        "forgot_password",
        body.email,
        body.captchaToken,
      );
      if (!captchaOk) {
        return;
      }

      const user = await authService.getUserByEmail(body.email);
      if (user) {
        const token = randomBytes(32).toString("hex");
        const tokenKey = `password-reset:${token}`;
        await app.redis.set(
          tokenKey,
          user.userId,
          "EX",
          env.PASSWORD_RESET_TOKEN_TTL_SECONDS,
        );

        const base = buildRequestBaseUrl(req).replace(/\/$/, "");
        const resetUrl = `${base}/reset-password?token=${encodeURIComponent(token)}`;

        sendEmailInBackground(
          req,
          () =>
            mailerService.sendPasswordResetEmail(
              user.email,
              resetUrl,
              env.PASSWORD_RESET_TOKEN_TTL_SECONDS,
            ),
          "failed to send password reset email",
          { userId: user.userId, email: user.email },
        );
        await writeAuditLog(app, req, {
          action: "auth.password_reset.requested",
          entity: "user",
          entityId: user.userId,
          userId: user.userId,
        });
      }

      return reply.send({
        ok: true,
        message:
          "If an account exists for that email, a password reset email has been sent.",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleValidationError(reply, error);
      }

      throw error;
    }
  });

  // POST /auth/reset-password
  app.post("/reset-password", async (req, reply) => {
    try {
      const body = resetPasswordBodySchema.parse(req.body);
      const captchaOk = await verifyCaptchaIfRequired(
        req,
        reply,
        "reset_password",
        null,
        body.captchaToken,
      );
      if (!captchaOk) {
        return;
      }
      const normalizedToken = normalizeResetToken(body.token);
      const tokenKey = `password-reset:${normalizedToken}`;
      const userId = await app.redis.get(tokenKey);

      if (!userId) {
        return reply.code(400).send({
          error: "InvalidToken",
          message: "The password reset token is invalid or expired.",
        });
      }

      const updated = await authService.updatePasswordByUserId(
        userId,
        body.password,
      );
      if (!updated) {
        await app.redis.del(tokenKey);
        return reply.code(400).send({
          error: "InvalidToken",
          message: "The password reset token is invalid or expired.",
        });
      }

      await app.redis.del(tokenKey);
      await writeAuditLog(app, req, {
        action: "auth.password_reset.completed",
        entity: "user",
        entityId: userId,
        userId,
      });
      return reply.send({ ok: true, message: "Password has been reset." });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleValidationError(reply, error);
      }

      throw error;
    }
  });

  // POST /auth/forgot-username
  app.post("/forgot-username", async (req, reply) => {
    try {
      const body = forgotUsernameBodySchema.parse(req.body);
      const captchaOk = await verifyCaptchaIfRequired(
        req,
        reply,
        "forgot_username",
        body.email,
        body.captchaToken,
      );
      if (!captchaOk) {
        return;
      }
      const user = await authService.getUserByEmail(body.email);
      if (user) {
        sendEmailInBackground(
          req,
          () => mailerService.sendUsernameReminderEmail(user.email, user.email),
          "failed to send username reminder email",
          { userId: user.userId, email: user.email },
        );
        await writeAuditLog(app, req, {
          action: "auth.username_reminder.requested",
          entity: "user",
          entityId: user.userId,
          userId: user.userId,
        });
      }

      return reply.send({
        ok: true,
        message:
          "If an account exists for that email, a username reminder email has been sent.",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleValidationError(reply, error);
      }

      throw error;
    }
  });

  app.post("/verify-email-change", async (req, reply) => {
    try {
      const body = verifyEmailChangeBodySchema.parse(req.body);
      const token = body.token.trim();
      const tokenKey = `email-change:${token}`;
      const payloadRaw = await app.redis.get(tokenKey);

      if (!payloadRaw) {
        return reply.code(400).send({
          error: "InvalidToken",
          message: "The email verification token is invalid or expired.",
        });
      }

      const payloadSchema = z.object({
        userId: z.string().uuid(),
        email: z.string().email(),
      });
      const payload = payloadSchema.parse(JSON.parse(payloadRaw));

      const existing = await authService.getUserByEmail(payload.email);
      if (existing && existing.userId !== payload.userId) {
        await app.redis.del(tokenKey);
        return reply.code(409).send({
          error: "UserAlreadyExists",
          message: "An account with that email already exists.",
        });
      }

      const updated = await authService.updateEmailByUserId(payload.userId, payload.email);
      await app.redis.del(tokenKey);

      if (!updated) {
        return reply.code(400).send({
          error: "InvalidToken",
          message: "The email verification token is invalid or expired.",
        });
      }

      await writeAuditLog(app, req, {
        action: "account.email_change.completed",
        entity: "user",
        entityId: payload.userId,
        userId: payload.userId,
        data: { email: payload.email },
      });

      return reply.send({ ok: true, message: "Email address verified and updated." });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleValidationError(reply, error);
      }

      throw error;
    }
  });

  // (optional) GET /auth/me – quick probe that auth works
  app.get("/me", { preHandler: app.auth.verifySession }, async (req) => {
    const user = await authService.getUserById(req.user!.id);
    if (!user) {
      return { user: null };
    }

    return {
      user: {
        id: user.userId,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  });

  app.post("/lockout-support", async (req, reply) => {
    try {
      const body = lockoutSupportBodySchema.parse(req.body);
      const sourceIp = getSourceIp(req);
      const lockoutState = await authLockoutService.getStatus(
        app.redis as any,
        body.email,
        sourceIp,
      );

      if (!lockoutState.locked || lockoutState.offenseLevel < 3) {
        await writeAuditLog(app, req, {
          action: "auth.lockout.support_rejected",
          entity: "user",
          entityId: body.email,
          data: { email: body.email, sourceIp },
        });
        return reply.code(409).send({
          error: "LockoutSupportUnavailable",
          message: "Support requests are available only during a third-offense lockout.",
        });
      }

      if (lockoutAlertRecipients.length === 0) {
        await writeAuditLog(app, req, {
          action: "auth.lockout.support_unavailable",
          entity: "user",
          entityId: body.email,
          data: { email: body.email, sourceIp },
        });
        return reply.code(503).send({
          error: "SupportUnavailable",
          message: "Support contact is not configured.",
        });
      }

      for (const recipient of lockoutAlertRecipients) {
        sendEmailInBackground(
          req,
          () =>
            mailerService.sendAuthLockoutSupportRequestEmail(recipient, {
              email: body.email,
              ipAddress: sourceIp,
              message: body.message,
            }),
          "failed to send lockout support request",
          { recipient, email: body.email, ipAddress: sourceIp },
        );
      }

      await writeAuditLog(app, req, {
        action: "auth.lockout.support_requested",
        entity: "user",
        entityId: body.email,
        data: { email: body.email, sourceIp },
      });
      return reply.send({ ok: true, message: "Support request sent." });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleValidationError(reply, error);
      }

      throw error;
    }
  });
}

const apiTokenBodySchema = z.object({
  name: z
    .string({
      required_error: "Name is required",
      invalid_type_error: "Name must be a string",
    })
    .trim()
    .min(1, "Name must not be empty")
    .max(120, "Name must be at most 120 characters"),
  permissions: z.record(z.any()).optional(),
});

const apiTokenParamsSchema = z.object({
  tokenId: z
    .string({
      required_error: "Token ID is required",
      invalid_type_error: "Token ID must be a string",
    })
    .uuid("Token ID must be a valid UUID"),
});

export async function adminApiTokenRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.auth.verifySession);
  app.addHook("preHandler", app.auth.requireRole("admin"));

  app.get("/", async (req) => {
    const userId = req.user!.id;
    const tokens = await authService.listApiTokens(userId);
    return tokens;
  });

  app.post("/", async (req, reply) => {
    try {
      const payload = apiTokenBodySchema.parse(req.body);
      const userId = req.user!.id;
      const token = await authService.createApiToken(
        userId,
        payload.name,
        payload.permissions,
      );
      await writeAuditLog(app, req, {
        action: "admin.api_token.created",
        entity: "api_token",
        entityId: token.tokenId,
        userId,
        data: { name: payload.name },
      });
      return reply.code(201).send(token);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleValidationError(reply, error);
      }

      throw error;
    }
  });

  app.delete("/:tokenId", async (req, reply) => {
    try {
      const { tokenId } = apiTokenParamsSchema.parse(req.params);
      const userId = req.user!.id;
      const revoked = await authService.revokeApiToken(userId, tokenId);

      if (!revoked) {
        return reply
          .code(404)
          .send({ error: "NotFound", message: "Token not found" });
      }

      await writeAuditLog(app, req, {
        action: "admin.api_token.revoked",
        entity: "api_token",
        entityId: tokenId,
        userId,
      });

      return reply.status(204).send();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleValidationError(reply, error);
      }

      throw error;
    }
  });
}
