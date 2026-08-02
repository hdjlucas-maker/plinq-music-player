import { hashPassword, createSessionToken } from "../_lib/auth.js";
import { isValidCPF, hashCPF } from "../_lib/cpf.js";

export async function onRequestPost({ request, env }) {
  try {
    const { name, email, password, cpf } = await request.json();

    if (!name || !email || !password || !cpf) {
      return json({ error: "Preencha nome, e-mail, senha e CPF." }, 400);
    }
    if (password.length < 6) {
      return json({ error: "A senha precisa ter pelo menos 6 caracteres." }, 400);
    }
    if (!isValidCPF(cpf)) {
      return json({ error: "CPF inválido. Confira os números digitados." }, 400);
    }

    const emailNorm = email.toLowerCase().trim();
    const cpfHash = await hashCPF(cpf);

    const existingEmail = await env.PLINQ_BINDING.prepare("SELECT id FROM users WHERE email = ?")
      .bind(emailNorm)
      .first();
    if (existingEmail) {
      return json({ error: "Já existe uma conta com esse e-mail." }, 409);
    }

    const existingCpf = await env.PLINQ_BINDING.prepare("SELECT id FROM users WHERE cpf_hash = ?")
      .bind(cpfHash)
      .first();
    if (existingCpf) {
      return json({
        error: "Este CPF já usou o período de teste gratuito antes. Se você já teve uma conta, faça login em vez de criar outra."
      }, 409);
    }

    const id = crypto.randomUUID();
    const passwordHash = await hashPassword(password);

    try {
      await env.PLINQ_BINDING.prepare(
        "INSERT INTO users (id, name, email, password_hash, cpf_hash) VALUES (?, ?, ?, ?, ?)"
      ).bind(id, name, emailNorm, passwordHash, cpfHash).run();
    } catch (dbErr) {
      // Trava de segurança extra: se por alguma corrida (2 cadastros no mesmo milissegundo)
      // o índice único do banco rejeitar, devolve a mesma mensagem amigável.
      if (String(dbErr.message).includes('UNIQUE')) {
        return json({ error: "Este CPF ou e-mail já possui uma conta." }, 409);
      }
      throw dbErr;
    }

    const token = await createSessionToken({ sub: id, email: emailNorm }, env.AUTH_SECRET);

    return new Response(JSON.stringify({ id, name, email: emailNorm }), {
      status: 201,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": `plinq_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 30}`,
      },
    });
  } catch (err) {
    return json({ error: "Erro ao criar conta: " + err.message }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}
