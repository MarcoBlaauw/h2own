import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authRoutes } from "./auth.js";
import { UserAlreadyExistsError, authService } from "../services/auth.js";

describe("POST /auth/register integration", () => {
  let app: ReturnType<typeof Fastify>;
  let createSessionMock: ReturnType<typeof vi.fn>;
  let destroySessionMock: ReturnType<typeof vi.fn>;
  let verifySessionMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    app = Fastify();
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

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "admin@example.com", password: "wrong" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: "Unauthorized",
      message: "Invalid email or password",
    });
    expect(createSessionMock).not.toHaveBeenCalled();
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
});

