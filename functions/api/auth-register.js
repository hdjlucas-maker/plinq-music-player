import { hashPassword, createSessionToken } from "../_lib/auth.js";
import { isValidCPF, hashCPF, legacyHashCPF } from "../_lib/cpf.js";
import { normalizeEmail } from "../_lib/access.js";
import { isNativeAppRequest } from "../_lib/native.js";

export async function onRequestPost({ request, env }) {
  try {
    const { name, email, password, cpf } = await request.json();

    if (!name || !email || !password || !cpf) {
      return json({ error: "Preencha nome, e-mail, senha e CPF." }, 400);
    }
    if (String(name).trim().length < 2 || String(name).length > 120) {
      return json({ error: "Informe um nome entre 2 e 120 caracteres." }, 400);
    }
    if (String(email).length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
      return json({ error: "E-mail inválido." }, 400);
    }
    if (password.length < 8) {
      return json({ error: "A senha precisa ter pelo menos 8 caracteres." }, 400);
    }
    // Limite alto evita usar a rota como estimulador de CPU no PBKDF2.
    if (password.length > 200) {
      return json({ error: "A senha pode ter no máximo 200 caracteres." }, 400);
    }
    if (!isValidCPF(cpf)) {
      return json({ error: "CPF inválido. Confira os números digitados." }, 400);
    }

    const emailNorm = normalizeEmail(email);
    if (env.PLINQ_OWNER_EMAIL && emailNorm === normalizeEmail(env.PLINQ_OWNER_EMAIL)) {
      return json({ error: "Este e-mail está reservado para a conta do proprietário." }, 409);
    }

    const cpfHash = await hashCPF(cpf, env.CPF_PEPPER);
    const legacyCpfHash = await legacyHashCPF(cpf);

    const existingEmail = await env.PLINQ_BINDING.prepare("SELECT id FROM users WHERE email = ?")
      .bind(emailNorm)
      .first();
    if (existingEmail) {
      return json({ error: "Já existe uma conta com esse e-mail." }, 409);
    }

    // Compara nas duas formas de hash: contas antigas usam sal fixo, novas usam pepper.
    const existingCpf = await env.PLINQ_BINDING.prepare(
      "SELECT id FROM users WHERE cpf_hash = ? OR cpf_hash = ?"
    ).bind(cpfHash, legacyCpfHash).first();
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
      ).bind(id, String(name).trim().slice(0, 120), emailNorm, passwordHash, cpfHash).run();
    } catch (dbErr) {
      // Trava de segurança extra: se por alguma corrida (2 cadastros no mesmo milissegundo)
      // o índice único do banco rejeitar, devolve a mesma mensagem amigável.
      if (String(dbErr.message).includes('UNIQUE')) {
        return json({ error: "Este CPF ou e-mail já possui uma conta." }, 409);
      }
      throw dbErr;
    }

    const token = await createSessionToken({ sub: id, email: emailNorm }, env.AUTH_SECRET);
    const user = { id, name: String(name).trim().slice(0, 120), email: emailNorm };
    if (isNativeAppRequest(request)) user.sessionToken = token;

    return new Response(JSON.stringify(user), {
      status: 201,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "Set-Cookie": `plinq_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 30}`,
      },
    });
  } catch (err) {
    console.error("auth-register:", err);
    // Mensagem genérica: nunca expor detalhes internos do erro ao cliente.
    return json({ error: "Erro ao criar conta. Tente novamente." }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
