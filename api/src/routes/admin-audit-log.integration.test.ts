import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminAuditLogRoutes } from './admin-audit-log.js';
import { auditLogService, type AuditLogFilters } from '../services/audit-log.js';

describe('admin audit log routes', () => {
  let app: ReturnType<typeof Fastify>;
  let verifySessionMock: ReturnType<typeof vi.fn>;
  let requireRoleMock: ReturnType<typeof vi.fn>;
  let roleHandlers: Array<ReturnType<typeof vi.fn>>;
  let listEntriesSpy: any;
  const adminUserId = '55d32ef4-6e6f-4fb5-9d82-2e2a7778015b';

  const logs = [
    {
      auditId: 101,
      at: new Date('2024-01-01T00:00:00.000Z'),
      action: 'user.login',
      entity: 'session',
      entityId: 'session-1',
      userId: 'user-1',
      poolId: null,
      ipAddress: '127.0.0.1',
      userAgent: 'UnitTest/1.0',
      sessionId: 'sid-1',
      data: { detail: 'success' },
      userEmail: 'owner@example.com',
      userName: 'Owner One',
    },
    {
      auditId: 102,
      at: new Date('2024-02-02T00:00:00.000Z'),
      action: 'pool.updated',
      entity: 'pool',
      entityId: 'pool-7',
      userId: 'user-2',
      poolId: 'pool-7',
      ipAddress: '192.168.1.2',
      userAgent: 'UnitTest/1.0',
      sessionId: 'sid-2',
      data: { before: { name: 'Lap Pool' }, after: { name: 'Lap Pool v2' } },
      userEmail: 'member@example.com',
      userName: 'Member Two',
    },
    {
      auditId: 103,
      at: new Date('2024-03-03T00:00:00.000Z'),
      action: 'user.logout',
      entity: 'session',
      entityId: 'session-2',
      userId: 'user-1',
      poolId: null,
      ipAddress: '127.0.0.1',
      userAgent: 'UnitTest/1.0',
      sessionId: 'sid-1',
      data: { detail: 'manual' },
      userEmail: 'owner@example.com',
      userName: 'Owner One',
    },
  ];

  beforeEach(async () => {
    app = Fastify();
    roleHandlers = [];

    verifySessionMock = vi.fn(async (req: any) => {
      req.user = { id: adminUserId, role: 'admin' };
    });

    requireRoleMock = vi.fn((role: string) => {
      const handler = vi.fn(async (req: any, reply: any) => {
        if (req.user?.role !== role) {
          return reply.code(403).send({ error: 'Forbidden' });
        }
      });
      roleHandlers.push(handler);
      return handler;
    });

    app.decorate('auth', {
      verifySession: verifySessionMock,
      requireRole: requireRoleMock,
    } as any);

    await app.register(adminAuditLogRoutes, { prefix: '/audit-log' });
    await app.ready();

    listEntriesSpy = vi.spyOn(auditLogService, 'listEntries');
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  it('lists audit log entries with filters and pagination', async () => {
    listEntriesSpy.mockImplementation(async (_role: string, filters: AuditLogFilters = {}) => {
      const page = filters.page ?? 1;
      const pageSize = filters.pageSize ?? 25;
      let filtered = logs;

      if (filters.user) {
        filtered = filtered.filter(
          (entry) =>
            entry.userEmail?.toLowerCase().includes(filters.user!.toLowerCase()) ||
            entry.userName?.toLowerCase().includes(filters.user!.toLowerCase())
        );
      }

      if (filters.action) {
        filtered = filtered.filter((entry) =>
          entry.action.toLowerCase().includes(filters.action!.toLowerCase())
        );
      }

      if (filters.entity) {
        filtered = filtered.filter((entry) =>
          (entry.entity ?? '').toLowerCase().includes(filters.entity!.toLowerCase())
        );
      }

      const total = filtered.length;
      const start = (page - 1) * pageSize;
      const items = filtered
        .slice(start, start + pageSize)
        .map((entry) => ({ ...entry, at: entry.at.toISOString() }));

      return { page, pageSize, total, items };
    });

    const response = await app.inject({
      method: 'GET',
      url: '/audit-log?page=1&pageSize=2&user=owner&action=user&entity=session',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      page: 1,
      pageSize: 2,
      total: 2,
      items: logs
        .filter((entry) => entry.entity === 'session')
        .slice(0, 2)
        .map((entry) => ({ ...entry, at: entry.at.toISOString() })),
    });
    expect(verifySessionMock).toHaveBeenCalled();
    expect(requireRoleMock).toHaveBeenCalledWith('admin');
    expect(listEntriesSpy).toHaveBeenCalledWith('admin', {
      page: 1,
      pageSize: 2,
      user: 'owner',
      action: 'user',
      entity: 'session',
    });
  });

  it('rejects requests from non-admin users', async () => {
    verifySessionMock.mockImplementationOnce(async (req: any) => {
      req.user = { id: adminUserId, role: 'member' };
    });

    const response = await app.inject({ method: 'GET', url: '/audit-log' });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: 'Forbidden' });
    expect(listEntriesSpy).not.toHaveBeenCalled();
    expect(roleHandlers).toHaveLength(1);
    expect(roleHandlers[0]).toHaveBeenCalled();
  });

  it('validates invalid pagination parameters', async () => {
    const response = await app.inject({ method: 'GET', url: '/audit-log?page=0' });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error).toBe('ValidationError');
    expect(listEntriesSpy).not.toHaveBeenCalled();
  });
});
