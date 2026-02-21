import { redirect } from '@sveltejs/kit';
import { api } from '$lib/api';
import type { PageLoad } from './$types';

export type AdminIntegration = {
  integrationId: string;
  provider: string;
  displayName: string;
  enabled: boolean;
  cacheTtlSeconds: number | null;
  rateLimitCooldownSeconds: number | null;
  config: Record<string, unknown> | null;
  credentials: {
    hasApiKey: boolean;
    apiKeyPreview: string | null;
  } | null;
  lastResponseCode: number | null;
  lastResponseText: string | null;
  lastResponseAt: string | null;
  lastSuccessAt: string | null;
  nextAllowedRequestAt: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

type LoadOutput = {
  integrations: AdminIntegration[];
  loadError: string | null;
};

export const load: PageLoad<LoadOutput> = async ({ fetch, parent }) => {
  const { session } = await parent();
  if (!session || session.user?.role !== 'admin') {
    throw redirect(302, '/');
  }

  try {
    const response = await api.adminIntegrations.list(fetch);
    if (!response.ok) {
      return {
        integrations: [],
        loadError: `Failed to load integrations (${response.status})`,
      } satisfies LoadOutput;
    }

    const integrations = (await response.json()) as AdminIntegration[];
    return { integrations, loadError: null } satisfies LoadOutput;
  } catch (error) {
    console.error('Failed to load integrations', error);
    return {
      integrations: [],
      loadError: 'Unable to load integrations. Please try again later.',
    } satisfies LoadOutput;
  }
};
