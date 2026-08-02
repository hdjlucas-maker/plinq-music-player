# BUGS.md

## Abertos

1. **Teste de ponta a ponta nunca confirmado**
   Fluxo criar conta → tocar faixa Jamendo → pagamento teste InfinitePay nunca
   foi validado manualmente em produção. Prioridade: alta, antes de expor a
   cliente real.

2. **Layout responsivo (desktop 2 colunas) não confirmado em produção**
   Código entregue (`index.html` com wrapper `player-main` + `style.css` com
   breakpoints tablet/desktop/telas largas), mas ainda não há confirmação de
   que o usuário substituiu os arquivos, deu push, e testou nos 3 tamanhos de
   tela. Não marcar como concluído até isso ser confirmado. Ver NEXT_TASK.md.

## Resolvidos

- Build falhando por pacote `cap` (dependência nativa/node-gyp, pcap.h ausente)
  → Resolvido removendo build step (Cloudflare serve estático direto, sem
  npm install).
- Deployments antigos aparentando estar "presos" no commit anterior
  → Não era bug real: lista mostrava histórico de deployments antigos, o
  deployment ativo em produção já refletia o commit mais recente.
- Persistência (FSA + IndexedDB + Media Session) não confirmada em produção
  → Resolvido: usuário aplicou os patches, deu push, e confirmou os 5 testes
  passando (retomar posição exata, Media Session no lock screen, fallback sem
  FSA em navegador sem suporte).
- Nome do binding KV desconhecido
  → Resolvido: confirmado no Cloudflare Dashboard. Binding `SUBSCRIPTIONS`
  (KV namespace `SUBSCRIPTIONS`).
- Terceira variável de ambiente não identificada
  → Resolvido: confirmado no Cloudflare Dashboard. É `AUTH_SECRET` (tipo
  Secret, valor criptografado) — usada para assinar/verificar o JWT de auth.
