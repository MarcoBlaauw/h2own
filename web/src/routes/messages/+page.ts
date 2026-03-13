import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { api } from '$lib/api';

export const load: PageLoad = async ({ parent, fetch, url }) => {
  const { session } = await parent();
  if (!session?.user) throw redirect(302, '/auth/login');

  const selectedThreadId = url.searchParams.get('threadId');

  try {
    const threadsRes = await api.messages.listThreads(fetch, { limit: 20 });
    const threadsPayload = threadsRes.ok ? await threadsRes.json() : { items: [], nextCursor: null };
    const activeThreadId = selectedThreadId ?? threadsPayload.items?.[0]?.threadId ?? null;

    let threadPayload = null;
    if (activeThreadId) {
      const threadRes = await api.messages.getThread(activeThreadId, fetch, { limit: 30 });
      threadPayload = threadRes.ok ? await threadRes.json() : null;
    }

    return {
      session,
      threads: threadsPayload,
      selectedThreadId: activeThreadId,
      threadPayload,
    };
  } catch (error) {
    console.error('Failed to load messages', error);
  }

  return {
    session,
    threads: { items: [], nextCursor: null },
    selectedThreadId: null,
    threadPayload: null,
  };
};
