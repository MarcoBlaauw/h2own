import { api } from '$lib/api';
import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

type OverviewTest = Record<string, unknown>;

type LoadOutput = {
  pools: unknown[];
  locations: unknown[];
  preferences: {
    defaultPoolId?: string | null;
    measurementSystem?: 'metric' | 'imperial' | null;
  } | null;
  highlightedPool: ({
    id: string;
    locationId?: string | null;
    equipment?: {
      equipmentType?: string | null;
      energySource?: string | null;
      status?: string | null;
      capacityBtu?: number | null;
    } | null;
    tests?: OverviewTest[];
  } & Record<string, unknown>) | null;
  defaultPoolId: string | null;
  latestTest: OverviewTest | null;
  recentTests: OverviewTest[];
  recommendations: unknown;
  latestTreatmentPlan: unknown;
  recommendationHistory: unknown[];
  dosingHistory: unknown[];
  inventoryItems: unknown[];
  weatherDaily: unknown[];
  weatherError: string | null;
  effectiveness: { byPool: unknown[]; byTreatmentType: unknown[] };
  dueOutcomePrompts: unknown[];
};

export const load: PageLoad<LoadOutput> = async ({ fetch, url, parent }) => {
  const { session } = await parent();
  if (!session?.user) {
    throw redirect(302, '/auth/login');
  }
  try {
    const requestedPoolId = url.searchParams.get('poolId');
    const owner = url.searchParams.get('owner') === 'true';
    const [res, preferencesRes, locationsRes] = await Promise.all([
      api.pools.list(fetch, owner),
      api.me.preferences(fetch),
      api.userLocations.list(fetch),
    ]);
    if (res.ok) {
      const pools = await res.json();
      const preferences = preferencesRes.ok ? await preferencesRes.json() : null;
      const defaultPoolId =
        typeof preferences?.defaultPoolId === 'string' ? preferences.defaultPoolId : null;
      let highlightedPool: {
        id: string;
        locationId?: string | null;
        equipment?: {
          equipmentType?: string | null;
          energySource?: string | null;
          status?: string | null;
          capacityBtu?: number | null;
        } | null;
      } | null = null;
      let highlightedPoolEquipment: {
        equipmentType?: string | null;
        energySource?: string | null;
        status?: string | null;
        capacityBtu?: number | null;
      } | null = null;
      let recentTests: OverviewTest[] = [];
      let latestTest: OverviewTest | null = null;
      let recommendations = null;
      let latestTreatmentPlan = null;
      let recommendationHistory = [];
      let dosingHistory = [];
      let inventoryItems = [];
      let weatherDaily = [];
      let weatherError: string | null = null;
      let effectiveness = { byPool: [], byTreatmentType: [] };
      let dueOutcomePrompts = [];
      if (pools.length > 0) {
        const selectedPoolId =
          requestedPoolId && pools.some((pool: { poolId?: string }) => pool.poolId === requestedPoolId)
            ? requestedPoolId
            : defaultPoolId && pools.some((pool: { poolId?: string }) => pool.poolId === defaultPoolId)
              ? defaultPoolId
              : null;
        const highlightedCandidate =
          (selectedPoolId
            ? pools.find((pool: { poolId?: string }) => pool.poolId === selectedPoolId)
            : null) ??
          pools.find(
            (pool: { poolId?: string; locationId?: string | null }) =>
              typeof pool.poolId === 'string' && Boolean(pool.locationId)
          ) ?? pools[0];
        const detailRes = await api.pools.show(highlightedCandidate.poolId, fetch);
        if (detailRes.ok) {
          highlightedPool = await detailRes.json();
          const equipmentRes = await api.pools.equipment(highlightedCandidate.poolId, fetch);
          if (equipmentRes.ok) {
            highlightedPoolEquipment = await equipmentRes.json();
          }
        }
      }
      if (highlightedPool && highlightedPoolEquipment) {
        highlightedPool = {
          ...highlightedPool,
          equipment: highlightedPoolEquipment,
        };
      }
      if (highlightedPool) {
        recentTests = Array.isArray((highlightedPool as { tests?: OverviewTest[] }).tests)
          ? ((highlightedPool as { tests?: OverviewTest[] }).tests ?? [])
          : [];
        latestTest = recentTests[0] ?? null;

        const [plansRes, recsRes, historyRes, dosingRes, inventoryRes, effectivenessRes, dueOutcomesRes] = await Promise.all([
          api.treatmentPlans.list(highlightedPool.id, fetch, { limit: 1 }),
          api.recommendations.preview(highlightedPool.id, fetch),
          api.recommendations.list(highlightedPool.id, fetch, { limit: 5 }),
          api.dosing.list(highlightedPool.id, fetch, { limit: 5 }),
          api.inventory.list(fetch, { poolId: highlightedPool.id }),
          api.outcomes.effectiveness(highlightedPool.id, fetch),
          api.outcomes.due(highlightedPool.id, fetch),
        ]);
        if (plansRes.ok) {
          const planPayload = await plansRes.json();
          latestTreatmentPlan = planPayload.items?.[0] ?? null;
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
        if (inventoryRes.ok) {
          const inventoryPayload = await inventoryRes.json();
          inventoryItems = inventoryPayload.items ?? [];
        }
        if (effectivenessRes.ok) {
          effectiveness = await effectivenessRes.json();
        }
        if (dueOutcomesRes.ok) {
          const duePayload = await dueOutcomesRes.json();
          dueOutcomePrompts = duePayload.items ?? [];
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
          refresh: true,
        });
        if (weatherRes.ok) {
          const payload = await weatherRes.json();
          weatherDaily = payload.items ?? [];
        } else {
          const payload = await weatherRes.json().catch(() => ({}));
          weatherError =
            payload?.error ??
            payload?.message ??
            `Unable to load weather data (${weatherRes.status}).`;
        }
      }
      return {
        pools,
        locations: locationsRes.ok ? await locationsRes.json() : [],
        preferences,
        highlightedPool,
        defaultPoolId,
        latestTest,
        recentTests,
        recommendations,
        latestTreatmentPlan,
        recommendationHistory,
        dosingHistory,
        inventoryItems,
        weatherDaily,
        weatherError,
        effectiveness,
        dueOutcomePrompts,
      };
    }
    return {
      pools: [],
      locations: [],
      preferences: null,
      highlightedPool: null,
      defaultPoolId: null,
      latestTest: null,
      recentTests: [],
      recommendations: null,
      latestTreatmentPlan: null,
      recommendationHistory: [],
      dosingHistory: [],
      inventoryItems: [],
      weatherDaily: [],
      weatherError: null,
      effectiveness: { byPool: [], byTreatmentType: [] },
      dueOutcomePrompts: [],
    };
  } catch (err) {
    return {
      pools: [],
      locations: [],
      preferences: null,
      highlightedPool: null,
      defaultPoolId: null,
      latestTest: null,
      recentTests: [],
      recommendations: null,
      latestTreatmentPlan: null,
      recommendationHistory: [],
      dosingHistory: [],
      inventoryItems: [],
      weatherDaily: [],
      weatherError: null,
      effectiveness: { byPool: [], byTreatmentType: [] },
      dueOutcomePrompts: [],
    };
  }
};
