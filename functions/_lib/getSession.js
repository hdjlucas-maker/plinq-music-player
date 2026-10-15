import { verifySessionToken } from "./auth.js";

export async function getUserFromRequest(request, env) {
  const authorization = request.headers.get("Authorization") || "";
  const bearer = authorization.match(/^Bearer\s+(.+)$/i);
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/plinq_session=([^;]+)/);
  const token = bearer?.[1] || match?.[1];
  if (!token) return null;

  const payload = await verifySessionToken(token, env.AUTH_SECRET);
  if (!payload) return null;

  return { id: payload.sub, email: payload.email };
}
