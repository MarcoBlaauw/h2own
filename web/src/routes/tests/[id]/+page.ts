import { api } from '$lib/api';

export async function load({ fetch, params }) {
  if (!params.id) {
    return { test: null, loadError: 'Test not found.' };
  }

  try {
    const res = await api.tests.show(params.id, fetch);
    if (res.ok) {
      const test = await res.json();
      return { test, loadError: null };
    }
    if (res.status === 404) {
      return { test: null, loadError: 'Test not found.' };
    }
    if (res.status === 403) {
      return { test: null, loadError: 'You do not have access to this test.' };
    }
    return { test: null, loadError: `Unable to load test (${res.status}).` };
  } catch {
    return { test: null, loadError: 'Unable to load test.' };
  }
}
