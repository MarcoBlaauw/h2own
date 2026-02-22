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
  const publicApiBase = (env.VITE_API_URL || "/api").replace(/\/$/, "");
  const internalApiBase = (env.INTERNAL_API_URL || "http://api:3001").replace(/\/$/, "");
  const requestUrl = new URL(request.url);
  const isApiRequest =
    publicApiBase.startsWith("/") &&
    (requestUrl.pathname === publicApiBase ||
      requestUrl.pathname.startsWith(`${publicApiBase}/`));

  if (isApiRequest) {
    const upstreamPath = requestUrl.pathname.slice(publicApiBase.length) || "/";
    const upstreamUrl = `${internalApiBase}${upstreamPath}${requestUrl.search}`;
    const headers = new Headers(request.headers);
    headers.set("cookie", event.request.headers.get("cookie") || "");
    for (const headerName of passthroughHeaders) {
      const value = event.request.headers.get(headerName);
      if (value) {
        headers.set(headerName, value);
      }
    }
    const body =
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : await request.arrayBuffer();

    return fetch(
      new Request(upstreamUrl, {
        method: request.method,
        headers,
        body,
        redirect: request.redirect,
      }),
    );
  }
  return fetch(request);
};
