import { checkRateLimit } from "../_lib/rateLimit.js";

const SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;
const RATE = { name: "youtube-search", limit: 15, windowSec: 3600 };

export async function onRequestGet({ request, env }) {
  const query = new URL(request.url).searchParams.get("q")?.trim() || "";
  if (query.length < 2 || query.length > 100) {
    return json({ error: "Digite uma busca entre 2 e 100 caracteres." }, 400);
  }
  if (!env.YOUTUBE_API_KEY) {
    return json({ error: "A busca online ainda não foi configurada." }, 503);
  }

  const rate = await checkRateLimit(request, env, RATE);
  if (!rate.ok) {
    return json(
      { error: "Muitas buscas. Aguarde um pouco e tente novamente." },
      429,
      { "Retry-After": String(rate.retryAfter) }
    );
  }

  const upstreamUrl = new URL(SEARCH_URL);
  upstreamUrl.search = new URLSearchParams({
    key: env.YOUTUBE_API_KEY,
    part: "snippet",
    q: query,
    type: "video",
    maxResults: "8",
    safeSearch: "moderate",
    videoEmbeddable: "true",
    videoSyndicated: "true",
  }).toString();

  let upstream;
  try {
    upstream = await fetch(upstreamUrl, { signal: AbortSignal.timeout(8000) });
  } catch (error) {
    console.error("youtube-search: falha ao consultar YouTube Data API:", error?.name || "unknown error");
    return json({ error: "Não foi possível consultar o YouTube agora." }, 502);
  }

  let payload;
  try {
    payload = await upstream.json();
  } catch (error) {
    console.error("youtube-search: resposta inválida do YouTube Data API:", error);
    return json({ error: "O YouTube retornou uma resposta inválida." }, 502);
  }

  if (!upstream.ok) {
    const reason = payload?.error?.errors?.[0]?.reason;
    if (reason === "quotaExceeded" || reason === "dailyLimitExceeded") {
      return json({ error: "A cota diária de buscas acabou. Tente novamente amanhã." }, 429);
    }
    console.error("youtube-search: YouTube Data API recusou a busca:", upstream.status, reason || "unknown");
    return json({ error: "A busca no YouTube está temporariamente indisponível." }, 502);
  }

  const items = Array.isArray(payload.items)
    ? payload.items.flatMap((item) => {
      const id = item?.id?.videoId;
      const snippet = item?.snippet;
      if (!VIDEO_ID_PATTERN.test(id || "") || !snippet) return [];
      const thumbnail = snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || "";
      return [{
        id,
        title: String(snippet.title || "").slice(0, 300),
        channel: String(snippet.channelTitle || "").slice(0, 200),
        thumbnail: isYouTubeThumbnail(thumbnail) ? thumbnail : "",
      }];
    })
    : [];

  return json({ items });
}

function isYouTubeThumbnail(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "i.ytimg.com";
  } catch {
    return false;
  }
}

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}
