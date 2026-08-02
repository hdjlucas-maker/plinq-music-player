-- Plinq — schema D1
-- Assinatura/trial NÃO fica aqui: fica no KV SUBSCRIPTIONS (chave sub:{userId}),
--  Este banco só guarda identidade/login.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  cpf_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_cpf_hash ON users(cpf_hash);
