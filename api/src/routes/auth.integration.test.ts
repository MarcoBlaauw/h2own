import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authRoutes } from "./auth.js";
import { UserAlreadyExistsError, authService } from "../services/auth.js";
import { authLockoutService } from "../services/auth-lockout.js";
import { mailerService } from "../services/mailer.js";
import { env } from "../env.js";

describe("POST /auth/register integration", () => {
  let app: ReturnType<typeof Fastify>;
  let createSessionMock: ReturnType<typeof vi.fn>;
  let destroySessionMock: ReturnType<typeof vi.fn>;
  let verifySessionMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    (env as any).AUTH_LOCKOUT_ALERT_EMAILS = "admin@example.com";
    app = Fastify();
    const tokenStore = new Map<string, string>();
    createSessionMock = vi.fn(async () => {});
    destroySessionMock = vi.fn(async () => {});
    verifySessionMock = vi.fn(async (req: any) => {
      req.user = { id: "user-123", role: "admin" };
    });
    app.decorate("sessions", {
      create: createSessionMock,
      destroy: destroySessionMock,
    } as any);
    app.decorate("auth", {
      verifySession: verifySessionMock,
      requireRole: () => async () => {},
    } as any);
    app.decorate("audit", {
      log: vi.fn(async () => {}),
    } as any);
    app.decorate("redis", {
      set: vi.fn(async (key: string, value: string) => {
        tokenStore.set(key, value);
        return "OK";
      }),
      get: vi.fn(async (key: string) => tokenStore.get(key) ?? null),
      del: vi.fn(async (key: string) => {
        const existed = tokenStore.delete(key);
        return existed ? 1 : 0;
      }),
    } as any);
    vi.spyOn(authLockoutService, "getStatus").mockResolvedValue({
      locked: false,
      offenseLevel: 0,
      until: null,
      remainingSeconds: 0,
      supportRequired: false,
      warning: null,
    });
    vi.spyOn(authLockoutService, "recordFailure").mockResolvedValue({
      locked: false,
      offenseLevel: 0,
      until: null,
      remainingSeconds: 0,
      supportRequired: false,
      warning: null,
      attemptsLastMinute: 1,
      attemptsLastFiveMinutes: 1,
    });
    vi.spyOn(authLockoutService, "clearFailureHistory").mockResolvedValue();

    await app.register(authRoutes, { prefix: "/auth" });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  it("returns 201 with the created user's profile", async () => {
    const userId = "3e3b618f-61c1-44d5-91a9-7e9c1cc8ae0b";
    const payload = { email: "new-user@example.com", password: "password123", name: "New User" };

    vi.spyOn(authService, "createUser").mockResolvedValueOnce(userId);
    vi.spyOn(authService, "getUserById").mockResolvedValueOnce({
      userId,
      email: payload.email,
      name: payload.name,
      role: "member",
      createdAt: new Date("2024-06-01T12:34:56.000Z"),
    } as any);

    const sendWelcomeSpy = vi
      .spyOn(mailerService, "sendWelcomeEmail")
      .mockResolvedValueOnce({ sent: true, skipped: false });

    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload,
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      userId,
      email: payload.email,
      name: payload.name,
      role: "member",
      createdAt: "2024-06-01T12:34:56.000Z",
    });
    expect(sendWelcomeSpy).toHaveBeenCalledWith(payload.email, payload.name);
  });

  it("returns 409 when registering with an existing email", async () => {
    const userId = "8b16a54d-1b3c-4d55-97f5-395d8fd9c3d2";
    const payload = { email: "user@example.com", password: "password123", name: "User" };

    vi.spyOn(authService, "createUser")
      .mockResolvedValueOnce(userId)
      .mockRejectedValueOnce(new UserAlreadyExistsError());

    vi.spyOn(authService, "getUserById").mockResolvedValue({
      userId,
      email: payload.email,
      name: payload.name,
      role: "member",
      createdAt: new Date().toISOString(),
    } as any);

    const firstResponse = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload,
    });

    expect(firstResponse.statusCode).toBe(201);

    const secondResponse = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload,
    });

    expect(secondResponse.statusCode).toBe(409);
    expect(secondResponse.json()).toEqual({
      error: "UserAlreadyExists",
      message: "An account with that email already exists",
    });
  });

  it("creates a session with the user's role on login", async () => {
    const userId = "c6d26f34-8c1c-4ce3-8b18-40c1f0c5d2f6";
    vi.spyOn(authService, "validateCredentials").mockResolvedValue({
      userId,
      email: "admin@example.com",
      name: "Admin", 
      role: "admin",
    });

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "admin@example.com", password: "password123" },
    });

    expect(response.statusCode).toBe(201);
    expect(authLockoutService.getStatus).toHaveBeenCalled();
    expect(authLockoutService.clearFailureHistory).toHaveBeenCalled();
    expect(createSessionMock).toHaveBeenCalledTimes(1);
    const [replyArg, sessionUserId, sessionRole] = createSessionMock.mock.calls[0];
    expect(replyArg).toBeDefined();
    expect(sessionUserId).toBe(userId);
    expect(sessionRole).toBe("admin");
    expect(response.json()).toEqual({
      user: {
        id: userId,
        email: "admin@example.com",
        name: "Admin",
        role: "admin",
      },
    });
  });

  it("returns 401 when credentials are invalid", async () => {
    vi.spyOn(authService, "validateCredentials").mockResolvedValueOnce(null);
    vi.spyOn(authLockoutService, "recordFailure").mockResolvedValueOnce({
      locked: false,
      offenseLevel: 0,
      until: null,
      remainingSeconds: 0,
      supportRequired: false,
      warning: "Warning: one more failed attempt in the next minute will temporarily lock your account.",
      attemptsLastMinute: 4,
      attemptsLastFiveMinutes: 4,
    });

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "admin@example.com", password: "wrong" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: "Unauthorized",
      message: "Invalid email or password",
      warning:
        "Warning: one more failed attempt in the next minute will temporarily lock your account.",
    });
    expect(createSessionMock).not.toHaveBeenCalled();
    expect((app as any).audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "auth.login.failed",
        entity: "user",
        entityId: "admin@example.com",
      }),
    );
  });

  it("returns 423 when the user is already locked out", async () => {
    const validateSpy = vi.spyOn(authService, "validateCredentials");
    vi.spyOn(authLockoutService, "getStatus").mockResolvedValueOnce({
      locked: true,
      offenseLevel: 2,
      until: "2026-01-15T10:00:00.000Z",
      remainingSeconds: 3600,
      supportRequired: false,
      warning: null,
    });

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "admin@example.com", password: "wrong" },
    });

    expect(response.statusCode).toBe(423);
    expect(response.json()).toMatchObject({
      error: "LockedOut",
      lockout: {
        offenseLevel: 2,
        until: "2026-01-15T10:00:00.000Z",
        supportRequired: false,
        redirectTo: "/auth/lockout",
      },
    });
    expect(createSessionMock).not.toHaveBeenCalled();
    expect(validateSpy).not.toHaveBeenCalled();
    expect((app as any).audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "auth.lockout.blocked",
        entity: "user",
        entityId: "admin@example.com",
      }),
    );
  });

  it("returns 423 and lockout payload when a failed attempt triggers lockout", async () => {
    vi.spyOn(authService, "validateCredentials").mockResolvedValueOnce(null);
    vi.spyOn(authLockoutService, "recordFailure").mockResolvedValueOnce({
      locked: true,
      offenseLevel: 3,
      until: "2026-01-15T23:59:59.000Z",
      remainingSeconds: 30000,
      supportRequired: true,
      warning: null,
      attemptsLastMinute: 5,
      attemptsLastFiveMinutes: 10,
    });

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "admin@example.com", password: "wrong" },
    });

    expect(response.statusCode).toBe(423);
    expect(response.json()).toMatchObject({
      error: "LockedOut",
      lockout: {
        offenseLevel: 3,
        until: "2026-01-15T23:59:59.000Z",
        supportRequired: true,
        redirectTo: "/auth/lockout",
      },
    });
  });

  it("returns the user's role from /auth/me", async () => {
    const userId = "5f0b3f1d-8f2f-4de7-8d32-b0a95f0f5c20";
    vi.spyOn(authService, "getUserById").mockResolvedValue({
      userId,
      email: "member@example.com",
      name: "Member",
      role: "member",
      createdAt: new Date().toISOString(),
    } as any);

    const response = await app.inject({
      method: "GET",
      url: "/auth/me",
    });

    expect(verifySessionMock).toHaveBeenCalled();
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      user: {
        id: userId,
        email: "member@example.com",
        name: "Member",
        role: "member",
      },
    });
  });

  it("destroys the active session on logout", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/logout",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
    expect(destroySessionMock).toHaveBeenCalledTimes(1);
    const [replyArg, sessionIdArg] = destroySessionMock.mock.calls[0];
    expect(replyArg).toBeDefined();
    expect(sessionIdArg).toBeNull();
  });

  it("accepts forgot-password requests and sends reset email when user exists", async () => {
    vi.spyOn(authService, "getUserByEmail").mockResolvedValueOnce({
      userId: "u-1",
      email: "member@example.com",
      name: "Member",
      role: "member",
      isActive: true,
    } as any);
    const resetSpy = vi
      .spyOn(mailerService, "sendPasswordResetEmail")
      .mockResolvedValueOnce({ sent: true, skipped: false });

    const response = await app.inject({
      method: "POST",
      url: "/auth/forgot-password",
      payload: { email: "member@example.com" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().ok).toBe(true);
    expect(resetSpy).toHaveBeenCalledTimes(1);
  });

  it("resets password using a valid token", async () => {
    vi.spyOn(authService, "getUserByEmail").mockResolvedValueOnce({
      userId: "u-1",
      email: "member@example.com",
      name: "Member",
      role: "member",
      isActive: true,
    } as any);
    vi.spyOn(mailerService, "sendPasswordResetEmail").mockResolvedValueOnce({
      sent: true,
      skipped: false,
    });

    const setResponse = await app.inject({
      method: "POST",
      url: "/auth/forgot-password",
      payload: { email: "member@example.com" },
    });
    expect(setResponse.statusCode).toBe(200);

    const redisSetCall = (app.redis.set as any).mock.calls[0];
    const tokenKey = redisSetCall[0] as string;
    const token = tokenKey.replace("password-reset:", "");

    vi.spyOn(authService, "updatePasswordByUserId").mockResolvedValueOnce(true);

    const response = await app.inject({
      method: "POST",
      url: "/auth/reset-password",
      payload: { token, password: "new-password-123" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      message: "Password has been reset.",
    });
  });

  it("returns 400 for invalid reset token", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/reset-password",
      payload: { token: "f".repeat(32), password: "new-password-123" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "InvalidToken",
      message: "The password reset token is invalid or expired.",
    });
  });

  it("accepts forgot-username requests and sends reminder when user exists", async () => {
    vi.spyOn(authService, "getUserByEmail").mockResolvedValueOnce({
      userId: "u-1",
      email: "member@example.com",
      name: "Member",
      role: "member",
      isActive: true,
    } as any);
    const reminderSpy = vi
      .spyOn(mailerService, "sendUsernameReminderEmail")
      .mockResolvedValueOnce({ sent: true, skipped: false });

    const response = await app.inject({
      method: "POST",
      url: "/auth/forgot-username",
      payload: { email: "member@example.com" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().ok).toBe(true);
    expect(reminderSpy).toHaveBeenCalledWith(
      "member@example.com",
      "member@example.com",
    );
  });

  it("accepts a lockout support request when third-offense lockout is active", async () => {
    vi.spyOn(authLockoutService, "getStatus").mockResolvedValueOnce({
      locked: true,
      offenseLevel: 3,
      until: "2026-01-15T23:59:59.000Z",
      remainingSeconds: 1000,
      supportRequired: true,
      warning: null,
    });
    const supportSpy = vi
      .spyOn(mailerService, "sendAuthLockoutSupportRequestEmail")
      .mockResolvedValue({ sent: true, skipped: false });
    const response = await app.inject({
      method: "POST",
      url: "/auth/lockout-support",
      payload: {
        email: "member@example.com",
        message: "I am locked out and need urgent access for pool maintenance.",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, message: "Support request sent." });
    expect(supportSpy).toHaveBeenCalled();
    expect((app as any).audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "auth.lockout.support_requested",
        entity: "user",
        entityId: "member@example.com",
      }),
    );
  });
});
