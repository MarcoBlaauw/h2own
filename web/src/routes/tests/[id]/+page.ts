import { api } from '$lib/api';

export async function load({ fetch, params, url }) {
  if (!params.id) {
    return { test: null, returnPoolId: null, loadError: 'Test not found.' };
  }

  try {
    const res = await api.tests.show(params.id, fetch);
    if (res.ok) {
      const test = await res.json();
      const poolIdParam = url.searchParams.get('poolId');
      const returnPoolId = poolIdParam && poolIdParam.trim() ? poolIdParam.trim() : test.poolId;
      return { test, returnPoolId, loadError: null };
    }
    if (res.status === 404) {
      return { test: null, returnPoolId: null, loadError: 'Test not found.' };
    }
    if (res.status === 403) {
      return { test: null, returnPoolId: null, loadError: 'You do not have access to this test.' };
    }
    return { test: null, returnPoolId: null, loadError: `Unable to load test (${res.status}).` };
  } catch {
    return { test: null, returnPoolId: null, loadError: 'Unable to load test.' };
  }
}
