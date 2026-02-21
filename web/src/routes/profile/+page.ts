import { redirect } from '@sveltejs/kit';
import { api } from '$lib/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent, fetch }) => {
  const { session } = await parent();
  if (!session?.user) throw redirect(302, '/auth/login');

  try {
    const res = await api.me.profile(fetch);
    if (res.ok) {
      const profile = await res.json();
      return { session, profile };
    }
  } catch (error) {
    console.error('Failed to load profile', error);
  }

  return { session, profile: null };
};
