# Plinq

**Plinq** é um player de música local-first — leve, sem anúncios e sem distrações — com uma biblioteca online opcional. Criado por **devlucas**.

## Modelo de acesso

- **Player local é gratuito e não exige conta.** O usuário escolhe arquivos ou pastas do próprio dispositivo e tudo toca offline. Nenhum arquivo de áudio sai do aparelho.
- **A conta (`Entrar / Criar conta`) é usada apenas na aba “Ouvir Online”.**
  A busca online **não tem fonte atual**: a integração com a Jamendo foi
  removida e a aba mostra um estado vazio até uma nova fonte ser escolhida
  (ver “Pendências”). O player local continua completo e gratuito.
- Quem usa o teste/trial: **30 dias grátis** a partir do primeiro acesso, depois **R$ 9,90 por 30 dias** via InfinitePay. Não há cobrança automática recorrente.
- A conta do **proprietário** tem acesso permanente, por Secrets configurados no Cloudflare Pages.

> Este modelo é a fonte de verdade. Qualquer código que tente bloquear o player local contradiz este documento.

## Funcionalidades

- Play, pause, próxima, anterior, aleatório, repetição
- Adição de músicas individuais ou pastas inteiras (com `webkitdirectory`)
- Formatos: MP3, FLAC, WAV, M4A, AAC, OGG, OPUS, WMA, AIFF, ALAC
- Playlist com nome e duração, seleção múltipla e remoção em lote
- **Gapless real** com dois elementos `<audio>` e pré-carregamento da próxima faixa
- **Crossfade** (Desligado / 3s / 6s / 10s) com Web Audio API
- **Sleep timer** (15/30/45/60 min ou “ao fim da música”)
- **Equalizador** de 5 bandas (60, 230, 910, 3.6k, 14k Hz), −12 a +12 dB
- Visualizador de áudio
- Controle de volume e barra de progresso acessível por teclado
- **Persistência local**: File System Access API + IndexedDB — guarda a pasta, posição de reprodução, volume, shuffle e repeat
- **Media Session API** — controles na notificação e tela de bloqueio
- Layout responsivo (celular / tablet / desktop com 2 colunas)
- Curtida local (estado salvo só no navegador, sem API de terceiros)

## Como usar

1. Abra o site e clique em **“Adicionar músicas”** ou **“Adicionar pasta”**.
2. Toque nas faixas da playlist. Pronto — funciona sem conta.
3. Para a biblioteca online, clique em **“Ouvir Online”** → **“Criar conta / Entrar”**.

Se o navegador suportar a File System Access API (Chrome/Edge), o banner **“Continuar de onde parei”** restaura a pasta e a posição ao reabrir. Sem esse suporte (Firefox, Safari), o botão de pasta mantém o comportamento padrão do `<input>`.

## Estrutura do projeto

```
plinq/
├── index.html            interface e layout
├── style.css             toda a visualização
├── script.js             motor do player (playlist, crossfade, EQ, sleep, Media Session)
├── api-client.js         camada de requisição (same-origin na web, Bearer no app)
├── persistence.js        FSA + IndexedDB (estado entre sessões)
├── premium.js            autenticação, aba “Ouvir Online”, trial e checkout
├── favicon.svg           ícone
├── _headers              headers de segurança (Cloudflare Pages)
├── .assetsignore         lista do que NUNCA publicar como asset
├── functions/            backend Cloudflare Pages Functions
│   ├── _middleware.js     CORS + headers das APIs
│   ├── api/               auth-login, auth-register, auth-me, auth-logout,
│   │                      subscription-status, create-checkout, payment-webhook
│   └── _lib/              auth (PBKDF2/JWT), access, cpf, getSession, native
├── db/schema.sql          schema D1 (usuários)
├── scripts/
│   ├── sync-android-web.js  web → www/ → assets Android
│   └── check-syntax.js      verificação de sintaxe (npm test)
├── www/                 cópia gerada para o app Android (não editar à mão)
├── android/             projeto nativo Capacitor/Gradle
└── wrangler.jsonc        configuração do Pages, D1 e KV
```

Após alterar arquivos web, rode `npm run android:sync`. Ele atualiza `www/` e os assets usados pelo APK **antes do commit**.

## Comandos

```bash
npm install          # dependências
npm test             # checagem de sintaxe (web + functions)
npm run android:sync # sincroniza web → www/ → Android
```

## Backend e deploy

- **Cloudflare Pages** serve o site e as Functions. Deploy automático a cada push em `main`.
- **D1** (`plinq-db`) guarda identidade e login. **KV** (`SUBSCRIPTIONS`) guarda trial/assinatura na chave `sub:{userId}`.
- A assinatura (trial, ativa, expirada) fica no **KV**, não no D1.
- `APP_BASE_URL` é usada no checkout e no webhook da InfinitePay.

Variáveis de ambiente (nunca coloque no código nem no Git):

`AUTH_SECRET`, `INFINITEPAY_HANDLE`, `APP_BASE_URL`, `PLINQ_OWNER_EMAIL`, `PLINQ_OWNER_PASSWORD`, `CPF_PEPPER`.

O passo a passo de segurança, a lista de segredos e o checklist de contenção de incidente estão em **[SECURITY.md](SECURITY.md)**.

## Pendências conhecidas

Nenhuma destas impede o uso do player local:

- **Exposição no servidor da Locaweb**: o domínio principal entrega `.git`, credenciais, keystore, `functions/`, `db/` e `wrangler.jsonc` com HTTP 200. Contenção exigida no painel da hospedagem — ver [SECURITY.md](SECURITY.md).
- O caminho `/api/*` no domínio principal responde 404; o proxy same-origin precisa ser configurado. A API funciona em `plinq-music-player.pages.dev`.
- Não existe recuperação de senha por e-mail (o backend guarda apenas hash; não há como recuperar).
- Não há e-mail de verificação no cadastro.
- O pagamento ainda não foi validado com uma compra real InfinitePay.
- O APK release não foi compilado neste ambiente (falta Android SDK 36).
- Não há testes automatizados além da checagem de sintaxe; não há lint nem CI.

## Stack

HTML5 · CSS3 · JavaScript vanilla (sem frameworks) · Web Audio API · Cloudflare Pages Functions + D1 + KV · InfinitePay · Capacitor (Android).

## Licença

Todos os direitos reservados. Uso, cópia, modificação ou redistribuição não são permitidos sem autorização do autor.
