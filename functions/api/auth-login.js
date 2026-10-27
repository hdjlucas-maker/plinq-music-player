import { verifyPassword, createSessionToken, timingSafeEqual, hashPasswordV2 } from "../_lib/auth.js";
import { normalizeEmail } from "../_lib/access.js";
import { checkRateLimit } from "../_lib/rateLimit.js";

// 20 tentativas por 5 min por IP: bloqueia força bruta e credential stuffing
// sem derrubar quem está atrás de CGNAT (muitos assinantes no mesmo IP).
const RATE = { name: "login", limit: 20, windowSec: 300 };

export async function onRequestPost({ request, env }) {
  try {
    const rate = await checkRateLimit(request, env, RATE);
    if (!rate.ok) {
      return json({ error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
        429, { "Retry-After": String(rate.retryAfter) });
    }

    const { email, password } = await request.json();
    if (!email || !password) return json({ error: "Preencha e-mail e senha." }, 400);
    // Limite alto evita usar a rota como estimulador de CPU no PBKDF2.
    if (password.length > 200) return json({ error: "Senha inválida." }, 400);

    const emailNorm = normalizeEmail(email);

    // Dono configurado no servidor: credenciais não ficam no código nem no banco.
    if (env.PLINQ_OWNER_EMAIL && env.PLINQ_OWNER_PASSWORD
      && emailNorm === normalizeEmail(env.PLINQ_OWNER_EMAIL)
      && timingSafeEqual(password, env.PLINQ_OWNER_PASSWORD)) {
      const token = await createSessionToken({ sub: "plinq-owner", email: emailNorm }, env.AUTH_SECRET);
      const user = { id: "plinq-owner", name: "Proprietário", email: emailNorm, isOwner: true };
      return new Response(JSON.stringify(user), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          "Set-Cookie": `plinq_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 30}`,
        },
      });
    }

    const user = await env.PLINQ_BINDING.prepare(
      "SELECT id, name, email, password_hash FROM users WHERE email = ?"
    ).bind(emailNorm).first();

    if (!user) {
      // Gasta o mesmo custo do PBKDF2 de um cadastro novo para não revelar,
      // pela velocidade da resposta, quais e-mails existem.
      await hashPasswordV2(password).catch(() => {});
      return json({ error: "E-mail ou senha inválidos." }, 401);
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) return json({ error: "E-mail ou senha inválidos." }, 401);

    // Re-hasheia silenciosamente quem ainda está no formato antigo (100k iterações).
    // Além de reforçar a conta, iguala o custo de leitura ao caminho de
    // "usuário inexistente" e vai fechando o vazamento por tempo de resposta
    // conforme as contas antigas fizerem login. Falha aqui não pode barrar o login.
    if (isLegacyHash(user.password_hash)) {
      try {
        const upgraded = await hashPasswordV2(password);
        await env.PLINQ_BINDING.prepare("UPDATE users SET password_hash = ? WHERE id = ?")
          .bind(upgraded, user.id)
          .run();
      } catch (upgradeErr) {
        console.error("auth-login (upgrade hash):", upgradeErr);
      }
    }

    const token = await createSessionToken({ sub: user.id, email: user.email }, env.AUTH_SECRET);
    const responseUser = { id: user.id, name: user.name, email: user.email };

    return new Response(JSON.stringify(responseUser), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "Set-Cookie": `plinq_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 30}`,
      },
    });
  } catch (err) {
    console.error("auth-login:", err);
    // Mensagem genérica: nunca expor detalhes internos do erro ao cliente.
    return json({ error: "Erro ao entrar. Tente novamente." }, 500);
  }
}

// Formato legado é "salt:hash" (sem custo explícito). O novo começa com "p2$".
function isLegacyHash(stored) {
  return typeof stored === "string" && stored.includes(":") && !stored.startsWith("p2$");
}

function json(obj, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...extraHeaders },
  });
}
