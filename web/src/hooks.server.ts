import type { HandleFetch } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";

const passthroughHeaders = [
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-real-ip",
  "cf-connecting-ip",
  "cf-ipcountry",
  "cf-ray",
];

export const handleFetch: HandleFetch = async ({ event, request, fetch }) => {
  const apiBase = env.VITE_API_URL;
  if (apiBase && request.url.startsWith(apiBase)) {
    request.headers.set("cookie", event.request.headers.get("cookie") || "");
    for (const headerName of passthroughHeaders) {
      const value = event.request.headers.get(headerName);
      if (value) {
        request.headers.set(headerName, value);
      }
    }
  }
  return fetch(request);
};
