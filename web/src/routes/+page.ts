import { api } from '$lib/api';

export async function load({ fetch, url, parent }) {
  const { session } = await parent();
  if (!session) {
    return {
      pools: [],
      highlightedPool: null,
      latestTest: null,
      recommendations: null,
      savedRecommendations: [],
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
      let savedRecommendations = [];
      if (pools.length > 0) {
        const detailRes = await api.pools.show(pools[0].poolId, fetch);
        if (detailRes.ok) {
          highlightedPool = await detailRes.json();
        }
      }
      if (highlightedPool) {
        const [testsRes, recsRes, savedRes] = await Promise.all([
          api.tests.list(highlightedPool.id, fetch, { limit: 1 }),
          api.recommendations.preview(highlightedPool.id, fetch),
          api.recommendations.list(highlightedPool.id, fetch),
        ]);
        if (testsRes.ok) {
          const testsPayload = await testsRes.json();
          latestTest = testsPayload.items?.[0] ?? null;
        }
        if (recsRes.ok) {
          recommendations = await recsRes.json();
        }
        if (savedRes.ok) {
          savedRecommendations = await savedRes.json();
        }
      }
      return { pools, highlightedPool, latestTest, recommendations, savedRecommendations };
    }
    return {
      pools: [],
      highlightedPool: null,
      latestTest: null,
      recommendations: null,
      savedRecommendations: [],
    };
  } catch (err) {
    return {
      pools: [],
      highlightedPool: null,
      latestTest: null,
      recommendations: null,
      savedRecommendations: [],
    };
  }
}
