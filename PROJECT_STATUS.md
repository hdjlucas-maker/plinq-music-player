# PROJECT_STATUS.md

Última atualização: 2026-08-02

## Sprints concluídas

Sprint 5 — Cloudflare / D1 / KV / InfinitePay / Trial
- [x] Deploy em Cloudflare Pages (`plinq-music-player.pages.dev`), sem build step
- [x] D1 (`plinq-db`) com tabela `users` (id, name, email, password_hash, cpf_hash, created_at)
- [x] Binding D1 ativo: `PLINQ_BINDING` → `plinq-db`
- [x] KV configurado para assinatura/trial (padrão `sub:{userId}`, nunca no D1)
- [x] Variáveis de ambiente ativas: `INFINITEPAY_HANDLE`, `APP_BASE_URL` (+ 1 outra, nome a confirmar)
- [x] Fluxo de cadastro/login com nome, e-mail, senha, CPF
- [x] Trial (banner exibido após cadastro, agora mostrando preço junto — ver CHANGELOG)
- [x] Integração de pagamento via InfinitePay

Sprint 6 — Biblioteca Jamendo
- [x] Aba "Descobrir" com músicas via API Jamendo

## Sprint em andamento

Sprint 1 — Persistência, remoção de músicas, playlists, correções gerais
- [~] Persistência real (FSA API + IndexedDB + Media Session) — **código pronto, aplicação/push/teste ainda não confirmados pelo usuário**
  - `persistence.js` criado (arquivo novo, isolado)
  - `PATCH_SCRIPT_JS.md` criado com 4 patches pontuais em `script.js` (usa o bridge `window.PlinqPlayer`, nada reescrito)
  - 1 linha adicionada em `index.html` (`<script src="persistence.js" defer>`)
  - Falta: usuário aplicar os patches localmente, dar `git push`, e testar (fechar aba tocando → reabrir → retomar; Media Session no lock screen)
  - Ver NEXT_TASK.md
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
  - Novo wrapper `player-main` envolvendo LCD + controles + volume + extras (permite 2 colunas no desktop sem reescrever nada)
  - Breakpoints adicionados: tablet (700px+, card 620px, gêneros 3 colunas) e desktop (1000px+, layout 2 colunas: player fixo à esquerda, playlist à direita) e telas largas (1400px+)
  - Playlist do celular passou de altura fixa (320px) para altura relativa à viewport (até 45%); no desktop chega a 64% da altura da tela
  - `index.html` e `style.css` alterados; `script.js` não foi tocado
  - Falta: usuário substituir os 2 arquivos, dar `git push`, e testar redimensionando a janela (ou DevTools) nos 3 tamanhos
  - Ver NEXT_TASK.md

## Pendência crítica (bloqueia considerar Sprint 5/6 "feitas" com confiança total)

Teste de ponta a ponta em produção nunca foi confirmado:
criar conta → tocar faixa Jamendo → pagamento de teste via InfinitePay.
Ver BUGS.md.
