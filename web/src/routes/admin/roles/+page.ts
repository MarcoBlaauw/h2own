import { redirect } from '@sveltejs/kit';
import { api } from '$lib/api';
import type { PageLoad } from './$types';

export type RoleCapabilityTemplate = {
  role: 'admin' | 'business' | 'member';
  systemCapabilities: string[];
  accountCapabilities: string[];
};

export type RoleCapabilityRegistry = {
  systemCapabilities: string[];
  accountCapabilities: string[];
};

type LoadOutput = {
  roles: RoleCapabilityTemplate[];
  available: RoleCapabilityRegistry;
  loadError: string | null;
};

const emptyAvailable: RoleCapabilityRegistry = {
  systemCapabilities: [],
  accountCapabilities: [],
};

export const load: PageLoad<LoadOutput> = async ({ fetch, parent }) => {
  const { session } = await parent();
  if (!session || session.user?.role !== 'admin') {
    throw redirect(302, '/');
  }

  try {
    const response = await api.roleCapabilities.list(fetch);
    if (!response.ok) {
      return {
        roles: [],
        available: emptyAvailable,
        loadError: `Failed to load role templates (${response.status})`,
      } satisfies LoadOutput;
    }

    const payload = (await response.json()) as {
      roles: RoleCapabilityTemplate[];
      available: RoleCapabilityRegistry;
    };

    return {
      roles: payload.roles ?? [],
      available: payload.available ?? emptyAvailable,
      loadError: null,
    } satisfies LoadOutput;
  } catch (error) {
    console.error('Failed to load role capability templates', error);
    return {
      roles: [],
      available: emptyAvailable,
      loadError: 'Unable to load role templates. Please try again later.',
    } satisfies LoadOutput;
  }
};
