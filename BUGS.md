# BUGS.md

## Abertos

1. **Teste de ponta a ponta nunca confirmado**
   Fluxo criar conta → tocar faixa Jamendo → pagamento teste InfinitePay nunca
   foi validado manualmente em produção. Prioridade: alta, antes de expor a
   cliente real.

2. **Nome do binding KV desconhecido**
   `PROJECT_STATUS.md` marca KV como configurado, mas o nome exato do binding
   (equivalente ao `PLINQ_BINDING` do D1) não está documentado. Confirmar em
   Cloudflare → Workers & Pages → plinq-music-player → Settings → Bindings.

3. **Terceira variável de ambiente não identificada**
   Sabe-se que existem 3 variáveis ativas: `INFINITEPAY_HANDLE`, `APP_BASE_URL`
   e uma terceira ainda não nomeada neste arquivo. Confirmar e documentar.

## Resolvidos

- Build falhando por pacote `cap` (dependência nativa/node-gyp, pcap.h ausente)
  → Resolvido removendo build step (Cloudflare serve estático direto, sem
  npm install).
- Deployments antigos aparentando estar "presos" no commit anterior
  → Não era bug real: lista mostrava histórico de deployments antigos, o
  deployment ativo em produção já refletia o commit mais recente.
