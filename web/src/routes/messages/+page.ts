import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { api } from '$lib/api';

export const load: PageLoad = async ({ parent, fetch }) => {
  const { session } = await parent();
  if (!session?.user) throw redirect(302, '/auth/login');

  try {
    const res = await api.messages.list(fetch);
    if (res.ok) {
      const payload = await res.json();
      return { session, payload };
    }
  } catch (error) {
    console.error('Failed to load messages placeholder payload', error);
  }

  return {
    session,
    payload: {
      featureStatus: 'placeholder',
      conversations: [],
      capabilities: { read: false, send: false },
    },
  };
};
