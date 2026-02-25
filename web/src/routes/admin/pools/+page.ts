import { redirect } from '@sveltejs/kit';
import { api } from '$lib/api';
import type { PageLoad } from './$types';

export type AdminPoolMember = {
  poolId: string;
  userId: string;
  roleName: string;
  email: string | null;
  name: string | null;
};

export type AdminPool = {
  id: string;
  ownerId: string;
  name: string;
  volumeGallons: number;
  surfaceType: string | null;
  sanitizerType: string | null;
  chlorineSource: string | null;
  saltLevelPpm: number | null;
  sanitizerTargetMinPpm: number | null;
  sanitizerTargetMaxPpm: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  owner: {
    id: string;
    email: string | null;
    name: string | null;
  } | null;
  memberCount: number;
  lastTestedAt: string | null;
  members: AdminPoolMember[];
};

export type LoadOutput = {
  pools: AdminPool[];
  loadError: string | null;
};

export const load: PageLoad<LoadOutput> = async ({ fetch, parent }) => {
  const { session } = await parent();
  if (!session || session.user?.role !== 'admin') {
    throw redirect(302, '/');
  }

  try {
    const response = await api.adminPools.list(fetch);
    if (!response.ok) {
      return {
        pools: [],
        loadError: `Failed to load pools (${response.status})`,
      } satisfies LoadOutput;
    }

    const pools = (await response.json()) as AdminPool[];
    return {
      pools,
      loadError: null,
    } satisfies LoadOutput;
  } catch (error) {
    console.error('Failed to load admin pools', error);
    return {
      pools: [],
      loadError: 'Unable to load pools. Please try again later.',
    } satisfies LoadOutput;
  }
};
