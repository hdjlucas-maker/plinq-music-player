import { getUserFromRequest } from "../_lib/getSession.js";
import { isOwner } from "../_lib/access.js";

// Plano único do Plinq: R$ 9,90 por 30 dias.
const PLANS = {
  monthly: { price: 990, description: 'Plinq Premium - 30 dias de acesso' }, // em centavos
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const session = await getUserFromRequest(request, env);
    if (!session) return jsonResponse({ error: 'Faça login para continuar.' }, 401);
    if (isOwner(session, env)) return jsonResponse({ error: 'A conta do proprietário não precisa de assinatura.' }, 403);

    const body = await request.json().catch(() => ({}));
    const { userId, plan = 'monthly' } = body;

    if (!userId || typeof userId !== 'string') {
      return jsonResponse({ error: 'userId é obrigatório' }, 400);
    }
    if (userId !== session.id) {
      return jsonResponse({ error: 'A conta da sessão não corresponde ao pedido.' }, 403);
    }

    if (!PLANS[plan]) {
      return jsonResponse({ error: 'plan inválido.' }, 400);
    }

    const handle = env.INFINITEPAY_HANDLE;
    if (!handle) {
      return jsonResponse({ error: 'INFINITEPAY_HANDLE não configurado no servidor' }, 500);
    }

    const baseUrl = env.APP_BASE_URL || '';
    if (!baseUrl) {
      return jsonResponse({ error: 'APP_BASE_URL não configurado no servidor' }, 500);
    }
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
      console.error("create-checkout (InfinitePay):", checkoutRes.status, errText.slice(0, 500));
      return jsonResponse({ error: 'Não foi possível iniciar o pagamento agora. Tente novamente em instantes.' }, 502);
    }

    const data = await checkoutRes.json().catch(() => ({}));

    if (!data.url) {
      console.error("create-checkout: InfinitePay não retornou URL de checkout");
      return jsonResponse({ error: 'Não foi possível iniciar o pagamento agora. Tente novamente em instantes.' }, 502);
    }

    return jsonResponse({ checkoutUrl: data.url, orderNsu });
  } catch (err) {
    console.error("create-checkout:", err);
    // Mensagem genérica: nunca expor detalhes internos do erro ao cliente.
    return jsonResponse({ error: 'Erro ao iniciar o pagamento. Tente novamente.' }, 500);
  }
}
