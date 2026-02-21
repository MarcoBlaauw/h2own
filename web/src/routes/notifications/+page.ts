import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { api } from '$lib/api';

export const load: PageLoad = async ({ parent, fetch, url }) => {
  const { session } = await parent();
  if (!session?.user) throw redirect(302, '/auth/login');
  const unreadOnly = url.searchParams.get('unreadOnly') === 'true';
  const page = Number(url.searchParams.get('page') ?? 1);

  try {
    const res = await api.notifications.list(fetch, {
      unreadOnly,
      page: Number.isFinite(page) && page > 0 ? page : 1,
      pageSize: 20,
    });
    if (res.ok) {
      const notifications = await res.json();
      return { session, notifications, unreadOnly };
    }
  } catch (error) {
    console.error('Failed to load notifications', error);
  }

  return {
    session,
    unreadOnly,
    notifications: {
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 1,
      unreadCount: 0,
    },
  };
};
