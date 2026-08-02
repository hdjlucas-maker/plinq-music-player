import { getUserFromRequest } from "../_lib/getSession.js";

const TRIAL_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function onRequestGet({ request, env }) {
  const session = await getUserFromRequest(request, env);
  if (!session) {
    return json({ error: "Não autenticado" }, 401);
  }

  if (!env.SUBSCRIPTIONS) {
    return json({ error: "KV SUBSCRIPTIONS não configurado" }, 500);
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
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}
