# Estado Atual

Projeto: Plinq Music Player
Versão: 0.84
Última atualização: 2026-08-01

## Concluído
✔ Player funcional (play/pause/prev/next), shuffle, repeat, visualizador
✔ Gapless real, Crossfade (0/3/6/10s), Sleep Timer
✔ Fix do botão remover em touch/mobile
✔ Sistema Premium completo (backend real, ver abaixo)
✔ Aba Descobrir com biblioteca Jamendo (12 gêneros)

## Sistema Premium (novo nesta sessão)
- Backend Cloudflare Pages Functions em functions/api/ e functions/_lib/
- Auth: PBKDF2 + sessão JWT/HMAC em cookie httpOnly (padrão copiado do motor-ia, só leitura)
- Banco: D1 (tabela users, com cpf_hash único pra impedir múltiplos trials)
- Assinatura: KV SUBSCRIPTIONS (trial 30 dias, depois R$9,90/mês)
- Pagamento: InfinitePay (handle: servicoslucas) — create-checkout + payment-webhook
  com confirmação via payment_check (não confia cegamente no payload do webhook)
- Frontend: premium.js (modal de login/registro com CPF, aba Descobrir, grid de 12
  gêneros, integração com Jamendo API usando client_id a20d899c)
- Client secret da Jamendo NÃO está em nenhum arquivo do frontend

## IMPORTANTE — requer setup manual antes de funcionar
Ver SETUP-LICENCA.md. Resumindo: precisa migrar hosting pra Cloudflare Pages,
criar banco D1 + KV namespace reais, e configurar 3 variáveis de ambiente
(AUTH_SECRET, INFINITEPAY_HANDLE, APP_BASE_URL) no painel do Cloudflare.
Sem isso os endpoints /api/* não existem (o site ainda está no GitHub Pages,
que não roda Functions).

## Não iniciado
- Persistência real (File System Access API + IndexedDB + "Continuar de onde parei")
- Media Session API (controles na tela de bloqueio)
- Equalizador
- Playlists múltiplas, favoritos, histórico, busca
- PWA (manifest + service worker)

## Último arquivo editado
premium.js, functions/**, db/schema.sql, wrangler.jsonc, index.html, style.css

## Nota importante
Sessões anteriores descreveram esse mesmo sistema Premium como "pronto" sem nunca
commitar nada no repositório real. Desta vez o código foi escrito, validado
(sintaxe de todos os arquivos JS checada, IDs HTML↔JS cruzados, divs balanceados)
e commitado localmente nesta sessão — falta o usuário rodar o setup de infraestrutura
real (D1/KV/Cloudflare Pages) e testar em produção, já que isso não pode ser
simulado neste ambiente sandbox.
