import { api } from '$lib/api';
import { redirect } from '@sveltejs/kit';

export async function load({ fetch, parent, url }) {
  const { session } = await parent();
  if (!session?.user) {
    throw redirect(302, '/auth/login');
  }

  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));
  const requestedPoolId = url.searchParams.get('poolId') || undefined;

  try {
    const [eventsRes, poolsRes, summaryRes, prefsRes] = await Promise.all([
      api.schedule.list(fetch, {
        from: from.toISOString(),
        to: to.toISOString(),
        poolId: requestedPoolId,
      }),
      api.pools.list(fetch),
      api.schedule.summary(fetch),
      api.me.preferences(fetch),
    ]);

    return {
      session,
      events: eventsRes.ok ? await eventsRes.json() : { items: [] },
      pools: poolsRes.ok ? await poolsRes.json() : [],
      summary: summaryRes.ok ? await summaryRes.json() : { scheduledCount: 0, overdueCount: 0 },
      preferences: prefsRes.ok ? await prefsRes.json() : null,
      requestedPoolId: requestedPoolId ?? null,
    };
  } catch {
    return {
      session,
      events: { items: [] },
      pools: [],
      summary: { scheduledCount: 0, overdueCount: 0 },
      preferences: null,
      requestedPoolId: requestedPoolId ?? null,
    };
  }
}
