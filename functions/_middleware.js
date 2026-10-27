// Origens web legítimas do produto. Nada de origens nativas ou curingas.
const ALLOWED_ORIGINS = new Set([
  "https://plinq-music-player.pages.dev",
  "https://plinq.orderly.tec.br",
  "https://hdjlucas-maker.github.io",
]);

export async function onRequest({ request, next }) {
  const origin = request.headers.get("Origin");

  // Rejeição explícita para origem desconhecida. O navegador já bloquearia por
  // falta do header CORS, mas assim o motivo fica visível no log do cliente e
  // no servidor em vez de um silêncio impossível de diagnosticar.
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    console.warn(`middleware: origem recusada ${origin} em ${request.method} ${request.url}`);
    return new Response(JSON.stringify({ error: "Origem não permitida." }), {
      status: 403,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  const headers = new Headers({
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });

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
