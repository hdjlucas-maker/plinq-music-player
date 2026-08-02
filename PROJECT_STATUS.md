# PROJECT_STATUS.md

Última atualização: 2026-08-02

## Sprints concluídas

Sprint 5 — Cloudflare / D1 / KV / InfinitePay / Trial
- [x] Deploy em Cloudflare Pages (`plinq-music-player.pages.dev`), sem build step
- [x] D1 (`plinq-db`) com tabela `users` (id, name, email, password_hash, cpf_hash, created_at)
- [x] Binding D1 ativo: `PLINQ_BINDING` → `plinq-db`
- [x] KV configurado para assinatura/trial: binding `SUBSCRIPTIONS` → namespace `SUBSCRIPTIONS` (padrão `sub:{userId}`, nunca no D1)
- [x] Variáveis de ambiente ativas: `INFINITEPAY_HANDLE` (plaintext, `servicoslucas`), `APP_BASE_URL` (plaintext, `https://plinq-music-player.pages.dev`), `AUTH_SECRET` (secret, assinatura do JWT)
- [x] Fluxo de cadastro/login com nome, e-mail, senha, CPF
- [x] Trial (banner exibido após cadastro, agora mostrando preço junto — ver CHANGELOG)
- [x] Integração de pagamento via InfinitePay

Sprint 6 — Biblioteca Jamendo
- [x] Aba "Descobrir" com músicas via API Jamendo

## Sprint em andamento

Sprint 1 — Persistência, remoção de músicas, playlists, correções gerais
- [x] **Persistência real (FSA API + IndexedDB + Media Session) — CONFIRMADA E TESTADA em produção pelo usuário**
- [ ] Remoção de músicas da playlist
- [ ] Playlists (múltiplas)
- [ ] Correções gerais pendentes de identificação

Sprint 2 — Gapless, Crossfade, Sleep Timer, Equalizador, Media Session (Media Session já entra via persistence.js)
Sprint 3 — Playlists múltiplas, Favoritos, Histórico, Busca, Importação, Exportação
Sprint 4 — PWA, Manifest, Service Worker, Offline
Sprint 7 — Otimização, Performance, Testes, Polimento final

## Ajustes menores concluídos (fora de sprint)

- [x] Textos de trial/preço no `premium.js` atualizados e no ar (commit `3f4e572`):
  - `discover-locked-text` (sem conta) menciona benefício antes do preço
  - `discover-locked-text` (trial expirado) reforça o preço
  - Banner de trial agora mostra "R$ 9,90/mês" junto com os dias restantes

## Ajustes menores em andamento (fora de sprint)

- [~] Layout responsivo real (celular / tablet / desktop) — **código pronto, push e teste ainda não confirmados pelo usuário**
  - Novo wrapper `player-main` envolvendo LCD + controles + volume + extras
  - Breakpoints: tablet (700px+), desktop (1000px+, 2 colunas), telas largas (1400px+)
  - Playlist do celular com altura relativa à viewport (~45%) em vez de 320px fixo
  - `index.html` e `style.css` alterados; `script.js` não foi tocado
  - Falta: usuário substituir os 2 arquivos, dar `git push`, e testar
  - Ver NEXT_TASK.md

## Pendência crítica (bloqueia considerar Sprint 5/6 "feitas" com confiança total)

Teste de ponta a ponta em produção nunca foi confirmado:
criar conta → tocar faixa Jamendo → pagamento de teste via InfinitePay.
Ver BUGS.md.
