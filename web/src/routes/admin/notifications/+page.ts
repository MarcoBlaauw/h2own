import { redirect } from '@sveltejs/kit';
import { api } from '$lib/api';
import type { PageLoad } from './$types';

export type NotificationTemplate = {
  templateId: string;
  name: string;
  channel: string;
  subject: string | null;
  bodyTemplate: string;
  isActive: boolean;
  createdAt: string;
};

type LoadOutput = {
  templates: NotificationTemplate[];
  loadError: string | null;
};

export const load: PageLoad<LoadOutput> = async ({ fetch, parent }) => {
  const { session } = await parent();
  if (!session || session.user?.role !== 'admin') {
    throw redirect(302, '/');
  }

  try {
    const res = await api.notificationTemplates.list(fetch);
    if (!res.ok) {
      return {
        templates: [],
        loadError: `Failed to load templates (${res.status})`,
      };
    }

    const templates = (await res.json()) as NotificationTemplate[];
    return {
      templates,
      loadError: null,
    };
  } catch (error) {
    console.error('Failed to load notification templates', error);
    return {
      templates: [],
      loadError: 'Unable to load templates. Please try again later.',
    };
  }
};
