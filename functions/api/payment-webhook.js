const PLAN_DURATION_DAYS = {
  monthly: 30,
};
const DAY_MS = 24 * 60 * 60 * 1000;

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json().catch(() => ({}));
    const { invoice_slug, order_nsu, transaction_nsu, paid_amount, amount } = body;

    if (!order_nsu || !transaction_nsu) {
      return jsonResponse({ success: false, message: 'order_nsu ou transaction_nsu ausente' }, 400);
    }

    // order_nsu foi gerado no create-checkout como "{userId}__{plan}__{timestamp}"
    const parts = order_nsu.split('__');
    if (parts.length < 2) {
      return jsonResponse({ success: false, message: 'order_nsu em formato inesperado' }, 400);
    }
    const [userId, plan] = parts;

    if (!PLAN_DURATION_DAYS[plan]) {
      return jsonResponse({ success: false, message: 'Plano desconhecido no order_nsu' }, 400);
    }

    const handle = env.INFINITEPAY_HANDLE;

    // Segurança: não confia cegamente no payload do webhook.
    // Confirma diretamente com a InfinitePay que o pagamento foi realmente aprovado.
    const checkRes = await fetch('https://api.checkout.infinitepay.io/payment_check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        handle,
        order_nsu,
        transaction_nsu,
        slug: invoice_slug,
      }),
    });

    if (!checkRes.ok) {
      return jsonResponse({ success: false, message: 'Não foi possível confirmar o pagamento com a InfinitePay' }, 400);
    }

    const checkData = await checkRes.json().catch(() => ({}));

    if (!checkData.success || !checkData.paid) {
      return jsonResponse({ success: false, message: 'Pagamento não confirmado como pago' }, 400);
    }

    if (!env.SUBSCRIPTIONS) {
      return jsonResponse({ success: false, message: 'KV SUBSCRIPTIONS não configurado' }, 400);
    }

    const kvKey = `sub:${userId}`;
    const now = Date.now();
    const existing = (await env.SUBSCRIPTIONS.get(kvKey, { type: 'json' })) || {
      userId,
      trialStart: now,
    };

    const durationDays = PLAN_DURATION_DAYS[plan];
    const currentPeriodEnd = now + durationDays * DAY_MS;

    const updated = {
      ...existing,
      userId,
      plan,
      status: 'active',
      currentPeriodEnd,
      lastTransactionNsu: transaction_nsu,
      lastPaidAmount: paid_amount ?? amount ?? null,
      lastPaymentAt: now,
    };

    await env.SUBSCRIPTIONS.put(kvKey, JSON.stringify(updated));

    return jsonResponse({ success: true, message: null });
  } catch (err) {
    return jsonResponse({ success: false, message: `Erro no webhook: ${String(err)}` }, 400);
  }
}
