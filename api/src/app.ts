// src/app.ts
import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import fastifyRedis from "@fastify/redis";
import { randomBytes } from "crypto";
import { env } from "./env.js";
import { healthCheck } from "./db/index.js";

// ⬇️ Import route GROUPS directly (no fp wrappers) so prefixes work automatically
import { authRoutes } from "./routes/auth";
import { poolsRoutes } from "./routes/pools";
import { testsRoutes } from "./routes/tests";
import { chemicalsRoutes } from "./routes/chemicals";
import { adminUsersRoutes } from "./routes/admin-users";
import { adminLocationsRoutes } from "./routes/admin-locations";
import { adminPoolsRoutes } from "./routes/admin-pools";
import { createRedisSessionStore } from "./services/session-store.js";

async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "req.body.password",
        ],
        remove: true,
      },
      serializers: {
        // keep only statusCode from the response object
        res(res) {
          return { statusCode: res.statusCode };
        },
      },
    },
  });

  // If you run behind a proxy/ingress that terminates TLS, uncomment:
  // app.setTrustProxy(true);

  // 🔎 Log every route as it is registered (dev-only)
  app.addHook("onRoute", (o) => {
    const method = Array.isArray(o.method) ? o.method.join(",") : o.method;
    const path = (o as any).path ?? `${(o as any).prefix ?? ""}${o.url}`;
    app.log.info({ method, url: o.url, path }, "route registered");
  });

  // --- Global hardening & cross-origin ---
  await app.register(helmet);
  await app.register(cors, { origin: env.CORS_ORIGIN, credentials: true });
  await app.register(cookie, { secret: env.SESSION_SECRET });

  await app.register(fastifyRedis, {
    url: env.REDIS_URL,
    // Optional reconnect delays can be tuned here if needed.
  });

  // --- Redis-backed session store ---
  const sessionStore = createRedisSessionStore(app.redis, {
    ttlSeconds: env.SESSION_TTL_SECONDS,
    prefix: env.SESSION_PREFIX,
    logger: app.log,
  });

  // Expose a small session API for routes to use (login/logout)
  app.decorate("sessions", {
    create: async (reply, userId: string, role?: string) => {
      const sid = randomBytes(32).toString("hex");
      const expiresAt = Math.floor(Date.now() / 1000) + sessionStore.ttlSeconds;

      await sessionStore.save(sid, {
        userId,
        role: role ?? null,
        expiresAt,
      });

      reply.setCookie("sid", sid, {
        path: "/",
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "lax", // consider 'strict' + CSRF tokens if UX allows
        maxAge: sessionStore.ttlSeconds, // seconds (cookie)
        signed: true,
      });

      return sid;
    },
    destroy: async (reply, sid?: string | null) => {
      if (sid) {
        try {
          await sessionStore.delete(sid);
        } catch (error) {
          app.log.error({ err: error, sid }, "failed to remove session");
        }
      }
      reply.clearCookie("sid", { path: "/" });
    },
    touch: async (sid?: string | null) => {
      if (!sid) return;
      try {
        await sessionStore.touch(sid);
      } catch (error) {
        app.log.error({ err: error, sid }, "failed to refresh session ttl");
      }
    },
  });

  // --- Load session for each request (read-only on request object) ---
  app.addHook("onRequest", async (req, reply) => {
    if (app.log.level === "debug") {
      const hasCookies = !!req.cookies && Object.keys(req.cookies).length > 0;
      const hasSignedSid = Boolean(req.cookies?.sid);
      app.log.debug({ hasCookies, hasSignedSid }, "incoming cookies metadata");
    }
    let sid: string | null = null;
    let userId: string | null = null;
    let role: string | null = null;

    const raw = req.cookies.sid;
    if (raw) {
      const res = req.server.unsignCookie(raw);
      if (res.valid) {
        sid = res.value;
        if (sid) {
          try {
            const record = await sessionStore.find(sid);
            if (record) {
              userId = record.userId ?? null;
              role = (record.role as string | null) ?? null;
              await app.sessions.touch(sid);
            } else {
              reply.clearCookie("sid", { path: "/" });
              sid = null;
            }
          } catch (error) {
            app.log.error({ err: error, sid }, "failed to load session");
            sid = null;
            reply.clearCookie("sid", { path: "/" });
          }
        }
      } else {
        reply.clearCookie("sid", { path: "/" });
      }
    }

    req.session = {
      id: sid,
      userId,
      role,
      delete: async () => app.sessions.destroy(reply, sid),
    };

    if (userId) {
      req.user = { id: userId, role: role ?? undefined };
    }
  });

  // --- Global auth helpers (available everywhere) ---
  app.decorate("auth", {
    verifySession: async (req, reply) => {
      if (!req.session?.userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
    },
    requireRole: (role: string) => {
      return async (req, reply) => {
        const current = req.user?.role;
        if (current !== role) {
          return reply.code(403).send({ error: "Forbidden" });
        }
      };
    },
  });

  // --- Health endpoints ---
  app.get("/healthz", async () => ({ ok: true }));
  app.get("/db-health", async (_req, reply) => {
    try {
      await healthCheck();
      reply.send({ ok: true, message: "Database connection successful" });
    } catch {
      reply
        .status(500)
        .send({ ok: false, message: "Database connection failed" });
    }
  });

  // --- Route groups (plain plugins so prefixes & per-scope hooks work) ---
  await app.register(authRoutes, { prefix: "/auth" }); // public login/logout
  await app.register(poolsRoutes, { prefix: "/pools" }); // secure these inside the module with app.auth.verifySession
  await app.register(testsRoutes, { prefix: "/tests" });
  await app.register(chemicalsRoutes, { prefix: "/chemicals" });
  await app.register(adminUsersRoutes, { prefix: "/admin/users" });
  await app.register(adminLocationsRoutes, { prefix: "/admin/locations" });
  await app.register(adminPoolsRoutes, { prefix: "/admin/pools" });

  // --- Dev convenience route ---
  app.get("/test", async () => ({ ok: true, message: "test route" }));

  // Finalize & print
  await app.ready();
  app.log.info("\n" + app.printRoutes({ includeMeta: true }));

  return app;
}

const start = async () => {
  const app = await buildApp();
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
};
start();
