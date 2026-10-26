import { verifyPassword, createSessionToken, timingSafeEqual, hashPassword } from "../_lib/auth.js";
import { normalizeEmail } from "../_lib/access.js";
import { isNativeAppRequest } from "../_lib/native.js";

export async function onRequestPost({ request, env }) {
  try {
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
      if (isNativeAppRequest(request)) user.sessionToken = token;
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
      // Gasta o mesmo tempo do PBKDF2 de um login válido para não revelar,
      // pela velocidade da resposta, quais e-mails existem.
      await hashPassword(password).catch(() => {});
      return json({ error: "E-mail ou senha inválidos." }, 401);
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) return json({ error: "E-mail ou senha inválidos." }, 401);

    const token = await createSessionToken({ sub: user.id, email: user.email }, env.AUTH_SECRET);
    const responseUser = { id: user.id, name: user.name, email: user.email };
    if (isNativeAppRequest(request)) responseUser.sessionToken = token;

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

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
