import { redirect } from '@sveltejs/kit';
import { api } from '$lib/api';

export async function load({ fetch, url, parent }) {
  const { session } = await parent();
  if (!session?.user) {
    throw redirect(302, '/auth/login');
  }

  const poolId = url.searchParams.get('poolId') ?? undefined;

  const [inventoryRes, transactionRes, costsRes, poolsRes, chemicalsRes, categoriesRes, vendorsRes, preferencesRes] = await Promise.all([
    api.inventory.list(fetch, { poolId }),
    api.inventory.listTransactions(fetch, { poolId, limit: 10 }),
    api.inventory.costs(fetch, { poolId, limit: 5, window: 'month' }),
    api.pools.list(fetch),
    api.chemicals.list(fetch),
    api.chemicals.listCategories(fetch),
    api.vendors.list(fetch),
    api.me.preferences(fetch),
  ]);

  return {
    inventory: inventoryRes.ok ? await inventoryRes.json() : { items: [], pools: [], scope: { poolId: poolId ?? null } },
    transactions: transactionRes.ok ? await transactionRes.json() : { items: [], pools: [] },
    costs: costsRes.ok ? await costsRes.json() : { items: [], summary: null, pools: [] },
    pools: poolsRes.ok ? await poolsRes.json() : [],
    chemicals: chemicalsRes.ok ? await chemicalsRes.json() : [],
    productCategories: categoriesRes.ok ? await categoriesRes.json() : [],
    vendors: vendorsRes.ok ? await vendorsRes.json() : [],
    preferences: preferencesRes.ok ? await preferencesRes.json() : null,
    selectedPoolId: poolId ?? null,
  };
}
