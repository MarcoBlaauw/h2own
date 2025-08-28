import { getMe } from '$lib/api';

export async function load({ fetch }) {
  try {
    const res = await getMe(fetch);
    if (res.ok) {
      const session = await res.json();
      return { session };
    }
    return { session: null };
  } catch (err) {
    return { session: null };
  }
}
