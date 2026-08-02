const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Plano único do Plinq: R$ 9,90/mês (ver DECISIONS.md).
const PLANS = {
  monthly: { price: 990, description: 'Plinq Premium - Assinatura Mensal' }, // em centavos
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 200, headers: CORS_HEADERS });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json().catch(() => ({}));
    const { userId, plan = 'monthly' } = body;

    if (!userId || typeof userId !== 'string') {
      return jsonResponse({ error: 'userId é obrigatório' }, 400);
    }

    if (!PLANS[plan]) {
      return jsonResponse({ error: 'plan inválido.' }, 400);
    }

    const handle = env.INFINITEPAY_HANDLE;
    if (!handle) {
      return jsonResponse({ error: 'INFINITEPAY_HANDLE não configurado no servidor' }, 500);
    }

    const baseUrl = env.APP_BASE_URL || '';
    const { price, description } = PLANS[plan];

    // Codifica userId e plano no order_nsu para recuperá-los no webhook,
    // sem precisar de uma tabela extra de "pedidos pendentes".
    const orderNsu = `${userId}__${plan}__${Date.now()}`;

    const checkoutRes = await fetch('https://api.checkout.infinitepay.io/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        handle,
        redirect_url: `${baseUrl}/?paid=1`,
        webhook_url: `${baseUrl}/api/payment-webhook`,
        order_nsu: orderNsu,
        items: [{ quantity: 1, price, description }],
      }),
    });

    if (!checkoutRes.ok) {
      const errText = await checkoutRes.text().catch(() => '');
      return jsonResponse({ error: 'Falha ao criar checkout na InfinitePay', details: errText }, 502);
    }

    const data = await checkoutRes.json();

    if (!data.url) {
      return jsonResponse({ error: 'InfinitePay não retornou uma URL de checkout' }, 502);
    }

    return jsonResponse({ checkoutUrl: data.url, orderNsu });
  } catch (err) {
    return jsonResponse({ error: 'Erro ao criar checkout', details: String(err) }, 500);
  }
}
