import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { api } from '$lib/api';

export const load: PageLoad = async ({ parent, fetch }) => {
  const { session } = await parent();
  if (!session?.user) throw redirect(302, '/auth/login');

  try {
    const [preferencesRes, poolsRes] = await Promise.all([
      api.me.preferences(fetch),
      api.pools.list(fetch),
    ]);
    const preferences = preferencesRes.ok ? await preferencesRes.json() : null;
    const pools = poolsRes.ok ? await poolsRes.json() : [];
    return { session, preferences, pools };
  } catch (error) {
    console.error('Failed to load preferences', error);
  }

  return { session, preferences: null, pools: [] };
};
