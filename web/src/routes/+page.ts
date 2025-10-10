import { getPools, pools as poolsApi } from '$lib/api';

export async function load({ fetch, url, parent }) {
  const { session } = await parent();
  if (!session) {
    return { pools: [], highlightedPool: null };
  }
  try {
    const owner = url.searchParams.get('owner') === 'true';
    const res = await getPools({ owner }, fetch);
    if (res.ok) {
      const pools = await res.json();
      let highlightedPool = null;
      if (pools.length > 0) {
        const detailRes = await poolsApi.show(pools[0].poolId, fetch);
        if (detailRes.ok) {
          highlightedPool = await detailRes.json();
        }
      }
      return { pools, highlightedPool };
    }
    return { pools: [], highlightedPool: null };
  } catch (err) {
    return { pools: [], highlightedPool: null };
  }
}
