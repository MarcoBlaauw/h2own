import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { adminApiTokenRoutes } from "./auth.js";
import { authService } from "../services/auth.js";

describe("admin api token routes", () => {
  let app: ReturnType<typeof Fastify>;
  let verifySessionMock: ReturnType<typeof vi.fn>;
  let requireRoleMock: ReturnType<typeof vi.fn>;
  let roleHandlers: Array<ReturnType<typeof vi.fn>>;
  const currentUserId = "f2081cbc-3d8d-48fb-86cc-1315d5cba29f";

  beforeEach(async () => {
    app = Fastify();
    roleHandlers = [];

    verifySessionMock = vi.fn(async (req: any) => {
      req.user = { id: currentUserId, role: "admin" };
    });

    requireRoleMock = vi.fn((role: string) => {
      const handler = vi.fn(async (req: any, reply: any) => {
        if (req.user?.role !== role) {
          return reply.code(403).send({ error: "Forbidden" });
        }
      });
      roleHandlers.push(handler);
      return handler;
    });

    app.decorate("auth", {
      verifySession: verifySessionMock,
      requireRole: requireRoleMock,
    } as any);

    await app.register(adminApiTokenRoutes, { prefix: "/admin/api-tokens" });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  it("lists api tokens for the current admin", async () => {
    const listSpy = vi.spyOn(authService, "listApiTokens").mockResolvedValue([
      {
        tokenId: "f49c7a9c-1f5a-4cc9-a6c4-4e5b7c23f8b1",
        name: "Production access",
        createdAt: new Date("2024-03-10T00:00:00.000Z"),
        lastUsedAt: new Date("2024-03-15T12:00:00.000Z"),
        revoked: false,
        permissions: { scope: "read" },
      },
    ] as any);

    const response = await app.inject({ method: "GET", url: "/admin/api-tokens" });

    expect(response.statusCode).toBe(200);
    expect(listSpy).toHaveBeenCalledWith(currentUserId);
    expect(verifySessionMock).toHaveBeenCalled();
    expect(requireRoleMock).toHaveBeenCalledWith("admin");
    expect(response.json()).toEqual([
      {
        tokenId: "f49c7a9c-1f5a-4cc9-a6c4-4e5b7c23f8b1",
        name: "Production access",
        createdAt: new Date("2024-03-10T00:00:00.000Z").toISOString(),
        lastUsedAt: new Date("2024-03-15T12:00:00.000Z").toISOString(),
        revoked: false,
        permissions: { scope: "read" },
      },
    ]);
  });

  it("creates a token, returns a preview once, and excludes it from listings", async () => {
    const tokenId = "e3cf7d16-8c61-4a45-8a7a-d5f5b52b5d3d";
    const createdAt = new Date("2024-04-01T00:00:00.000Z");

    const createSpy = vi
      .spyOn(authService, "createApiToken")
      .mockResolvedValue({ tokenId, name: "CLI", createdAt, preview: "tok_123" });

    const listSpy = vi.spyOn(authService, "listApiTokens").mockResolvedValue([
      {
        tokenId,
        name: "CLI",
        createdAt,
        lastUsedAt: null,
        revoked: false,
        permissions: {},
      },
    ] as any);

    const createResponse = await app.inject({
      method: "POST",
      url: "/admin/api-tokens",
      payload: { name: "CLI" },
    });

    expect(createResponse.statusCode).toBe(201);
    expect(createSpy).toHaveBeenCalledWith(currentUserId, "CLI", undefined);
    expect(createResponse.json()).toEqual({
      tokenId,
      name: "CLI",
      createdAt: createdAt.toISOString(),
      preview: "tok_123",
    });

    const listResponse = await app.inject({ method: "GET", url: "/admin/api-tokens" });

    expect(listResponse.statusCode).toBe(200);
    expect(listSpy).toHaveBeenCalledTimes(1);
    expect(listResponse.json()).toEqual([
      {
        tokenId,
        name: "CLI",
        createdAt: createdAt.toISOString(),
        lastUsedAt: null,
        revoked: false,
        permissions: {},
      },
    ]);
    expect(listResponse.json()[0]).not.toHaveProperty("preview");
  });

  it("revokes tokens by id", async () => {
    const revokeSpy = vi.spyOn(authService, "revokeApiToken").mockResolvedValue(true);

    const response = await app.inject({
      method: "DELETE",
      url: "/admin/api-tokens/2f1c77f5-6c20-4f35-b615-3d66a8e374d5",
    });

    expect(response.statusCode).toBe(204);
    expect(revokeSpy).toHaveBeenCalledWith(
      currentUserId,
      "2f1c77f5-6c20-4f35-b615-3d66a8e374d5"
    );
  });

  it("returns 404 when attempting to revoke a missing token", async () => {
    vi.spyOn(authService, "revokeApiToken").mockResolvedValue(false);

    const response = await app.inject({
      method: "DELETE",
      url: "/admin/api-tokens/bbd2b0d6-5f4a-4f8c-a5c1-ef1d6a08a3d1",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "NotFound", message: "Token not found" });
  });

  it("validates create payloads", async () => {
    const createSpy = vi.spyOn(authService, "createApiToken");
    const response = await app.inject({ method: "POST", url: "/admin/api-tokens", payload: {} });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("ValidationError");
    expect(createSpy).not.toHaveBeenCalled();
  });
});
