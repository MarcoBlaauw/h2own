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

export const load: LayoutServerLoad<{ session: SessionPayload | null }> = async ({
  fetch,
  request,
}) => {
  try {
    const cookie = request.headers.get('cookie') ?? '';
    const res = await api.auth.me((input, init = {}) =>
      fetch(input, {
        ...init,
        headers: {
          ...init.headers,
          cookie,
        },
      }),
    );
    if (res.ok) {
      const session = (await res.json()) as SessionPayload;
      return { session };
    }
    return { session: null };
  } catch (err) {
    return { session: null };
  }
};
