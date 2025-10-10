import { api } from '$lib/api';
import type { LayoutServerLoad } from './$types';

type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  role?: string | null;
};

type SessionPayload = {
  user: SessionUser | null;
};

export const load: LayoutServerLoad<{ session: SessionPayload | null }> = async ({ fetch }) => {
  try {
    const res = await api.auth.me(fetch);
    if (res.ok) {
      const session = (await res.json()) as SessionPayload;
      return { session };
    }
    return { session: null };
  } catch (err) {
    return { session: null };
  }
};
