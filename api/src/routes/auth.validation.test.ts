import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authRoutes } from "./auth.js";
import { authService } from "../services/auth.js";

describe("Auth route validation", () => {
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

  it("returns 400 when registering without required fields", async () => {
    const createSpy = vi.spyOn(authService, "createUser");

    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { password: "password123" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "ValidationError",
      details: [
        expect.objectContaining({
          path: ["email"],
          message: "Email is required",
        }),
      ],
    });
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("returns 400 when login payload is invalid", async () => {
    const validateSpy = vi.spyOn(authService, "validateCredentials");

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "not-an-email", password: "" },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error).toBe("ValidationError");
    expect(body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ["email"], message: "Email must be a valid email address" }),
        expect.objectContaining({ path: ["password"], message: "Password is required" }),
      ])
    );
    expect(validateSpy).not.toHaveBeenCalled();
  });
});

