import { and, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import { db as dbClient } from '../db/index.js';
import * as schema from '../db/schema/index.js';
import { hasSystemCapability } from './authorization.js';

export class AuditLogForbiddenError extends Error {
  readonly statusCode = 403;
  readonly code = 'AuditLogForbidden';

  constructor(message = 'Only administrators can view the audit log.') {
    super(message);
    this.name = 'AuditLogForbiddenError';
  }
}

export interface AuditLogFilters {
  page?: number;
  pageSize?: number;
  user?: string;
  action?: string;
  entity?: string;
}

export interface AuditLogEntry {
  auditId: number;
  at: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  userId: string | null;
  poolId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  sessionId: string | null;
  data: unknown;
  userEmail: string | null;
  userName: string | null;
}

export interface AuditLogResult {
  page: number;
  pageSize: number;
  total: number;
  items: AuditLogEntry[];
}

type SessionRole = string | null | undefined;

function normalizePagination(filters: AuditLogFilters) {
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const boundedPageSize = filters.pageSize && filters.pageSize > 0 ? filters.pageSize : 25;
  const pageSize = Math.min(boundedPageSize, 100);
  const offset = (page - 1) * pageSize;

  return { page, pageSize, offset } as const;
}

function buildConditions(filters: AuditLogFilters): SQL | undefined {
  const conditions: SQL[] = [];

  if (filters.user) {
    const pattern = `%${filters.user}%`;
    const userCondition = or(ilike(schema.users.email, pattern), ilike(schema.users.name, pattern));
    if (userCondition) {
      conditions.push(userCondition);
    }
  }

  if (filters.action) {
    const pattern = `%${filters.action}%`;
    conditions.push(ilike(schema.auditLog.action, pattern));
  }

  if (filters.entity) {
    const pattern = `%${filters.entity}%`;
    conditions.push(ilike(schema.auditLog.entity, pattern));
  }

  if (conditions.length === 0) {
    return undefined;
  }

  if (conditions.length === 1) {
    return conditions[0];
  }

  return and(...conditions);
}

export class AuditLogService {
  constructor(private readonly db = dbClient) {}

  private ensureAdmin(role: SessionRole) {
    if (!hasSystemCapability(role, 'admin.audit.read')) {
      throw new AuditLogForbiddenError();
    }
  }

  async listEntries(role: SessionRole, filters: AuditLogFilters = {}): Promise<AuditLogResult> {
    this.ensureAdmin(role);

    const { page, pageSize, offset } = normalizePagination(filters);
    const where = buildConditions(filters);

    const countQuery = where
      ? this.db
          .select({
            count: sql<number>`count(*)::int`,
          })
          .from(schema.auditLog)
          .leftJoin(schema.users, eq(schema.auditLog.userId, schema.users.userId))
          .where(where)
      : this.db
          .select({
            count: sql<number>`count(*)::int`,
          })
          .from(schema.auditLog)
          .leftJoin(schema.users, eq(schema.auditLog.userId, schema.users.userId));

    const listQuery = where
      ? this.db
          .select({
            auditId: schema.auditLog.auditId,
            at: schema.auditLog.at,
            action: schema.auditLog.action,
            entity: schema.auditLog.entity,
            entityId: schema.auditLog.entityId,
            userId: schema.auditLog.userId,
            poolId: schema.auditLog.poolId,
            ipAddress: schema.auditLog.ipAddress,
            userAgent: schema.auditLog.userAgent,
            sessionId: schema.auditLog.sessionId,
            data: schema.auditLog.data,
            userEmail: schema.users.email,
            userName: schema.users.name,
          })
          .from(schema.auditLog)
          .leftJoin(schema.users, eq(schema.auditLog.userId, schema.users.userId))
          .where(where)
      : this.db
          .select({
            auditId: schema.auditLog.auditId,
            at: schema.auditLog.at,
            action: schema.auditLog.action,
            entity: schema.auditLog.entity,
            entityId: schema.auditLog.entityId,
            userId: schema.auditLog.userId,
            poolId: schema.auditLog.poolId,
            ipAddress: schema.auditLog.ipAddress,
            userAgent: schema.auditLog.userAgent,
            sessionId: schema.auditLog.sessionId,
            data: schema.auditLog.data,
            userEmail: schema.users.email,
            userName: schema.users.name,
          })
          .from(schema.auditLog)
          .leftJoin(schema.users, eq(schema.auditLog.userId, schema.users.userId));

    const [totalResult, rows] = await Promise.all([
      countQuery,
      listQuery
        .orderBy(desc(schema.auditLog.at), desc(schema.auditLog.auditId))
        .limit(pageSize)
        .offset(offset),
    ]);

    const total = Number(totalResult[0]?.count ?? 0);

    const items: AuditLogEntry[] = rows.map((row) => ({
      auditId: row.auditId,
      at: row.at instanceof Date ? row.at.toISOString() : String(row.at),
      action: row.action,
      entity: row.entity ?? null,
      entityId: row.entityId ?? null,
      userId: row.userId ?? null,
      poolId: row.poolId ?? null,
      ipAddress: row.ipAddress ?? null,
      userAgent: row.userAgent ?? null,
      sessionId: row.sessionId ?? null,
      data: row.data ?? null,
      userEmail: row.userEmail ?? null,
      userName: row.userName ?? null,
    }));

    return {
      page,
      pageSize,
      total,
      items,
    } satisfies AuditLogResult;
  }
}

export const auditLogService = new AuditLogService();

export { buildConditions, normalizePagination };
