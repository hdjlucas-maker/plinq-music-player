// Limitação de tentativas de login/cadastro por IP.
//
// Usa o MESMO KV de assinaturas com prefixo "rl:" de propósito: criar um
// namespace novo exigiria trocar wrangler.jsonc + provisionar o namespace,
// o que trava o deploy. Nada aqui muda a chave "sub:{userId}".
//
// LIMITES DESTE CONTROLE (dito para não vender como garantia):
// - KV é globalmente e eventualmente consistente: sob rajadas concorrentes a
//   contagem pode subir menos que o ideal. É uma barreira, não um cofre.
// - Falha aberta de propósito: se o KV estiver indisponível, o login não pode
//   deixar de funcionar. Um ataque falharia no mesmo caminho de sempre
//   (senha/cadastro inválidos).
// - Limite por IP. Operadoras brasileiras usam CGNAT e colocam muitos
//   assinantes no mesmo IP, por isso as janelas são generosas.

export function clientIp(request) {
  const forwarded = request.headers.get("X-Forwarded-For") || "";
  const first = forwarded.split(",")[0].trim();
  return (request.headers.get("CF-Connecting-IP") || first || "").trim();
}

/**
 * @param {Request} request
 * @param {object} env
 * @param {{name: string, limit: number, windowSec: number}} opts
 * @returns {Promise<{ok: boolean, retryAfter: number}>}
 */
export async function checkRateLimit(request, env, { name, limit, windowSec }) {
  const kv = env && env.SUBSCRIPTIONS;
  if (!kv) {
    console.warn(`rate-limit (${name}): KV indisponivel, seguindo sem limite`);
    return { ok: true, retryAfter: 0 };
  }

  const ip = clientIp(request);
  if (!ip) return { ok: true, retryAfter: 0 };

  // TTL mínimo do KV é 60s — janelas menores seriam ignoradas silenciosamente.
  const ttl = Math.max(60, windowSec);
  const key = `rl:${name}:${ip}`;

  try {
    const now = Date.now();
    const stored = await kv.get(key, { type: "json" });
    let record = stored && typeof stored === "object" ? stored : null;

    if (!record || typeof record.count !== "number" || typeof record.resetAt !== "number"
      || record.resetAt <= now) {
      record = { count: 0, resetAt: now + ttl * 1000 };
    }

    record.count += 1;
    await kv.put(key, JSON.stringify(record), { expirationTtl: ttl });

    if (record.count > limit) {
      const retryAfter = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
      return { ok: false, retryAfter };
    }

    return { ok: true, retryAfter: 0 };
  } catch (err) {
    console.error(`rate-limit (${name}):`, err);
    return { ok: true, retryAfter: 0 };
  }
}
