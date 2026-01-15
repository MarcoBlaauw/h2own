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
      dosingHistory: [],
      costs: [],
      costSummary: null,
      weatherDaily: [],
    };
  }
  try {
    const owner = url.searchParams.get('owner') === 'true';
    const res = await api.pools.list(fetch, owner);
    if (res.ok) {
      const pools = await res.json();
      let highlightedPool: { id: string; locationId?: string | null } | null = null;
      let latestTest = null;
      let recommendations = null;
      let recommendationHistory = [];
      let dosingHistory = [];
      let costs = [];
      let costSummary = null;
      let weatherDaily = [];
      if (pools.length > 0) {
        const detailRes = await api.pools.show(pools[0].poolId, fetch);
        if (detailRes.ok) {
          highlightedPool = await detailRes.json();
        }
      }
      if (highlightedPool) {
        const [testsRes, recsRes, historyRes, dosingRes, costsRes, summaryRes] = await Promise.all([
          api.tests.list(highlightedPool.id, fetch, { limit: 1 }),
          api.recommendations.preview(highlightedPool.id, fetch),
          api.recommendations.list(highlightedPool.id, fetch, { limit: 5 }),
          api.dosing.list(highlightedPool.id, fetch, { limit: 5 }),
          api.costs.list(highlightedPool.id, fetch, { limit: 5 }),
          api.costs.summary(highlightedPool.id, fetch, { window: 'month' }),
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
        if (dosingRes.ok) {
          const dosingPayload = await dosingRes.json();
          dosingHistory = dosingPayload.items ?? [];
        }
        if (costsRes.ok) {
          const costsPayload = await costsRes.json();
          costs = costsPayload.items ?? [];
        }
        if (summaryRes.ok) {
          costSummary = await summaryRes.json();
        }
      }
      if (highlightedPool?.locationId) {
        const now = new Date();
        const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        const end = new Date(start);
        end.setUTCDate(start.getUTCDate() + 6);
        const weatherRes = await api.weather.list(highlightedPool.locationId, fetch, {
          from: start.toISOString(),
          to: end.toISOString(),
          granularity: 'day',
        });
        if (weatherRes.ok) {
          const payload = await weatherRes.json();
          weatherDaily = payload.items ?? [];
        }
      }
      return {
        pools,
        highlightedPool,
        latestTest,
        recommendations,
        recommendationHistory,
        dosingHistory,
        costs,
        costSummary,
        weatherDaily,
      };
    }
    return {
      pools: [],
      highlightedPool: null,
      latestTest: null,
      recommendations: null,
      recommendationHistory: [],
      dosingHistory: [],
      costs: [],
      costSummary: null,
      weatherDaily: [],
    };
  } catch (err) {
    return {
      pools: [],
      highlightedPool: null,
      latestTest: null,
      recommendations: null,
      recommendationHistory: [],
      dosingHistory: [],
      costs: [],
      costSummary: null,
      weatherDaily: [],
    };
  }
}
