import { verifyPassword, createSessionToken } from "../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) return json({ error: "Preencha e-mail e senha." }, 400);

    const emailNorm = email.toLowerCase().trim();

    const user = await env.PLINQ_BINDING.prepare(
      "SELECT id, name, email, password_hash FROM users WHERE email = ?"
    ).bind(emailNorm).first();

    if (!user) return json({ error: "E-mail ou senha inválidos." }, 401);

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) return json({ error: "E-mail ou senha inválidos." }, 401);

    const token = await createSessionToken({ sub: user.id, email: user.email }, env.AUTH_SECRET);

    return new Response(JSON.stringify({ id: user.id, name: user.name, email: user.email }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": `plinq_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 30}`,
      },
    });
  } catch (err) {
    return json({ error: "Erro ao entrar: " + err.message }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}
