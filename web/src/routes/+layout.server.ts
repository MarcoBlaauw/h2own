import { api } from '$lib/api';
import type { LayoutServerLoad } from './$types';

type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  role?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  nickname?: string | null;
  address?: string | null;
  supervisors?: Array<{
    userId: string;
    email: string;
    name: string | null;
  }>;
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
      if (session?.user?.id) {
        const profileRes = await api.me.profile((input, init = {}) =>
          fetch(input, {
            ...init,
            headers: {
              ...init.headers,
              cookie,
            },
          }),
        );
        if (profileRes.ok) {
          const profile = (await profileRes.json()) as {
            firstName?: string | null;
            lastName?: string | null;
            nickname?: string | null;
            address?: string | null;
            supervisors?: Array<{ userId: string; email: string; name: string | null }>;
          };
          session.user = {
            ...session.user,
            firstName: profile.firstName ?? null,
            lastName: profile.lastName ?? null,
            nickname: profile.nickname ?? null,
            address: profile.address ?? null,
            supervisors: profile.supervisors ?? [],
          };
        }

        return { session };
      }
      return { session };
    }
    return { session: null };
  } catch (err) {
    return { session: null };
  }
};
