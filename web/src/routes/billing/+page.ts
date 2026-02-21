import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { api } from '$lib/api';

export const load: PageLoad = async ({ parent, fetch }) => {
  const { session } = await parent();
  if (!session?.user) throw redirect(302, '/auth/login');

  try {
    const res = await api.billing.summary(fetch);
    if (res.ok) {
      const payload = await res.json();
      return { session, payload };
    }
  } catch (error) {
    console.error('Failed to load billing placeholder payload', error);
  }

  return {
    session,
    payload: {
      featureStatus: 'placeholder',
      status: 'not_configured',
      plan: null,
      capabilities: { read: false, manage: false },
    },
  };
};
