import { getUserFromRequest } from "../_lib/getSession.js";
import { isOwner } from "../_lib/access.js";

export async function onRequestGet({ request, env }) {
  try {
    const session = await getUserFromRequest(request, env);
    if (!session) {
      return json({ user: null }, 200);
    }

    if (isOwner(session, env)) {
      return json({ user: { id: "plinq-owner", name: "Proprietário", email: session.email, isOwner: true } }, 200);
    }

    const row = await env.PLINQ_BINDING.prepare("SELECT id, name, email FROM users WHERE id = ?")
      .bind(session.id)
      .first();

    return json({ user: row || null }, 200);
  } catch (err) {
    console.error("auth-me:", err);
    // Mensagem genérica: nunca expor detalhes internos do erro ao cliente.
    return json({ error: "Não foi possível ler a sessão agora." }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
