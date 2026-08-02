# Changelog

## Não lançado — Sprint 1 (persistência)
- Cria `persistence.js`: FSA API (guarda handle da pasta/arquivos) + IndexedDB
  (faixas, playlist atual, posição, volume, shuffle/repeat) + banner
  "Continuar de onde parei"
- Adiciona Media Session API (play/pause/next/previous no lock screen/notificação,
  com metadata de título/artista/capa)
- 4 patches pontuais em `script.js` expondo hooks via `window.PlinqPlayer`
- 1 linha adicionada em `index.html`
- **Status:** código pronto, aguardando aplicação dos patches, push e teste em produção

## 0.84 - 2026-08-01
- Adiciona sistema Premium completo: auth (PBKDF2+JWT), CPF anti-fraude de trial,
  D1 + KV, InfinitePay (checkout + webhook), aba Descobrir com 12 gêneros via Jamendo
- Cria SETUP-LICENCA.md com passo a passo de infraestrutura Cloudflare

## 0.83 - 2026-08-01
- Adiciona Gapless real, Crossfade (Desligado/3s/6s/10s), Sleep Timer
- Corrige botão de remover faixa invisível/intocável em dispositivos touch (mobile)

## commit 3f4e572 - 2026-08-02
- Ajusta textos de trial/preço em `premium.js`:
  - `discover-locked-text` (sem conta): destaca benefício antes do preço
  - `discover-locked-text` (trial expirado): reforça preço de R$ 9,90/mês
  - Banner de trial mostra "R$ 9,90/mês" junto com os dias restantes
