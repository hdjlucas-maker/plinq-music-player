// Helpers de senha (PBKDF2) e sessão (JWT simples com HMAC-SHA256).
// Usa só Web Crypto — funciona no runtime do Cloudflare Pages Functions
// (não dá pra usar bcrypt/jsonwebtoken do Node aqui).

const encoder = new TextEncoder();

export async function hashPassword(password, saltHex) {
  const salt = saltHex ? hexToBytes(saltHex) : crypto.getRandomValues(new Uint8Array(16));

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    256
  );

  return `${bytesToHex(salt)}:${bytesToHex(new Uint8Array(derivedBits))}`;
}

export async function verifyPassword(password, stored) {
  const [saltHex, hashHex] = stored.split(":");
  const recomputed = await hashPassword(password, saltHex);
  return timingSafeEqual(recomputed.split(":")[1], hashHex);
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

// --- Sessão (JWT simplificado) ---

export async function createSessionToken(payload, secret, expiresInSeconds = 60 * 60 * 24 * 30) {
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
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, bodyB64, sigB64] = parts;

  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const expectedSig = await crypto.subtle.sign("HMAC", key, encoder.encode(`${headerB64}.${bodyB64}`));
  if (base64url(new Uint8Array(expectedSig)) !== sigB64) return null;

  const payload = JSON.parse(decodeURIComponent(escape(atob(bodyB64.replace(/-/g, "+").replace(/_/g, "/")))));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

  return payload;
}

function base64url(input) {
  const str = typeof input === "string"
    ? btoa(unescape(encodeURIComponent(input)))
    : btoa(String.fromCharCode(...input));
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
