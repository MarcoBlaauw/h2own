import type { HandleFetch } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";

export const handleFetch: HandleFetch = async ({ event, request, fetch }) => {
  const apiBase = env.VITE_API_URL;
  if (apiBase && request.url.startsWith(apiBase)) {
    request.headers.set("cookie", event.request.headers.get("cookie") || "");
  }
  return fetch(request);
};
