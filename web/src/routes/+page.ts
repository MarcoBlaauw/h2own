import { getPools } from '$lib/api';

export async function load({ fetch, url, parent }) {
  const { session } = await parent();
  if (!session) {
    return { pools: [] };
  }
  try {
    const owner = url.searchParams.get('owner') === 'true';
    const res = await getPools({ owner }, fetch);
    if (res.ok) {
      const pools = await res.json();
      return { pools };
    }
    return { pools: [] };
  } catch (err) {
    return { pools: [] };
  }
}
