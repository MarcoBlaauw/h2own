import { redirect } from '@sveltejs/kit';
import { api } from '$lib/api';
import type { PageLoad } from './$types';

type PoolSummary = {
  poolId: string;
  name?: string | null;
};

type TestItem = {
  sessionId: string;
  poolId: string;
  testedAt: string;
};

type RecommendationItem = {
  linkedTestId?: string | null;
  title?: string | null;
  description?: string | null;
};

export type TestsHistoryRow = {
  testId: string;
  poolId: string;
  poolName: string;
  testedAt: string;
  recommendationSummary: string;
};

type LoadOutput = {
  rows: TestsHistoryRow[];
  loadError: string | null;
};

const toIsoDate = (value: unknown): string | null => {
  if (typeof value !== 'string' && !(value instanceof Date)) return null;
  const dateValue = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dateValue.getTime())) return null;
  return dateValue.toISOString();
};

export const load: PageLoad<LoadOutput> = async ({ fetch, parent }) => {
  const { session } = await parent();
  if (!session) {
    throw redirect(302, '/auth/login');
  }

  try {
    const poolsRes = await api.pools.list(fetch);
    if (!poolsRes.ok) {
      return { rows: [], loadError: `Failed to load pools (${poolsRes.status}).` };
    }

    const pools = (await poolsRes.json()) as PoolSummary[];
    if (!Array.isArray(pools) || pools.length === 0) {
      return { rows: [], loadError: null };
    }

    const poolResults = await Promise.all(
      pools.map(async (pool) => {
        if (!pool?.poolId) {
          return { pool, tests: [] as TestItem[], recommendations: [] as RecommendationItem[] };
        }

        const [testsRes, recommendationsRes] = await Promise.all([
          api.tests.list(pool.poolId, fetch, { limit: 100 }),
          api.recommendations.list(pool.poolId, fetch, { limit: 100 }),
        ]);

        const testsPayload = testsRes.ok ? await testsRes.json() : { items: [] };
        const recommendationsPayload = recommendationsRes.ok
          ? await recommendationsRes.json()
          : { items: [] };

        return {
          pool,
          tests: Array.isArray(testsPayload?.items) ? (testsPayload.items as TestItem[]) : [],
          recommendations: Array.isArray(recommendationsPayload?.items)
            ? (recommendationsPayload.items as RecommendationItem[])
            : [],
        };
      })
    );

    const rows: TestsHistoryRow[] = [];

    for (const result of poolResults) {
      const recommendationsByTestId = new Map<string, string[]>();

      for (const recommendation of result.recommendations) {
        const linkedTestId = recommendation?.linkedTestId ?? null;
        if (!linkedTestId) continue;

        const title = recommendation?.title?.trim();
        const description = recommendation?.description?.trim();
        const summary = title || description;
        if (!summary) continue;

        const current = recommendationsByTestId.get(linkedTestId) ?? [];
        if (!current.includes(summary)) {
          current.push(summary);
          recommendationsByTestId.set(linkedTestId, current);
        }
      }

      for (const test of result.tests) {
        const testedAt = toIsoDate(test?.testedAt);
        if (!test?.sessionId || !test?.poolId || !testedAt) continue;

        const recommendationSummary =
          recommendationsByTestId.get(test.sessionId)?.join(' | ') ?? 'No recommendation logged';

        rows.push({
          testId: test.sessionId,
          poolId: test.poolId,
          poolName: result.pool.name?.trim() || result.pool.poolId,
          testedAt,
          recommendationSummary,
        });
      }
    }

    rows.sort((a, b) => new Date(b.testedAt).getTime() - new Date(a.testedAt).getTime());

    return { rows, loadError: null };
  } catch {
    return {
      rows: [],
      loadError: 'Unable to load tests history right now. Please try again.',
    };
  }
};
