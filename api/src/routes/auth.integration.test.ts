import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authRoutes } from "./auth.js";
import { UserAlreadyExistsError, authService } from "../services/auth.js";

describe("POST /auth/register integration", () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    app = Fastify();
    app.decorate("sessions", {
      create: vi.fn(async () => {}),
      destroy: vi.fn(async () => {}),
    } as any);
    app.decorate("auth", {
      verifySession: vi.fn(async () => {}),
      requireRole: () => async () => {},
    } as any);

    await app.register(authRoutes, { prefix: "/auth" });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
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
});

