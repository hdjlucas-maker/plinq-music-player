// Helpers de senha (PBKDF2) e sessão (JWT simples com HMAC-SHA256).
// Usa só Web Crypto — funciona no runtime do Cloudflare Pages Functions
// (não dá pra usar bcrypt/jsonwebtoken do Node aqui).

const encoder = new TextEncoder();

// PBKDF2-SHA256. As contas antigas usam 100.000 iterações e guardam "salt:hash";
// as novas usam a força recomendada e guardam "p2$iterações$salt$hash".
// O formato legado continua sendo aceito para leitura — trocá-lo invalidaria
// a senha de quem já tem conta.
export const LEGACY_ITERATIONS = 100000;
export const PBKDF2_ITERATIONS = 600000;
const MIN_ITERATIONS = 10000;
const MAX_ITERATIONS = 2000000;

// Formato antigo: "salt:hash" — usado só para derivar de um salt conhecido.
export async function hashPassword(password, saltHex, iterations = LEGACY_ITERATIONS) {
  const salt = saltHex ? hexToBytes(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const hashHex = await derive(password, salt, iterations);
  return `${bytesToHex(salt)}:${hashHex}`;
}

// Formato novo, com o custo registrado junto: impossível esquecer de aumentar.
export async function hashPasswordV2(password, iterations = PBKDF2_ITERATIONS) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hashHex = await derive(password, salt, iterations);
  return `p2$${iterations}$${bytesToHex(salt)}$${hashHex}`;
}

export async function verifyPassword(password, stored) {
  if (typeof stored !== "string" || !stored || typeof password !== "string") return false;

  let saltHex;
  let hashHex;
  let iterations;

  if (stored.startsWith("p2$")) {
    const parts = stored.split("$");
    if (parts.length !== 4) return false;
    iterations = parseInt(parts[1], 10);
    if (!Number.isFinite(iterations) || iterations < MIN_ITERATIONS || iterations > MAX_ITERATIONS) {
      return false;
    }
    saltHex = parts[2];
    hashHex = parts[3];
  } else {
    if (!stored.includes(":")) return false;
    [saltHex, hashHex] = stored.split(":");
    iterations = LEGACY_ITERATIONS;
  }

  if (!saltHex || !hashHex) return false;

  const recomputed = await derive(password, hexToBytes(saltHex), iterations);
  return timingSafeEqual(recomputed, hashHex);
}

async function derive(password, salt, iterations) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    256
  );

  return bytesToHex(new Uint8Array(derivedBits));
}

export { timingSafeEqual };

function hexToBytes(hex) {
  const clean = String(hex || "").replace(/[^0-9a-fA-F]/g, "");
  const bytes = new Uint8Array(Math.floor(clean.length / 2));
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
  return bytes;
}

function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Compara sempre percorrendo o maior dos dois tamanhos: um early-return por
// comprimento diferente mede o tamanho do segredo pelo tempo de resposta.
function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const len = Math.max(a.length, b.length);
  let result = a.length === b.length ? 0 : 1;
  for (let i = 0; i < len; i++) {
    const x = i < a.length ? a.charCodeAt(i) : 0;
    const y = i < b.length ? b.charCodeAt(i) : 0;
    result |= x ^ y;
  }
  return result === 0;
}

// --- Sessão (JWT simplificado) ---

export async function createSessionToken(payload, secret, expiresInSeconds = 60 * 60 * 24 * 30) {
  if (!secret || typeof secret !== "string") {
    throw new Error("AUTH_SECRET não configurado");
  }
  const header = { alg: "HS256", typ: "JWT" };
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + expiresInSeconds };

  const headerB64 = base64url(JSON.stringify(header));
  const bodyB64 = base64url(JSON.stringify(body));
  const toSign = `${headerB64}.${bodyB64}`;

  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(toSign));

  return `${toSign}.${base64url(new Uint8Array(signature))}`;
}

export async function verifySessionToken(token, secret) {
  // Sem segredo configurado, nenhuma sessão é válida — em vez de lançar erro.
  if (!secret || typeof secret !== "string") return null;

  const parts = String(token).split(".");
  if (parts.length !== 3) return null;
  const [headerB64, bodyB64, sigB64] = parts;

  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const expectedSig = await crypto.subtle.sign("HMAC", key, encoder.encode(`${headerB64}.${bodyB64}`));
  // Comparação em tempo constante: não pode ceder tempo de resposta ao atacante.
  if (!timingSafeEqual(base64url(new Uint8Array(expectedSig)), sigB64)) return null;

  let payload;
  try {
    payload = JSON.parse(decodeURIComponent(escape(atob(bodyB64.replace(/-/g, "+").replace(/_/g, "/")))));
  } catch {
    return null; // payload corrompido não pode derrubar a rota com 500
  }

  if (!payload || typeof payload !== "object") return null;
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
  if (!payload.sub) return null;

  return payload;
}

function base64url(input) {
  const str = typeof input === "string"
    ? btoa(unescape(encodeURIComponent(input)))
    : btoa(String.fromCharCode(...input));
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
