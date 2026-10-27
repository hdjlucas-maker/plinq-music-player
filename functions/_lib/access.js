import { timingSafeEqual } from "./auth.js";

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

// Comparação em tempo constante: sem ela, um atacante medindo a duração da
// resposta podia descobrir a e-mail do dono caractere a caractere.
export function isOwner(session, env) {
  const configuredEmail = normalizeEmail(env?.PLINQ_OWNER_EMAIL);
  if (!configuredEmail) return false;
  const given = normalizeEmail(session?.email);
  if (!given) return false;
  return timingSafeEqual(given, configuredEmail);
}
