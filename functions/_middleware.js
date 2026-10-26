import { NATIVE_APP_ORIGINS } from "./_lib/native.js";

const WEB_APP_ORIGIN = "https://plinq-music-player.pages.dev";
const ALLOWED_ORIGINS = new Set([...NATIVE_APP_ORIGINS, WEB_APP_ORIGIN]);

export async function onRequest({ request, next }) {
  const origin = request.headers.get("Origin");
  const headers = new Headers();

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    headers.set("Access-Control-Max-Age", "86400");
    headers.append("Vary", "Origin");
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  const response = await next();
  const responseHeaders = new Headers(response.headers);

  // Respostas de API carregam dado de sessão/assinatura: nunca podem ser cacheadas
  // por proxy ou pelo navegador (nem servidas como HTML).
  responseHeaders.set("Cache-Control", "no-store");
  responseHeaders.set("X-Content-Type-Options", "nosniff");

  for (const [name, value] of headers) {
    if (name.toLowerCase() === "vary" && responseHeaders.has("Vary")) {
      responseHeaders.set("Vary", `${responseHeaders.get("Vary")}, ${value}`);
    } else {
      responseHeaders.set(name, value);
    }
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}
