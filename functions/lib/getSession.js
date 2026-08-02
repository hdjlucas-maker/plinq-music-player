import { verifySessionToken } from "./auth.js";

export async function getUserFromRequest(request, env) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/plinq_session=([^;]+)/);
  if (!match) return null;

  const payload = await verifySessionToken(match[1], env.AUTH_SECRET);
  if (!payload) return null;

  return { id: payload.sub, email: payload.email };
}
