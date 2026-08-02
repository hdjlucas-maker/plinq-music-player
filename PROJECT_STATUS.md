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
- [x] Trial (banner exibido após cadastro)
- [x] Integração de pagamento via InfinitePay

Sprint 6 — Biblioteca Jamendo
- [x] Aba "Descobrir" com músicas via API Jamendo

## Sprints não iniciadas

Sprint 1 — Persistência, remoção de músicas, playlists, correções gerais
- [ ] Persistência real (FSA API + IndexedDB) — EM ANDAMENTO, ver NEXT_TASK.md
- [ ] Remoção de músicas da playlist
- [ ] Playlists (múltiplas)
- [ ] Correções gerais pendentes de identificação

Sprint 2 — Gapless, Crossfade, Sleep Timer, Equalizador, Media Session
Sprint 3 — Playlists múltiplas, Favoritos, Histórico, Busca, Importação, Exportação
Sprint 4 — PWA, Manifest, Service Worker, Offline
Sprint 7 — Otimização, Performance, Testes, Polimento final

## Pendência crítica (bloqueia considerar Sprint 5/6 "feitas" com confiança total)

Teste de ponta a ponta em produção nunca foi confirmado:
criar conta → tocar faixa Jamendo → pagamento de teste via InfinitePay.
Ver BUGS.md.
