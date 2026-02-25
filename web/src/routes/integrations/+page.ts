import { redirect } from '@sveltejs/kit';
import { api } from '$lib/api';
import type { PageLoad } from './$types';
import type { PoolSummary } from '../pools/+page';

export type UserIntegration = {
  integrationId: string;
  userId: string;
  provider: string;
  status: string;
  scopes: unknown;
  externalAccountId: string | null;
  hasApiKey: boolean;
  apiKeyPreview: string | null;
  pollIntervalMinutes: number | null;
  pollIntervalUpdatedAt: string | null;
  pollIntervalDecreaseAllowedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type LoadOutput = {
  integrations: UserIntegration[];
  pools: PoolSummary[];
  loadError: string | null;
};

export const load: PageLoad<LoadOutput> = async ({ parent, fetch }) => {
  const { session } = await parent();
  if (!session?.user) throw redirect(302, '/auth/login');

  try {
    const [integrationsResponse, poolsResponse] = await Promise.all([
      api.integrations.list(fetch),
      api.pools.list(fetch),
    ]);

    if (!integrationsResponse.ok) {
      return {
        integrations: [],
        pools: [],
        loadError: `Failed to load integrations (${integrationsResponse.status})`,
      };
    }
    const integrations = (await integrationsResponse.json()) as UserIntegration[];
    const pools = poolsResponse.ok ? ((await poolsResponse.json()) as PoolSummary[]) : [];

    return {
      integrations,
      pools,
      loadError: poolsResponse.ok ? null : `Failed to load pools (${poolsResponse.status})`,
    };
  } catch (error) {
    console.error('Failed to load user integrations', error);
    return {
      integrations: [],
      pools: [],
      loadError: 'Unable to load integrations. Please try again later.',
    };
  }
};
