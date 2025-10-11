const base = (() => {
  const configured = import.meta.env.VITE_API_URL;
  if (configured) {
    return configured;
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
};

export const api: ApiClient = {
  auth: {
    register: (body, customFetch) =>
      apiFetch('/auth/register', jsonRequest(body, { method: 'POST' }), customFetch),
    login: (body, customFetch) =>
      apiFetch('/auth/login', jsonRequest(body, { method: 'POST' }), customFetch),
    logout: (customFetch) => apiFetch('/auth/logout', { method: 'POST' }, customFetch),
    me: (customFetch) => apiFetch('/auth/me', {}, customFetch),
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
};

export type { ApiClient };
