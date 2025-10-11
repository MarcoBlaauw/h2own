import { redirect } from '@sveltejs/kit';
import { api } from '$lib/api';
import type { PageLoad } from './$types';

export type AuditLogEntry = {
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
};

export type AuditLogFilters = {
  user?: string;
  action?: string;
  entity?: string;
};

export type AuditLogPagination = {
  page: number;
  pageSize: number;
  total: number;
};

type AuditLogResponse = {
  page: number;
  pageSize: number;
  total: number;
  items: AuditLogEntry[];
};

type LoadOutput = {
  entries: AuditLogEntry[];
  filters: AuditLogFilters;
  pagination: AuditLogPagination;
  loadError: string | null;
};

const parsePositiveInt = (value: string | null, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
};

const sanitize = (value: string | null) => {
  if (value === null || value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

export const load: PageLoad<LoadOutput> = async ({ fetch, parent, url }) => {
  const { session } = await parent();
  if (!session || session.user?.role !== 'admin') {
    throw redirect(302, '/');
  }

  const user = sanitize(url.searchParams.get('user'));
  const action = sanitize(url.searchParams.get('action'));
  const entity = sanitize(url.searchParams.get('entity'));
  const page = parsePositiveInt(url.searchParams.get('page'), 1);
  const pageSize = parsePositiveInt(url.searchParams.get('pageSize'), 25);

  try {
    const response = await api.auditLog.list(fetch, {
      page,
      pageSize,
      user,
      action,
      entity,
    });

    if (!response.ok) {
      return {
        entries: [],
        filters: { user, action, entity },
        pagination: { page, pageSize, total: 0 },
        loadError: `Failed to load audit log (${response.status})`,
      } satisfies LoadOutput;
    }

    const payload = (await response.json()) as AuditLogResponse;

    return {
      entries: payload.items ?? [],
      filters: { user, action, entity },
      pagination: {
        page: payload.page ?? page,
        pageSize: payload.pageSize ?? pageSize,
        total: payload.total ?? 0,
      },
      loadError: null,
    } satisfies LoadOutput;
  } catch (error) {
    console.error('Failed to load audit log', error);
    return {
      entries: [],
      filters: { user, action, entity },
      pagination: { page, pageSize, total: 0 },
      loadError: 'Unable to load audit log. Please try again later.',
    } satisfies LoadOutput;
  }
};
