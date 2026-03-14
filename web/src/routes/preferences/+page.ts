import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { api } from '$lib/api';

export const load: PageLoad = async ({ parent, fetch }) => {
  const { session } = await parent();
  if (!session?.user) throw redirect(302, '/auth/login');

  try {
    const [preferencesRes, poolsRes, readinessRes] = await Promise.all([
      api.me.preferences(fetch),
      api.pools.list(fetch),
      api.me.notificationReadiness(fetch),
    ]);
    const preferences = preferencesRes.ok ? await preferencesRes.json() : null;
    const pools = poolsRes.ok ? await poolsRes.json() : [];
    const notificationReadiness = readinessRes.ok ? await readinessRes.json() : { channels: [] };
    return { session, preferences, pools, notificationReadiness };
  } catch (error) {
    console.error('Failed to load preferences', error);
  }

  return { session, preferences: null, pools: [], notificationReadiness: { channels: [] } };
};
