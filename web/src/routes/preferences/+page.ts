import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { api } from '$lib/api';

export const load: PageLoad = async ({ parent, fetch }) => {
  const { session } = await parent();
  if (!session?.user) throw redirect(302, '/auth/login');

  try {
    const res = await api.me.preferences(fetch);
    if (res.ok) {
      const preferences = await res.json();
      return { session, preferences };
    }
  } catch (error) {
    console.error('Failed to load preferences', error);
  }

  return { session, preferences: null };
};
