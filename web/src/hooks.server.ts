import type { HandleFetch } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export const handleFetch: HandleFetch = async ({ event, request, fetch }) => {
  if (request.url.startsWith(env.VITE_API_URL)) {
    request.headers.set('cookie', event.request.headers.get('cookie') || '');
  }
  return fetch(request);
};
