const base = (() => {
  const inBrowser =
    typeof globalThis !== 'undefined' &&
    typeof globalThis.location === 'object' &&
    globalThis.location !== null;

  if (inBrowser) {
    const clientConfigured = import.meta.env.VITE_API_URL || import.meta.env.PUBLIC_API_BASE;
    return clientConfigured || '/api';
  }

  if (typeof process !== 'undefined' && process?.env) {
    const internalApi = process.env.INTERNAL_API_URL;
    if (internalApi) {
      return internalApi;
    }

    const serverConfigured = process.env.VITE_API_URL || process.env.PUBLIC_API_BASE;
    if (serverConfigured) {
      if (serverConfigured.startsWith('http://') || serverConfigured.startsWith('https://')) {
        return serverConfigured;
      }

      const appBase = process.env.APP_BASE_URL;
      if (appBase) {
        const normalizedAppBase = appBase.endsWith('/') ? appBase.slice(0, -1) : appBase;
        const normalizedPath = serverConfigured.startsWith('/')
          ? serverConfigured
          : `/${serverConfigured}`;
        return `${normalizedAppBase}${normalizedPath}`;
      }
    }
  }

  return '/api';
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
    loginTotp: (body: Record<string, unknown>, customFetch?: FetchLike) => Promise<Response>;
    logout: (customFetch?: FetchLike) => Promise<Response>;
    me: (customFetch?: FetchLike) => Promise<Response>;
    captchaConfig: (customFetch?: FetchLike) => Promise<Response>;
    lockoutSupport: (body: Record<string, unknown>, customFetch?: FetchLike) => Promise<Response>;
    forgotPassword: (body: Record<string, unknown>, customFetch?: FetchLike) => Promise<Response>;
    resetPassword: (body: Record<string, unknown>, customFetch?: FetchLike) => Promise<Response>;
    forgotUsername: (body: Record<string, unknown>, customFetch?: FetchLike) => Promise<Response>;
    verifyEmailChange: (body: Record<string, unknown>, customFetch?: FetchLike) => Promise<Response>;
  };
  me: {
    profile: (customFetch?: FetchLike) => Promise<Response>;
    updateProfile: (body: Record<string, unknown>, customFetch?: FetchLike) => Promise<Response>;
    preferences: (customFetch?: FetchLike) => Promise<Response>;
    notificationReadiness: (customFetch?: FetchLike) => Promise<Response>;
    updatePreferences: (body: Record<string, unknown>, customFetch?: FetchLike) => Promise<Response>;
    updatePassword: (body: Record<string, unknown>, customFetch?: FetchLike) => Promise<Response>;
    requestEmailChange: (body: Record<string, unknown>, customFetch?: FetchLike) => Promise<Response>;
    totpStatus: (customFetch?: FetchLike) => Promise<Response>;
    initiateTotpSetup: (body: Record<string, unknown>, customFetch?: FetchLike) => Promise<Response>;
    enableTotp: (body: Record<string, unknown>, customFetch?: FetchLike) => Promise<Response>;
    disableTotp: (body: Record<string, unknown>, customFetch?: FetchLike) => Promise<Response>;
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
    update: (locationId: string, body: Record<string, unknown>) => Promise<Response>;
    deactivate: (locationId: string, body?: Record<string, unknown>) => Promise<Response>;
    delete: (locationId: string) => Promise<Response>;
    purgeLegacy: () => Promise<Response>;
  };
  pools: {
    list: (customFetch?: FetchLike, owner?: boolean) => Promise<Response>;
    create: (body: Record<string, unknown>) => Promise<Response>;
    show: (id: string, customFetch?: FetchLike) => Promise<Response>;
    patch: (id: string, body: Record<string, unknown>) => Promise<Response>;
    del: (id: string) => Promise<Response>;
    equipment: (poolId: string, customFetch?: FetchLike) => Promise<Response>;
    updateEquipment: (
      poolId: string,
      body: Record<string, unknown>,
      customFetch?: FetchLike
    ) => Promise<Response>;
    temperaturePreferences: (poolId: string, customFetch?: FetchLike) => Promise<Response>;
    updateTemperaturePreferences: (
      poolId: string,
      body: Record<string, unknown>,
      customFetch?: FetchLike
    ) => Promise<Response>;
    createTest: (poolId: string, body: Record<string, unknown>) => Promise<Response>;
    sensorReadings: (
      poolId: string,
      customFetch?: FetchLike,
      params?: { limit?: number }
    ) => Promise<Response>;
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

  treatmentPlans: {
    generate: (poolId: string, customFetch?: FetchLike) => Promise<Response>;
    list: (poolId: string, customFetch?: FetchLike, params?: { limit?: number }) => Promise<Response>;
    show: (poolId: string, planId: string, customFetch?: FetchLike) => Promise<Response>;
    schedule: (poolId: string, planId: string, body: Record<string, unknown>, customFetch?: FetchLike) => Promise<Response>;
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
  outcomes: {
    due: (poolId: string, customFetch?: FetchLike) => Promise<Response>;
    update: (poolId: string, outcomeId: string, body: Record<string, unknown>) => Promise<Response>;
    effectiveness: (poolId: string, customFetch?: FetchLike) => Promise<Response>;
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
    equipment: (poolId: string, customFetch?: FetchLike) => Promise<Response>;
    updateEquipment: (
      poolId: string,
      body: Record<string, unknown>,
      customFetch?: FetchLike
    ) => Promise<Response>;
    temperaturePreferences: (poolId: string, customFetch?: FetchLike) => Promise<Response>;
    updateTemperaturePreferences: (
      poolId: string,
      body: Record<string, unknown>,
      customFetch?: FetchLike
    ) => Promise<Response>;
  };
  adminReadiness: {
    get: (customFetch?: FetchLike) => Promise<Response>;
  };
  adminIntegrations: {
    list: (customFetch?: FetchLike) => Promise<Response>;
    get: (provider: string, customFetch?: FetchLike) => Promise<Response>;
    update: (provider: string, body: Record<string, unknown>, customFetch?: FetchLike) => Promise<Response>;
  };
  integrations: {
    list: (customFetch?: FetchLike) => Promise<Response>;
    connect: (
      provider: string,
      body?: { payload?: Record<string, unknown> },
      customFetch?: FetchLike
    ) => Promise<Response>;
    callback: (
      provider: string,
      body?: { payload?: Record<string, unknown> },
      customFetch?: FetchLike
    ) => Promise<Response>;
    disconnect: (integrationId: string, customFetch?: FetchLike) => Promise<Response>;
    listDevices: (integrationId: string, customFetch?: FetchLike) => Promise<Response>;
    discoverDevices: (
      integrationId: string,
      body?: { payload?: Record<string, unknown> },
      customFetch?: FetchLike
    ) => Promise<Response>;
    linkPool: (
      integrationId: string,
      deviceId: string,
      body: { poolId: string },
      customFetch?: FetchLike
    ) => Promise<Response>;
  };
  roleCapabilities: {
    list: (customFetch?: FetchLike) => Promise<Response>;
    update: (
      role: string,
      body: { systemCapabilities?: string[]; accountCapabilities?: string[] },
      customFetch?: FetchLike
    ) => Promise<Response>;
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
    list: (
      customFetch?: FetchLike,
      params?: { unreadOnly?: boolean; page?: number; pageSize?: number }
    ) => Promise<Response>;
    summary: (customFetch?: FetchLike) => Promise<Response>;
    read: (notificationId: string, customFetch?: FetchLike) => Promise<Response>;
    readAll: (customFetch?: FetchLike) => Promise<Response>;
    preview: (body: Record<string, unknown>, customFetch?: FetchLike) => Promise<Response>;
  };
  schedule: {
    list: (
      customFetch?: FetchLike,
      params?: {
        from?: string;
        to?: string;
        poolId?: string;
        status?: string;
        limit?: number;
      }
    ) => Promise<Response>;
    summary: (customFetch?: FetchLike) => Promise<Response>;
    create: (body: Record<string, unknown>, customFetch?: FetchLike) => Promise<Response>;
    update: (eventId: string, body: Record<string, unknown>, customFetch?: FetchLike) => Promise<Response>;
    complete: (eventId: string, customFetch?: FetchLike) => Promise<Response>;
    del: (eventId: string, customFetch?: FetchLike) => Promise<Response>;
  };
  messages: {
    listThreads: (
      customFetch?: FetchLike,
      params?: { limit?: number; cursor?: string; poolId?: string; unreadOnly?: boolean }
    ) => Promise<Response>;
    getThread: (threadId: string, customFetch?: FetchLike, params?: { before?: string; limit?: number }) => Promise<Response>;
    createThread: (body: Record<string, unknown>, customFetch?: FetchLike) => Promise<Response>;
    sendMessage: (threadId: string, body: Record<string, unknown>, customFetch?: FetchLike) => Promise<Response>;
    markThreadRead: (threadId: string, body?: { readAt?: string }, customFetch?: FetchLike) => Promise<Response>;
  };
  billing: {
    summary: (customFetch?: FetchLike) => Promise<Response>;
    createPortalSession: (customFetch?: FetchLike) => Promise<Response>;
  };
  contact: {
    submit: (body: Record<string, unknown>, customFetch?: FetchLike) => Promise<Response>;
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
    loginTotp: (body, customFetch) =>
      apiFetch('/auth/login/totp', jsonRequest(body, { method: 'POST' }), customFetch),
    logout: (customFetch) => apiFetch('/auth/logout', { method: 'POST' }, customFetch),
    me: (customFetch) => apiFetch('/auth/me', {}, customFetch),
    captchaConfig: (customFetch) => apiFetch('/auth/captcha-config', {}, customFetch),
    lockoutSupport: (body, customFetch) =>
      apiFetch('/auth/lockout-support', jsonRequest(body, { method: 'POST' }), customFetch),
    forgotPassword: (body, customFetch) =>
      apiFetch('/auth/forgot-password', jsonRequest(body, { method: 'POST' }), customFetch),
    resetPassword: (body, customFetch) =>
      apiFetch('/auth/reset-password', jsonRequest(body, { method: 'POST' }), customFetch),
    forgotUsername: (body, customFetch) =>
      apiFetch('/auth/forgot-username', jsonRequest(body, { method: 'POST' }), customFetch),
    verifyEmailChange: (body, customFetch) =>
      apiFetch('/auth/verify-email-change', jsonRequest(body, { method: 'POST' }), customFetch),
  },
  me: {
    profile: (customFetch) => apiFetch('/me/profile', {}, customFetch),
    updateProfile: (body, customFetch) =>
      apiFetch('/me/profile', jsonRequest(body, { method: 'PATCH' }), customFetch),
    preferences: (customFetch) => apiFetch('/me/preferences', {}, customFetch),
    notificationReadiness: (customFetch) => apiFetch('/me/notification-readiness', {}, customFetch),
    updatePreferences: (body, customFetch) =>
      apiFetch('/me/preferences', jsonRequest(body, { method: 'PATCH' }), customFetch),
    updatePassword: (body, customFetch) =>
      apiFetch('/me/security/password', jsonRequest(body, { method: 'POST' }), customFetch),
    requestEmailChange: (body, customFetch) =>
      apiFetch('/me/email/change-request', jsonRequest(body, { method: 'POST' }), customFetch),
    totpStatus: (customFetch) => apiFetch('/me/security/totp', {}, customFetch),
    initiateTotpSetup: (body, customFetch) =>
      apiFetch('/me/security/totp/initiate', jsonRequest(body, { method: 'POST' }), customFetch),
    enableTotp: (body, customFetch) =>
      apiFetch('/me/security/totp/enable', jsonRequest(body, { method: 'POST' }), customFetch),
    disableTotp: (body, customFetch) =>
      apiFetch('/me/security/totp/disable', jsonRequest(body, { method: 'POST' }), customFetch),
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
    update: (locationId, body) =>
      apiFetch(`/locations/${locationId}`, jsonRequest(body, { method: 'PATCH' })),
    deactivate: (locationId, body) =>
      apiFetch(`/locations/${locationId}/deactivate`, jsonRequest(body ?? {}, { method: 'POST' })),
    delete: (locationId) => apiFetch(`/locations/${locationId}`, { method: 'DELETE' }),
    purgeLegacy: () => apiFetch('/locations/purge-legacy', { method: 'POST' }),
  },
  pools: {
    list: (customFetch, owner = false) =>
      apiFetch(`/pools${owner ? '?owner=true' : ''}`, {}, customFetch),
    create: (body) => apiFetch('/pools', jsonRequest(body, { method: 'POST' })),
    show: (id, customFetch) => apiFetch(`/pools/${id}`, {}, customFetch),
    patch: (id, body) => apiFetch(`/pools/${id}`, jsonRequest(body, { method: 'PATCH' })),
    del: (id) => apiFetch(`/pools/${id}`, { method: 'DELETE' }),
    equipment: (poolId, customFetch) => apiFetch(`/pools/${poolId}/equipment`, {}, customFetch),
    updateEquipment: (poolId, body, customFetch) =>
      apiFetch(`/pools/${poolId}/equipment`, jsonRequest(body, { method: 'PUT' }), customFetch),
    temperaturePreferences: (poolId, customFetch) =>
      apiFetch(`/pools/${poolId}/temperature-preferences`, {}, customFetch),
    updateTemperaturePreferences: (poolId, body, customFetch) =>
      apiFetch(
        `/pools/${poolId}/temperature-preferences`,
        jsonRequest(body, { method: 'PUT' }),
        customFetch
      ),
    createTest: (poolId, body) =>
      apiFetch(`/pools/${poolId}/tests`, jsonRequest(body, { method: 'POST' })),
    sensorReadings: (poolId, customFetch, params = {}) => {
      const search = new URLSearchParams();
      if (typeof params.limit === 'number') search.set('limit', params.limit.toString());
      const query = search.toString();
      const path = `/pools/${poolId}/sensors/readings${query ? `?${query}` : ''}`;
      return apiFetch(path, {}, customFetch);
    },
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
  treatmentPlans: {
    generate: (poolId, customFetch = fetch) =>
      apiFetch(`/pools/${poolId}/treatment-plans/generate`, { method: 'POST' }, customFetch),
    list: (poolId, customFetch = fetch, params = {}) => {
      const search = new URLSearchParams();
      if (typeof params.limit === 'number') search.set('limit', params.limit.toString());
      const query = search.toString();
      const path = `/pools/${poolId}/treatment-plans${query ? `?${query}` : ''}`;
      return apiFetch(path, {}, customFetch);
    },
    show: (poolId, planId, customFetch = fetch) =>
      apiFetch(`/pools/${poolId}/treatment-plans/${planId}`, {}, customFetch),
    schedule: (poolId, planId, body, customFetch = fetch) =>
      apiFetch(`/pools/${poolId}/treatment-plans/${planId}/schedule`, jsonRequest(body, { method: 'POST' }), customFetch),
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
  outcomes: {
    due: (poolId, customFetch) => apiFetch(`/pools/${poolId}/prediction-outcomes/due`, {}, customFetch),
    update: (poolId, outcomeId, body) =>
      apiFetch(`/pools/${poolId}/prediction-outcomes/${outcomeId}`, jsonRequest(body, { method: 'PATCH' })),
    effectiveness: (poolId, customFetch) =>
      apiFetch(`/pools/${poolId}/recommendation-effectiveness`, {}, customFetch),
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
    equipment: (poolId, customFetch) =>
      apiFetch(`/admin/pools/${poolId}/equipment`, {}, customFetch),
    updateEquipment: (poolId, body, customFetch) =>
      apiFetch(`/admin/pools/${poolId}/equipment`, jsonRequest(body, { method: 'PUT' }), customFetch),
    temperaturePreferences: (poolId, customFetch) =>
      apiFetch(`/admin/pools/${poolId}/temperature-preferences`, {}, customFetch),
    updateTemperaturePreferences: (poolId, body, customFetch) =>
      apiFetch(
        `/admin/pools/${poolId}/temperature-preferences`,
        jsonRequest(body, { method: 'PUT' }),
        customFetch
      ),
  },
  adminReadiness: {
    get: (customFetch) => apiFetch('/admin/readiness', {}, customFetch),
  },
  adminIntegrations: {
    list: (customFetch) => apiFetch('/admin/integrations', {}, customFetch),
    get: (provider, customFetch) => apiFetch(`/admin/integrations/${provider}`, {}, customFetch),
    update: (provider, body, customFetch) =>
      apiFetch(`/admin/integrations/${provider}`, jsonRequest(body, { method: 'PATCH' }), customFetch),
  },
  integrations: {
    list: (customFetch) => apiFetch('/integrations', {}, customFetch),
    connect: (provider, body, customFetch) =>
      apiFetch(`/integrations/${provider}/connect`, jsonRequest(body ?? {}, { method: 'POST' }), customFetch),
    callback: (provider, body, customFetch) =>
      apiFetch(`/integrations/${provider}/callback`, jsonRequest(body ?? {}, { method: 'POST' }), customFetch),
    disconnect: (integrationId, customFetch) =>
      apiFetch(`/integrations/${integrationId}`, { method: 'DELETE' }, customFetch),
    listDevices: (integrationId, customFetch) =>
      apiFetch(`/integrations/${integrationId}/devices`, {}, customFetch),
    discoverDevices: (integrationId, body, customFetch) =>
      apiFetch(
        `/integrations/${integrationId}/devices/discover`,
        jsonRequest(body ?? {}, { method: 'POST' }),
        customFetch
      ),
    linkPool: (integrationId, deviceId, body, customFetch) =>
      apiFetch(
        `/integrations/${integrationId}/devices/${deviceId}/link-pool`,
        jsonRequest(body, { method: 'POST' }),
        customFetch
      ),
  },
  roleCapabilities: {
    list: (customFetch) => apiFetch('/admin/role-capabilities', {}, customFetch),
    update: (role, body, customFetch) =>
      apiFetch(`/admin/role-capabilities/${role}`, jsonRequest(body, { method: 'PATCH' }), customFetch),
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
    list: (customFetch, params = {}) => {
      const search = new URLSearchParams();
      if (typeof params.unreadOnly === 'boolean') {
        search.set('unreadOnly', params.unreadOnly ? 'true' : 'false');
      }
      if (typeof params.page === 'number') search.set('page', params.page.toString());
      if (typeof params.pageSize === 'number') search.set('pageSize', params.pageSize.toString());
      const query = search.toString();
      return apiFetch(`/notifications${query ? `?${query}` : ''}`, {}, customFetch);
    },
    summary: (customFetch) => apiFetch('/notifications/summary', {}, customFetch),
    read: (notificationId, customFetch) =>
      apiFetch(`/notifications/${notificationId}/read`, { method: 'POST' }, customFetch),
    readAll: (customFetch) => apiFetch('/notifications/read-all', { method: 'POST' }, customFetch),
    preview: (body, customFetch) =>
      apiFetch('/notifications/preview', jsonRequest(body, { method: 'POST' }), customFetch),
  },
  schedule: {
    list: (customFetch, params = {}) => {
      const search = new URLSearchParams();
      if (params.from) search.set('from', params.from);
      if (params.to) search.set('to', params.to);
      if (params.poolId) search.set('poolId', params.poolId);
      if (params.status) search.set('status', params.status);
      if (typeof params.limit === 'number') search.set('limit', params.limit.toString());
      const query = search.toString();
      return apiFetch(`/schedule/events${query ? `?${query}` : ''}`, {}, customFetch);
    },
    summary: (customFetch) => apiFetch('/schedule/summary', {}, customFetch),
    create: (body, customFetch) =>
      apiFetch('/schedule/events', jsonRequest(body, { method: 'POST' }), customFetch),
    update: (eventId, body, customFetch) =>
      apiFetch(`/schedule/events/${eventId}`, jsonRequest(body, { method: 'PATCH' }), customFetch),
    complete: (eventId, customFetch) =>
      apiFetch(`/schedule/events/${eventId}/complete`, { method: 'POST' }, customFetch),
    del: (eventId, customFetch) =>
      apiFetch(`/schedule/events/${eventId}`, { method: 'DELETE' }, customFetch),
  },
  messages: {
    listThreads: (customFetch, params = {}) => {
      const search = new URLSearchParams();
      if (typeof params.limit === 'number') search.set('limit', params.limit.toString());
      if (params.cursor) search.set('cursor', params.cursor);
      if (params.poolId) search.set('poolId', params.poolId);
      if (typeof params.unreadOnly === 'boolean') search.set('unreadOnly', params.unreadOnly ? 'true' : 'false');
      const query = search.toString();
      return apiFetch(`/messages${query ? `?${query}` : ''}`, {}, customFetch);
    },
    getThread: (threadId, customFetch, params = {}) => {
      const search = new URLSearchParams();
      if (params.before) search.set('before', params.before);
      if (typeof params.limit === 'number') search.set('limit', params.limit.toString());
      const query = search.toString();
      return apiFetch(`/messages/${threadId}${query ? `?${query}` : ''}`, {}, customFetch);
    },
    createThread: (body, customFetch) =>
      apiFetch('/messages/threads', jsonRequest(body, { method: 'POST' }), customFetch),
    sendMessage: (threadId, body, customFetch) =>
      apiFetch(`/messages/${threadId}/messages`, jsonRequest(body, { method: 'POST' }), customFetch),
    markThreadRead: (threadId, body, customFetch) =>
      apiFetch(`/messages/${threadId}/read`, jsonRequest(body ?? {}, { method: 'POST' }), customFetch),
  },
  billing: {
    summary: (customFetch) => apiFetch('/billing/summary', {}, customFetch),
    createPortalSession: (customFetch) => apiFetch('/billing/portal-session', { method: 'POST' }, customFetch),
  },
  contact: {
    submit: (body, customFetch) =>
      apiFetch('/contact/submit', jsonRequest(body, { method: 'POST' }), customFetch),
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
