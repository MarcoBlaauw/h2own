import { api } from '$lib/api';

export async function load({ fetch, url, parent }) {
  const { session } = await parent();
  if (!session) {
    return {
      pools: [],
      highlightedPool: null,
      latestTest: null,
      recommendations: null,
      recommendationHistory: [],
    };
  }
  try {
    const owner = url.searchParams.get('owner') === 'true';
    const res = await api.pools.list(fetch, owner);
    if (res.ok) {
      const pools = await res.json();
      let highlightedPool: { id: string } | null = null;
      let latestTest = null;
      let recommendations = null;
      let recommendationHistory = [];
      if (pools.length > 0) {
        const detailRes = await api.pools.show(pools[0].poolId, fetch);
        if (detailRes.ok) {
          highlightedPool = await detailRes.json();
        }
      }
      if (highlightedPool) {
        const [testsRes, recsRes, historyRes] = await Promise.all([
          api.tests.list(highlightedPool.id, fetch, { limit: 1 }),
          api.recommendations.preview(highlightedPool.id, fetch),
          api.recommendations.list(highlightedPool.id, fetch, { limit: 5 }),
        ]);
        if (testsRes.ok) {
          const testsPayload = await testsRes.json();
          latestTest = testsPayload.items?.[0] ?? null;
        }
        if (recsRes.ok) {
          recommendations = await recsRes.json();
        }
        if (historyRes.ok) {
          const historyPayload = await historyRes.json();
          recommendationHistory = historyPayload.items ?? [];
        }
      }
      return { pools, highlightedPool, latestTest, recommendations, recommendationHistory };
    }
    return {
      pools: [],
      highlightedPool: null,
      latestTest: null,
      recommendations: null,
      recommendationHistory: [],
    };
  } catch (err) {
    return {
      pools: [],
      highlightedPool: null,
      latestTest: null,
      recommendations: null,
      recommendationHistory: [],
    };
  }
}
