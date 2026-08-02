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

// Gera um hash determinístico do CPF (SHA-256) — permite checar duplicidade
// sem guardar o número em texto puro no banco (mais seguro e mais alinhado com a LGPD).
export async function hashCPF(cpf) {
  const digits = (cpf || '').replace(/\D/g, '');
  const encoder = new TextEncoder();
  const data = encoder.encode('plinq_cpf_salt_v1:' + digits); // "sal" fixo só pra não bater com hash genérico de CPF
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
