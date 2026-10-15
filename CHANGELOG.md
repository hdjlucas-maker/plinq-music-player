# Changelog

## GitHub e Cloudflare Pages sincronizados (2026-10-15)
- `main` e `origin/main` confirmados no commit `3b2ed75`.
- Confirmados no site publicado o nome `devlucas` e o endpoint de sessão com
  CORS para o WebView Android.
- Fonte Android e backend estão publicados; APK assinado ainda aguarda SDK 36,
  e o fluxo de InfinitePay ainda aguarda compra real de confirmação.

## Não lançado — Acesso ao player local no celular (2026-10-15)
- Removido da página principal o bloqueio global que exigia login antes de
  usar o player local; cadastro/assinatura continuam sendo exigidos pela aba
  da biblioteca online conforme o estado Premium.
- Ajustado o início da reprodução para ativar o Web Audio no clique e manter
  uma rota de áudio direta caso a configuração de efeitos falhe.
- A mesma correção de reprodução foi aplicada ao player legado de `www/`.
- Adicionada opção para baixar um arquivo local com e-mail e senha após login
  ou cadastro, somente quando a pessoa marca a opção.
- Não publicado nem validado em aparelho físico.

## Web e integração Android — Trial, acesso do proprietário e pagamentos (2026-10-15)
- O trial de 30 dias será consultado ao abrir o app e bloqueia todas as áreas
  após expirar, até uma assinatura ativa.
- Adicionado login permanente do proprietário via Secrets `PLINQ_OWNER_EMAIL`
  e `PLINQ_OWNER_PASSWORD`; credenciais locais foram geradas em arquivo
  ignorado pelo Git.
- Checkout exige sessão da própria conta e não pode ser iniciado para outra
  conta nem para o proprietário.
- Webhook confere o valor pago, evita aplicar duas vezes a mesma transação e
  acrescenta os 30 dias à validade existente.
- Publicado em GitHub `main` e no Cloudflare Pages. O fluxo de pagamento ainda
  aguarda validação com compra real; o APK release aguarda compilação com SDK 36.

## Integração Android e autoria (2026-10-15)
- Sincronizados para o APK o cadastro, login com sessão persistida, trial global,
  bloqueio por expiração e checkout InfinitePay da versão web.
- Adicionado CORS restrito às origens do app e suporte a sessão Bearer nas APIs.
- Atualizado o nome do desenvolvedor para `devlucas` na interface.
- Alterações publicadas em GitHub `main`; a página e a API do Cloudflare foram
  consultadas depois do deploy. APK release ainda depende de Android SDK 36.

## Não lançado — Layout responsivo (desktop/tablet/celular)
- Envolve LCD + controles + volume + extras num wrapper `player-main` em
  `index.html`, permitindo alternar pra 2 colunas no desktop sem reescrever
  nada existente
- Novos breakpoints em `style.css`:
  - Celular (até 699px): playlist com altura relativa à viewport (~45%) em
    vez de 320px fixo
  - Tablet (700px+): card 620px, gêneros do "Ouvir Online" em 3 colunas
  - Desktop (1000px+): 2 colunas — player fixo à esquerda, playlist até 64%
    da altura da tela à direita, gêneros em 4 colunas
  - Telas largas (1400px+): card mais largo, sem esticar demais
- `script.js` não foi alterado
- **Status:** código pronto, aguardando substituição dos arquivos, push e
  teste em produção

## Sprint 1 (parcial) — Persistência — CONFIRMADO E TESTADO
- Cria `persistence.js`: FSA API (guarda handle da pasta/arquivos) + IndexedDB
  (faixas, playlist atual, posição, volume, shuffle/repeat) + banner
  "Continuar de onde parei"
- Adiciona Media Session API (play/pause/next/previous no lock screen/notificação,
  com metadata de título/artista/capa)
- 4 patches pontuais em `script.js` expondo hooks via `window.PlinqPlayer`
- 1 linha adicionada em `index.html`
- **Status:** testado em produção pelo usuário — retomar posição exata funciona,
  Media Session funciona no lock screen, fallback sem FSA funciona

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
