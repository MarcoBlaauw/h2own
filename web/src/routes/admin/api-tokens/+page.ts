import { redirect } from '@sveltejs/kit';
import { api } from '$lib/api';
import type { PageLoad } from './$types';

export type AdminApiToken = {
  tokenId: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
  revoked: boolean;
  permissions: Record<string, unknown> | null;
};

type LoadOutput = {
  tokens: AdminApiToken[];
  loadError: string | null;
};

export const load: PageLoad<LoadOutput> = async ({ fetch, parent }) => {
  const { session } = await parent();
  if (!session || session.user?.role !== 'admin') {
    throw redirect(302, '/');
  }

  try {
    const response = await api.apiTokens.list(fetch);
    if (!response.ok) {
      return {
        tokens: [],
        loadError: `Failed to load API tokens (${response.status})`,
      } satisfies LoadOutput;
    }

    const tokens = (await response.json()) as AdminApiToken[];
    return { tokens, loadError: null } satisfies LoadOutput;
  } catch (error) {
    console.error('Failed to load API tokens', error);
    return {
      tokens: [],
      loadError: 'Unable to load API tokens. Please try again later.',
    } satisfies LoadOutput;
  }
};
