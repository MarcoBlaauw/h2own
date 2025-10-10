import { api } from '$lib/api';

export async function load({ fetch }) {
  try {
    const res = await api.auth.me(fetch);
    if (res.ok) {
      const { user } = await res.json();
      return { user };
    }
    return { user: null };
  } catch (err) {
    return { user: null };
  }
}
