import { getUserFromRequest } from "../_lib/getSession.js";
import { isOwner } from "../_lib/access.js";

const TRIAL_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function onRequestGet({ request, env }) {
  try {
    const session = await getUserFromRequest(request, env);
    if (!session) {
      return json({ error: "Não autenticado" }, 401);
    }

    if (isOwner(session, env)) {
      return json({
        status: "active",
        isOwner: true,
        trialStart: null,
        currentPeriodEnd: null,
        daysLeft: null,
      });
    }

    if (!env.SUBSCRIPTIONS) {
      return json({ error: "Serviço indisponível no momento." }, 503);
    }

    const kvKey = `sub:${session.id}`;
    let record = await env.SUBSCRIPTIONS.get(kvKey, { type: "json" });

    const now = Date.now();

    if (!record) {
      // Primeira vez que este usuário consulta o status: inicia o trial de 30 dias agora.
      record = {
        userId: session.id,
        trialStart: now,
        status: "trial",
        currentPeriodEnd: now + TRIAL_DAYS * DAY_MS,
      };
      await env.SUBSCRIPTIONS.put(kvKey, JSON.stringify(record));
    }

    let status = record.status;
    const expired = record.currentPeriodEnd && now > record.currentPeriodEnd;

    if (expired && status !== "active") status = "expired";
    if (expired && status === "active") status = "expired"; // assinatura também vence, exige renovação

    return json({
      status,
      trialStart: record.trialStart || null,
      currentPeriodEnd: record.currentPeriodEnd || null,
      daysLeft: record.currentPeriodEnd
        ? Math.max(0, Math.ceil((record.currentPeriodEnd - now) / DAY_MS))
        : null,
    });
  } catch (err) {
    console.error("subscription-status:", err);
    // Mensagem genérica: nunca expor detalhes internos do erro ao cliente.
    return json({ error: "Não foi possível verificar seu acesso agora." }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
