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
import { authRoutes, adminApiTokenRoutes } from "./routes/auth";
import { poolsRoutes } from "./routes/pools";
import { testsRoutes } from "./routes/tests";
import { chemicalsRoutes } from "./routes/chemicals";
import { adminUsersRoutes } from "./routes/admin-users";
import { adminLocationsRoutes } from "./routes/admin-locations";
import { adminPoolsRoutes } from "./routes/admin-pools";
import { adminAuditLogRoutes } from "./routes/admin-audit-log";
import { adminNotificationTemplateRoutes } from "./routes/admin-notification-templates";
import { adminReadinessRoutes } from "./routes/admin-readiness";
import { adminIntegrationsRoutes } from "./routes/admin-integrations";
import { adminRoleCapabilitiesRoutes } from "./routes/admin-role-capabilities";
import { integrationsRoutes } from "./routes/integrations";
import { notificationRoutes } from "./routes/notifications";
import { messagesRoutes } from "./routes/messages";
import { billingRoutes } from "./routes/billing";
import { contactRoutes } from "./routes/contact";
import { locationsRoutes } from "./routes/locations";
import { photosRoutes } from "./routes/photos";
import { meRoutes } from "./routes/me";
import { createRedisSessionStore } from "./services/session-store.js";
import { auditWriterService } from "./services/audit-writer.js";
import { roleCapabilityTemplatesService } from "./services/role-capability-templates.js";
import { applyRoleCapabilityTemplates } from "./services/authorization.js";
import { sensorRetentionService } from "./services/sensor-retention.js";
import { SensorRetentionWorker } from "./services/sensor-retention-worker.js";
import { IntegrationRetryWorker } from "./services/integration-retry-worker.js";

async function buildApp() {
  const app = Fastify({
    trustProxy: env.TRUST_PROXY,
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

  const maskSid = (sid?: string | null) => {
    if (!sid) return null;
    return `${sid.slice(0, 8)}…${sid.slice(-4)}`;
  };

  // 🔎 Log every route as it is registered (dev-only)
  app.addHook("onRoute", (o) => {
    const method = Array.isArray(o.method) ? o.method.join(",") : o.method;
    const path = (o as any).path ?? `${(o as any).prefix ?? ""}${o.url}`;
    app.log.info({ method, url: o.url, path }, "route registered");
  });

  // --- Global hardening & cross-origin ---
  await app.register(helmet);
  await app.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
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
    create: async (reply, userId: string, role?: string | null) => {
      const sid = randomBytes(32).toString("hex");
      const expiresAt = Math.floor(Date.now() / 1000) + sessionStore.ttlSeconds;

      await sessionStore.save(sid, {
        userId,
        role: role ?? null,
        expiresAt,
      });
      app.log.info(
        {
          event: "session.create",
          sid: maskSid(sid),
          userId,
          role: role ?? null,
          expiresAt,
        },
        "created session and persisted to store",
      );

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
          app.log.info(
            { event: "session.destroy", sid: maskSid(sid) },
            "removed session from store",
          );
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
        app.log.debug(
          { event: "session.touch", sid: maskSid(sid) },
          "refreshed session ttl",
        );
      } catch (error) {
        app.log.error({ err: error, sid }, "failed to refresh session ttl");
      }
    },
  });

  app.decorate("audit", {
    log: async (entry) => {
      try {
        await auditWriterService.write(entry);
      } catch (error) {
        app.log.error({ err: error, action: entry.action }, "failed to write audit log entry");
      }
    },
  });

  try {
    const templates = await roleCapabilityTemplatesService.listTemplates();
    applyRoleCapabilityTemplates(templates);
    app.log.info(
      { event: "authorization.templates.loaded", templateCount: templates.length },
      "loaded role capability templates into runtime registry"
    );
  } catch (error) {
    app.log.error(
      { err: error, event: "authorization.templates.load_failed" },
      "failed to load role capability templates, using defaults"
    );
  }

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
      app.log.info(
        {
          event: "session.cookie.unsign",
          valid: res.valid,
          renew: res.renew ?? false,
        },
        "processed signed sid cookie",
      );
      if (res.valid) {
        sid = res.value;
        if (sid) {
          try {
            const record = await sessionStore.find(sid);
            if (record) {
              userId = record.userId ?? null;
              role = (record.role as string | null) ?? null;
              await app.sessions.touch(sid);
              app.log.info(
                { event: "session.load", sid: maskSid(sid), userId, role },
                "loaded session from store",
              );
            } else {
              reply.clearCookie("sid", { path: "/" });
              app.log.warn(
                { event: "session.missing", sid: maskSid(sid) },
                "no session found for sid, clearing cookie",
              );
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
        app.log.warn(
          { event: "session.cookie.invalid" },
          "received invalid signed sid cookie",
        );
      }
    } else {
      app.log.debug(
        { event: "session.cookie.absent" },
        "request without sid cookie",
      );
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
  await app.register(meRoutes, { prefix: "/me" });
  await app.register(adminApiTokenRoutes, { prefix: "/admin/api-tokens" });
  await app.register(poolsRoutes, { prefix: "/pools" }); // secure these inside the module with app.auth.verifySession
  await app.register(testsRoutes, { prefix: "/tests" });
  await app.register(chemicalsRoutes, { prefix: "/chemicals" });
  await app.register(adminUsersRoutes, { prefix: "/admin/users" });
  await app.register(adminLocationsRoutes, { prefix: "/admin/locations" });
  await app.register(locationsRoutes, { prefix: "/locations" });
  await app.register(adminPoolsRoutes, { prefix: "/admin/pools" });
  await app.register(adminAuditLogRoutes, { prefix: "/admin/audit-log" });
  await app.register(adminNotificationTemplateRoutes, {
    prefix: "/admin/notification-templates",
  });
  await app.register(adminReadinessRoutes, { prefix: "/admin/readiness" });
  await app.register(adminIntegrationsRoutes, { prefix: "/admin/integrations" });
  await app.register(adminRoleCapabilitiesRoutes, { prefix: "/admin/role-capabilities" });
  await app.register(integrationsRoutes, { prefix: "/integrations" });
  await app.register(notificationRoutes, { prefix: "/notifications" });
  await app.register(messagesRoutes, { prefix: "/messages" });
  await app.register(billingRoutes, { prefix: "/billing" });
  await app.register(contactRoutes, { prefix: "/contact" });
  await app.register(photosRoutes, { prefix: "/photos" });

  // --- Dev convenience route ---
  app.get("/test", async () => ({ ok: true, message: "test route" }));

  const sensorRetentionWorker = new SensorRetentionWorker({
    enabled: env.SENSOR_RETENTION_ENABLED,
    tickSeconds: env.SENSOR_RETENTION_TICK_SECONDS,
    service: sensorRetentionService,
    logger: app.log,
  });
  sensorRetentionWorker.start();

  const integrationRetryWorker = new IntegrationRetryWorker({
    enabled: env.INTEGRATION_RETRY_ENABLED,
    tickSeconds: env.INTEGRATION_RETRY_TICK_SECONDS,
    batchSize: env.INTEGRATION_RETRY_BATCH_SIZE,
    maxAttempts: env.INTEGRATION_RETRY_MAX_ATTEMPTS,
    logger: app.log,
  });
  integrationRetryWorker.start();

  app.addHook("onClose", async () => {
    await sensorRetentionWorker.stop();
    await integrationRetryWorker.stop();
  });

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
