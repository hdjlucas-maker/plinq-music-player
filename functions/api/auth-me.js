import { getUserFromRequest } from "../_lib/getSession.js";
import { isOwner } from "../_lib/access.js";

export async function onRequestGet({ request, env }) {
  const session = await getUserFromRequest(request, env);
  if (!session) {
    return new Response(JSON.stringify({ user: null }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (isOwner(session, env)) {
    return new Response(JSON.stringify({ user: { id: "plinq-owner", name: "Proprietário", email: session.email, isOwner: true } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const row = await env.PLINQ_BINDING.prepare("SELECT id, name, email FROM users WHERE id = ?")
    .bind(session.id)
    .first();

  return new Response(JSON.stringify({ user: row || null }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
