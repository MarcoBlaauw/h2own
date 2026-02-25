import { redirect } from '@sveltejs/kit';
import { api } from '$lib/api';
import type { PageLoad } from './$types';

export type PoolSummary = {
  poolId: string;
  name: string;
  volumeGallons: number;
  sanitizerType: string;
  chlorineSource?: string | null;
  saltLevelPpm?: number | null;
  sanitizerTargetMinPpm?: number | null;
  sanitizerTargetMaxPpm?: number | null;
  surfaceType: string;
  locationId: string | null;
  accessRole?: string;
  createdAt?: string;
  updatedAt?: string;
};

type LoadOutput = {
  defaultPoolId: string | null;
  pools: PoolSummary[];
  locations: Array<{
    locationId: string;
    name: string;
    formattedAddress?: string | null;
    googlePlaceId?: string | null;
    googlePlusCode?: string | null;
    latitude: number | null;
    longitude: number | null;
    timezone?: string | null;
    isPrimary?: boolean;
    isActive?: boolean;
    pools?: Array<{
      poolId: string;
      name: string;
    }>;
  }>;
  loadError: string | null;
};

export const load: PageLoad<LoadOutput> = async ({ fetch, parent }) => {
  const { session } = await parent();
  if (!session) {
    throw redirect(302, '/auth/login');
  }

  try {
    const [poolsRes, locationsRes, preferencesRes] = await Promise.all([
      api.pools.list(fetch),
      api.userLocations.list(fetch),
      api.me.preferences(fetch),
    ]);

    let loadError: string | null = null;

    if (!poolsRes.ok) {
      return {
        defaultPoolId: null,
        pools: [],
        locations: [],
        loadError: `Failed to load pools (${poolsRes.status})`,
      };
    }

    const pools = (await poolsRes.json()) as PoolSummary[];
    let locations: LoadOutput['locations'] = [];
    let defaultPoolId: string | null = null;
    if (locationsRes.ok) {
      locations = (await locationsRes.json()) as LoadOutput['locations'];
    } else {
      loadError = `Failed to load locations (${locationsRes.status})`;
    }
    if (preferencesRes.ok) {
      const preferences = (await preferencesRes.json()) as { defaultPoolId?: string | null };
      defaultPoolId = preferences.defaultPoolId ?? null;
    }
    return {
      defaultPoolId,
      pools,
      locations,
      loadError,
    };
  } catch (error) {
    console.error('Failed to load pools', error);
    return {
      defaultPoolId: null,
      pools: [],
      locations: [],
      loadError: 'Unable to load pools. Please try again later.',
    };
  }
};
