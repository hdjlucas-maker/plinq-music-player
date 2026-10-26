// Validação e hash de CPF — usado pra impedir que a mesma pessoa
// crie várias contas e ganhe vários períodos de teste grátis.

// Valida o CPF pelo algoritmo oficial de dígitos verificadores (mesma regra da Receita Federal).
export function isValidCPF(cpf) {
  const digits = (cpf || '').replace(/\D/g, '');
  if (digits.length !== 11) return false;

  // Rejeita sequências repetidas (111.111.111-11 etc.), que passam no cálculo mas não são CPFs reais
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const calcCheckDigit = (base) => {
    let sum = 0;
    let weight = base.length + 1;
    for (const d of base) {
      sum += parseInt(d, 10) * weight;
      weight--;
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const base9 = digits.slice(0, 9);
  const digit1 = calcCheckDigit(base9);
  const digit2 = calcCheckDigit(base9 + digit1);

  return digits === base9 + String(digit1) + String(digit2);
}

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Forma antiga: SHA-256 com sal fixo. Mantida para validar contas já existentes.
// NÃO alterar — mudaria o valor e faria CPFs antigos deixarem de ser reconhecidos,
// permitindo um segundo cadastro de trial para a mesma pessoa.
export async function legacyHashCPF(cpf) {
  const digits = (cpf || '').replace(/\D/g, '');
  const data = new TextEncoder().encode('plinq_cpf_salt_v1:' + digits);
  return toHex(await crypto.subtle.digest('SHA-256', data));
}

// Forma atual: HMAC-SHA256 com a pimenta CPF_PEPPER (só no servidor).
// Sem pepper, cai para a forma antiga para manter compatibilidade.
export async function hashCPF(cpf, pepper) {
  const digits = (cpf || '').replace(/\D/g, '');
  if (!pepper) return legacyHashCPF(cpf);

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(digits));
  return "hmac:" + toHex(signature);
}
