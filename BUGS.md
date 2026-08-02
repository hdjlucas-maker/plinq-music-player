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

4. **Persistência (FSA + IndexedDB + Media Session) não confirmada em produção**
   Código entregue (`persistence.js` + `PATCH_SCRIPT_JS.md` + linha em
   `index.html`), mas ainda não há confirmação de que o usuário aplicou os
   patches, deu push, e testou (retomar faixa na posição exata, Media Session
   no lock screen, fallback sem FSA). Não marcar Sprint 1/persistência como
   concluída até isso ser confirmado. Ver NEXT_TASK.md.

5. **Layout responsivo (desktop 2 colunas) não confirmado em produção**
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
