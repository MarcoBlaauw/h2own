const base = import.meta.env.VITE_API_URL;

export async function apiFetch(path: string, opts: RequestInit = {}, customFetch = fetch) {
  return customFetch(`${base}${path}`, {
    ...opts,
    credentials: 'include',
  });
}

export async function getMe(customFetch = fetch) {
  return apiFetch('/auth/me', {}, customFetch);
}

export async function getPools({ owner = false }, customFetch = fetch) {
  return apiFetch(`/pools${owner ? '?owner=true' : ''}`, {}, customFetch);
}

export const auth = {
  register: async (body: any, customFetch = fetch) => apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }, customFetch),
  login: async (body: any, customFetch = fetch) => apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }, customFetch),
  logout: async (customFetch = fetch) => apiFetch('/auth/logout', { method: 'POST' }, customFetch),
  me: async (customFetch = fetch) => apiFetch('/auth/me', {}, customFetch),
};

export const pools = {
  list: async (customFetch = fetch, owner = false) => apiFetch(`/pools${owner ? '?owner=true' : ''}`, {}, customFetch),
  create: async (body: any) => apiFetch('/pools', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }),
  show: async (id: string, customFetch = fetch) => apiFetch(`/pools/${id}`, {}, customFetch),
  patch: async (id: string, body: any) => apiFetch(`/pools/${id}`, { method: 'PATCH', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }),
  del: async (id: string) => apiFetch(`/pools/${id}`, { method: 'DELETE' }),
};

export const tests = {
  create: async (poolId: string, body: any) => apiFetch(`/pools/${poolId}/tests`, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }),
};

export const members = {
  update: async (poolId: string, userId: string, body: any) => apiFetch(`/pools/${poolId}/members/${userId}`, { method: 'PUT', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }),
  del: async (poolId: string, userId: string) => apiFetch(`/pools/${poolId}/members/${userId}`, { method: 'DELETE' }),
};
