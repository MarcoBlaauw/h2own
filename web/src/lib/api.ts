const base = (() => {
  const configured = import.meta.env.VITE_API_URL;
  if (configured) {
    return configured;
  }

  if (typeof process !== 'undefined' && process?.env) {
    const serverConfigured = process.env.VITE_API_URL || process.env.PUBLIC_API_BASE;
    if (serverConfigured) {
      return serverConfigured;
    }
  }

  if (typeof globalThis !== 'undefined' && typeof globalThis.location === 'object' && globalThis.location) {
    const origin = (globalThis.location as Location).origin;
    if (origin) {
      return origin;
    }
  }

  return '';
})();

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const joinUrl = (targetBase: string, path: string) => {
  if (!targetBase) {
    return path;
  }

  const normalizedBase = targetBase.endsWith('/') ? targetBase.slice(0, -1) : targetBase;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return `${normalizedBase}${normalizedPath}`;
};

const apiFetch = (path: string, opts: RequestInit = {}, customFetch: FetchLike = fetch) =>
  customFetch(joinUrl(base, path), {
    ...opts,
    credentials: 'include',
  });

const jsonRequest = (body: unknown, overrides: RequestInit = {}): RequestInit => ({
  ...overrides,
  body: JSON.stringify(body),
  headers: {
    'Content-Type': 'application/json',
    ...overrides.headers,
  },
});

type ApiClient = {
  auth: {
    register: (body: Record<string, unknown>, customFetch?: FetchLike) => Promise<Response>;
    login: (body: Record<string, unknown>, customFetch?: FetchLike) => Promise<Response>;
    logout: (customFetch?: FetchLike) => Promise<Response>;
    me: (customFetch?: FetchLike) => Promise<Response>;
    forgotPassword: (body: Record<string, unknown>, customFetch?: FetchLike) => Promise<Response>;
    resetPassword: (body: Record<string, unknown>, customFetch?: FetchLike) => Promise<Response>;
    forgotUsername: (body: Record<string, unknown>, customFetch?: FetchLike) => Promise<Response>;
  };
  apiTokens: {
    list: (customFetch?: FetchLike) => Promise<Response>;
    create: (
      body: { name: string; permissions?: Record<string, unknown> },
      customFetch?: FetchLike
    ) => Promise<Response>;
    revoke: (tokenId: string, customFetch?: FetchLike) => Promise<Response>;
  };
  users: {
    list: (
      customFetch?: FetchLike,
      params?: { search?: string; role?: string; isActive?: boolean }
    ) => Promise<Response>;
    update: (userId: string, body: Record<string, unknown>) => Promise<Response>;
    resetPassword: (
      userId: string,
      body?: { newPassword?: string }
    ) => Promise<Response>;
  };
  locations: {
    list: (customFetch?: FetchLike) => Promise<Response>;
    create: (body: Record<string, unknown>) => Promise<Response>;
    update: (locationId: string, body: Record<string, unknown>) => Promise<Response>;
    deactivate: (locationId: string, body?: Record<string, unknown>) => Promise<Response>;
  };
  userLocations: {
    list: (customFetch?: FetchLike) => Promise<Response>;
    create: (body: Record<string, unknown>) => Promise<Response>;
  };
  pools: {
    list: (customFetch?: FetchLike, owner?: boolean) => Promise<Response>;
    create: (body: Record<string, unknown>) => Promise<Response>;
    show: (id: string, customFetch?: FetchLike) => Promise<Response>;
    patch: (id: string, body: Record<string, unknown>) => Promise<Response>;
    del: (id: string) => Promise<Response>;
  };
  tests: {
    create: (poolId: string, body: Record<string, unknown>) => Promise<Response>;
    list: (
      poolId: string,
      customFetch?: FetchLike,
      params?: { limit?: number }
    ) => Promise<Response>;
    show: (sessionId: string, customFetch?: FetchLike) => Promise<Response>;
  };
  recommendations: {
    preview: (poolId: string, customFetch?: FetchLike) => Promise<Response>;
    create: (poolId: string, body: Record<string, unknown>) => Promise<Response>;
    update: (
      poolId: string,
      recommendationId: string,
      body: Record<string, unknown>
    ) => Promise<Response>;
    list: (
      poolId: string,
      customFetch?: FetchLike,
      params?: { limit?: number; status?: string }
    ) => Promise<Response>;
    show: (poolId: string, recommendationId: string, customFetch?: FetchLike) => Promise<Response>;
  };
  dosing: {
    list: (
      poolId: string,
      customFetch?: FetchLike,
      params?: { limit?: number }
    ) => Promise<Response>;
    create: (poolId: string, body: Record<string, unknown>) => Promise<Response>;
  };
  costs: {
    list: (
      poolId: string,
      customFetch?: FetchLike,
      params?: { from?: string; to?: string; limit?: number }
    ) => Promise<Response>;
    summary: (
      poolId: string,
      customFetch?: FetchLike,
      params?: { window?: 'week' | 'month' | 'year' }
    ) => Promise<Response>;
    create: (poolId: string, body: Record<string, unknown>) => Promise<Response>;
  };
  members: {
    update: (poolId: string, userId: string, body: Record<string, unknown>) => Promise<Response>;
    del: (poolId: string, userId: string) => Promise<Response>;
  };
  chemicals: {
    list: (
      customFetch?: FetchLike,
      params?: { q?: string; category?: string }
    ) => Promise<Response>;
    create: (body: Record<string, unknown>) => Promise<Response>;
    listCategories: (customFetch?: FetchLike) => Promise<Response>;
    update: (id: string, body: Record<string, unknown>) => Promise<Response>;
    del: (id: string) => Promise<Response>;
  };
  adminPools: {
    list: (customFetch?: FetchLike) => Promise<Response>;
    show: (poolId: string, customFetch?: FetchLike) => Promise<Response>;
    update: (poolId: string, body: Record<string, unknown>) => Promise<Response>;
    transfer: (poolId: string, body: Record<string, unknown>) => Promise<Response>;
  };
  auditLog: {
    list: (
      customFetch?: FetchLike,
      params?: { page?: number; pageSize?: number; user?: string; action?: string; entity?: string }
    ) => Promise<Response>;
  };
  notificationTemplates: {
    list: (customFetch?: FetchLike) => Promise<Response>;
    create: (body: Record<string, unknown>) => Promise<Response>;
    update: (templateId: string, body: Record<string, unknown>) => Promise<Response>;
  };
  notifications: {
    preview: (body: Record<string, unknown>, customFetch?: FetchLike) => Promise<Response>;
  };
  weather: {
    list: (
      locationId: string,
      customFetch?: FetchLike,
      params?: { from?: string; to?: string; granularity?: 'day'; refresh?: boolean }
    ) => Promise<Response>;
  };
  photos: {
    presign: (
      poolId: string,
      body: { filename?: string; contentType?: string },
      customFetch?: FetchLike
    ) => Promise<Response>;
    confirm: (body: { fileUrl: string; poolId: string; testId?: string }, customFetch?: FetchLike) => Promise<Response>;
  };
};

export const api: ApiClient = {
  auth: {
    register: (body, customFetch) =>
      apiFetch('/auth/register', jsonRequest(body, { method: 'POST' }), customFetch),
    login: (body, customFetch) =>
      apiFetch('/auth/login', jsonRequest(body, { method: 'POST' }), customFetch),
    logout: (customFetch) => apiFetch('/auth/logout', { method: 'POST' }, customFetch),
    me: (customFetch) => apiFetch('/auth/me', {}, customFetch),
    forgotPassword: (body, customFetch) =>
      apiFetch('/auth/forgot-password', jsonRequest(body, { method: 'POST' }), customFetch),
    resetPassword: (body, customFetch) =>
      apiFetch('/auth/reset-password', jsonRequest(body, { method: 'POST' }), customFetch),
    forgotUsername: (body, customFetch) =>
      apiFetch('/auth/forgot-username', jsonRequest(body, { method: 'POST' }), customFetch),
  },
  apiTokens: {
    list: (customFetch) => apiFetch('/admin/api-tokens', {}, customFetch),
    create: (body, customFetch) =>
      apiFetch('/admin/api-tokens', jsonRequest(body, { method: 'POST' }), customFetch),
    revoke: (tokenId, customFetch) =>
      apiFetch(`/admin/api-tokens/${tokenId}`, { method: 'DELETE' }, customFetch),
  },
  users: {
    list: (customFetch, params = {}) => {
      const search = new URLSearchParams();
      if (params.search) search.set('search', params.search);
      if (params.role) search.set('role', params.role);
      if (typeof params.isActive === 'boolean') {
        search.set('isActive', params.isActive ? 'true' : 'false');
      }
      const query = search.toString();
      const path = `/admin/users${query ? `?${query}` : ''}`;
      return apiFetch(path, {}, customFetch);
    },
    update: (userId, body) =>
      apiFetch(`/admin/users/${userId}`, jsonRequest(body, { method: 'PATCH' })),
    resetPassword: (userId, body) =>
      apiFetch(
        `/admin/users/${userId}/reset-password`,
        jsonRequest(body ?? {}, { method: 'POST' })
      ),
  },
  locations: {
    list: (customFetch) => apiFetch('/admin/locations', {}, customFetch),
    create: (body) => apiFetch('/admin/locations', jsonRequest(body, { method: 'POST' })),
    update: (locationId, body) =>
      apiFetch(`/admin/locations/${locationId}`, jsonRequest(body, { method: 'PATCH' })),
    deactivate: (locationId, body) =>
      apiFetch(
        `/admin/locations/${locationId}/deactivate`,
        jsonRequest(body ?? {}, { method: 'POST' })
      ),
  },
  userLocations: {
    list: (customFetch) => apiFetch('/locations', {}, customFetch),
    create: (body) => apiFetch('/locations', jsonRequest(body, { method: 'POST' })),
  },
  pools: {
    list: (customFetch, owner = false) =>
      apiFetch(`/pools${owner ? '?owner=true' : ''}`, {}, customFetch),
    create: (body) => apiFetch('/pools', jsonRequest(body, { method: 'POST' })),
    show: (id, customFetch) => apiFetch(`/pools/${id}`, {}, customFetch),
    patch: (id, body) => apiFetch(`/pools/${id}`, jsonRequest(body, { method: 'PATCH' })),
    del: (id) => apiFetch(`/pools/${id}`, { method: 'DELETE' }),
  },
  tests: {
    create: (poolId, body) =>
      apiFetch(`/pools/${poolId}/tests`, jsonRequest(body, { method: 'POST' })),
    list: (poolId, customFetch, params = {}) => {
      const search = new URLSearchParams();
      if (typeof params.limit === 'number') search.set('limit', params.limit.toString());
      const query = search.toString();
      const path = `/pools/${poolId}/tests${query ? `?${query}` : ''}`;
      return apiFetch(path, {}, customFetch);
    },
    show: (sessionId, customFetch) => apiFetch(`/tests/${sessionId}`, {}, customFetch),
  },
  recommendations: {
    preview: (poolId, customFetch) =>
      apiFetch(`/pools/${poolId}/recommendations/preview`, {}, customFetch),
    create: (poolId, body) =>
      apiFetch(`/pools/${poolId}/recommendations`, jsonRequest(body, { method: 'POST' })),
    update: (poolId, recommendationId, body) =>
      apiFetch(
        `/pools/${poolId}/recommendations/${recommendationId}`,
        jsonRequest(body, { method: 'PATCH' })
      ),
    list: (poolId, customFetch, params = {}) => {
      const search = new URLSearchParams();
      if (typeof params.limit === 'number') search.set('limit', params.limit.toString());
      if (params.status) search.set('status', params.status);
      const query = search.toString();
      const path = `/pools/${poolId}/recommendations${query ? `?${query}` : ''}`;
      return apiFetch(path, {}, customFetch);
    },
    show: (poolId, recommendationId, customFetch) =>
      apiFetch(`/pools/${poolId}/recommendations/${recommendationId}`, {}, customFetch),
  },
  dosing: {
    list: (poolId, customFetch, params = {}) => {
      const search = new URLSearchParams();
      if (typeof params.limit === 'number') search.set('limit', params.limit.toString());
      const query = search.toString();
      const path = `/pools/${poolId}/dosing${query ? `?${query}` : ''}`;
      return apiFetch(path, {}, customFetch);
    },
    create: (poolId, body) =>
      apiFetch(`/pools/${poolId}/dosing`, jsonRequest(body, { method: 'POST' })),
  },
  costs: {
    list: (poolId, customFetch, params = {}) => {
      const search = new URLSearchParams();
      if (params.from) search.set('from', params.from);
      if (params.to) search.set('to', params.to);
      if (typeof params.limit === 'number') search.set('limit', params.limit.toString());
      const query = search.toString();
      const path = `/pools/${poolId}/costs${query ? `?${query}` : ''}`;
      return apiFetch(path, {}, customFetch);
    },
    summary: (poolId, customFetch, params = {}) => {
      const search = new URLSearchParams();
      if (params.window) search.set('window', params.window);
      const query = search.toString();
      const path = `/pools/${poolId}/costs/summary${query ? `?${query}` : ''}`;
      return apiFetch(path, {}, customFetch);
    },
    create: (poolId, body) => apiFetch(`/pools/${poolId}/costs`, jsonRequest(body, { method: 'POST' })),
  },
  members: {
    update: (poolId, userId, body) =>
      apiFetch(`/pools/${poolId}/members/${userId}`, jsonRequest(body, { method: 'PUT' })),
    del: (poolId, userId) => apiFetch(`/pools/${poolId}/members/${userId}`, { method: 'DELETE' }),
  },
  chemicals: {
    list: (customFetch, params = {}) => {
      const search = new URLSearchParams();
      if (params.q) search.set('q', params.q);
      if (params.category) search.set('category', params.category);
      const query = search.toString();
      const path = `/chemicals${query ? `?${query}` : ''}`;
      return apiFetch(path, {}, customFetch);
    },
    create: (body) => apiFetch('/chemicals', jsonRequest(body, { method: 'POST' })),
    listCategories: (customFetch) => apiFetch('/chemicals/categories', {}, customFetch),
    update: (id, body) => apiFetch(`/chemicals/${id}`, jsonRequest(body, { method: 'PATCH' })),
    del: (id) => apiFetch(`/chemicals/${id}`, { method: 'DELETE' }),
  },
  adminPools: {
    list: (customFetch) => apiFetch('/admin/pools', {}, customFetch),
    show: (poolId, customFetch) => apiFetch(`/admin/pools/${poolId}`, {}, customFetch),
    update: (poolId, body) => apiFetch(`/admin/pools/${poolId}`, jsonRequest(body, { method: 'PATCH' })),
    transfer: (poolId, body) =>
      apiFetch(`/admin/pools/${poolId}/transfer`, jsonRequest(body, { method: 'POST' })),
  },
  auditLog: {
    list: (customFetch, params = {}) => {
      const search = new URLSearchParams();
      if (typeof params.page === 'number') search.set('page', String(params.page));
      if (typeof params.pageSize === 'number') search.set('pageSize', String(params.pageSize));
      if (params.user) search.set('user', params.user);
      if (params.action) search.set('action', params.action);
      if (params.entity) search.set('entity', params.entity);
      const query = search.toString();
      const path = `/admin/audit-log${query ? `?${query}` : ''}`;
      return apiFetch(path, {}, customFetch);
    },
  },
  notificationTemplates: {
    list: (customFetch) => apiFetch('/admin/notification-templates', {}, customFetch),
    create: (body) =>
      apiFetch('/admin/notification-templates', jsonRequest(body, { method: 'POST' })),
    update: (templateId, body) =>
      apiFetch(
        `/admin/notification-templates/${templateId}`,
        jsonRequest(body, { method: 'PATCH' })
      ),
  },
  notifications: {
    preview: (body, customFetch) =>
      apiFetch('/notifications/preview', jsonRequest(body, { method: 'POST' }), customFetch),
  },
  weather: {
    list: (locationId, customFetch, params = {}) => {
      const search = new URLSearchParams();
      if (params.from) search.set('from', params.from);
      if (params.to) search.set('to', params.to);
      if (params.granularity) search.set('granularity', params.granularity);
      if (typeof params.refresh === 'boolean') search.set('refresh', params.refresh ? 'true' : 'false');
      const query = search.toString();
      const path = `/locations/${locationId}/weather${query ? `?${query}` : ''}`;
      return apiFetch(path, {}, customFetch);
    },
  },
  photos: {
    presign: (poolId, body, customFetch) =>
      apiFetch(`/pools/${poolId}/photos`, jsonRequest(body, { method: 'POST' }), customFetch),
    confirm: (body, customFetch) =>
      apiFetch('/photos/confirm', jsonRequest(body, { method: 'POST' }), customFetch),
  },
};

export type { ApiClient };
