import { api } from '$lib/api';

export async function load({ fetch, params }) {
  try {
    const [res, plansRes, recPreviewRes] = await Promise.all([
      api.pools.show(params.id, fetch),
      api.treatmentPlans.list(params.id, fetch, { limit: 10 }),
      api.recommendations.preview(params.id, fetch),
    ]);
    if (res.ok) {
      const pool = await res.json();
      const plans = plansRes.ok ? (await plansRes.json()).items ?? [] : [];
      const recommendationPreview = recPreviewRes.ok ? await recPreviewRes.json() : null;
      return { pool, plans, recommendationPreview };
    }
    return { pool: null, plans: [], recommendationPreview: null };
  } catch {
    return { pool: null, plans: [], recommendationPreview: null };
  }
}
