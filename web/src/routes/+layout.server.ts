import { api } from '$lib/api';

export async function load({ fetch }) {
  try {
    const res = await api.auth.me(fetch);
    if (res.ok) {
      const session = await res.json();
      return { session };
    }
    return { session: null };
  } catch (err) {
    return { session: null };
  }
}
