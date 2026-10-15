export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function isOwner(session, env) {
  const configuredEmail = normalizeEmail(env.PLINQ_OWNER_EMAIL);
  return !!configuredEmail && normalizeEmail(session?.email) === configuredEmail;
}
