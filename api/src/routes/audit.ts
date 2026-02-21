import type { FastifyInstance, FastifyRequest } from 'fastify';

type AuditPayload = {
  action: string;
  entity?: string | null;
  entityId?: string | null;
  userId?: string | null;
  poolId?: string | null;
  data?: unknown;
};

const getFirstHeaderValue = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
};

export async function writeAuditLog(
  app: FastifyInstance,
  req: FastifyRequest,
  payload: AuditPayload
) {
  if (!app.audit?.log) return;

  const forwardedFor = getFirstHeaderValue(req.headers['x-forwarded-for']);
  const ipAddress = forwardedFor ? forwardedFor.split(',')[0]?.trim() ?? null : req.ip ?? null;
  const userAgent = getFirstHeaderValue(req.headers['user-agent']);
  const sessionId = req.session?.id ?? null;

  await app.audit.log({
    action: payload.action,
    entity: payload.entity ?? null,
    entityId: payload.entityId ?? null,
    userId: payload.userId ?? req.user?.id ?? null,
    poolId: payload.poolId ?? null,
    data: payload.data ?? null,
    ipAddress,
    userAgent,
    sessionId,
  });
}
