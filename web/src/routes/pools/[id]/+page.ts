import { api } from '$lib/api';

export async function load({ fetch, params }) {
  try {
    const res = await api.pools.show(params.id, fetch);
    if (res.ok) {
      const pool = await res.json();
      return { pool };
    }
    return { pool: null };
  } catch {
    return { pool: null };
  }
}
