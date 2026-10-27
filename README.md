# Plinq

**Plinq** é um player gratuito para músicas locais e vídeos reproduzidos pelo player oficial do YouTube. Criado por **devlucas**.

## Modelo de acesso

- **Player local gratuito e sem conta.** Arquivos escolhidos no dispositivo tocam no navegador; o Plinq não os envia ao servidor.
- **Busca online gratuita e sem conta Plinq.** A busca usa a YouTube Data API e os resultados tocam no player oficial incorporado do YouTube. O Plinq não baixa, converte ou hospeda áudio.
- A sessão Google existente pode ser reconhecida pelo player conforme navegador e cookies; o Plinq não recebe a senha Google.
- Não há cobrança ou plano pago disponível no produto neste momento.

> O Plinq não fornece licença musical própria. Vídeos, anúncios, disponibilidade e direitos são tratados pelo YouTube e pelos titulares; a reprodução segue as condições do YouTube.

## Funcionalidades

- Play, pause, próxima, anterior, aleatório, repetição
- Adição de músicas individuais ou pastas inteiras (com `webkitdirectory`)
- Formatos: MP3, FLAC, WAV, M4A, AAC, OGG, OPUS, WMA, AIFF, ALAC
- Os formatos efetivamente reproduzidos dependem do navegador/dispositivo e do codec do arquivo.
- Playlist com nome e duração, seleção múltipla e remoção em lote
- **Gapless real** com dois elementos `<audio>` e pré-carregamento da próxima faixa
- **Crossfade** (Desligado / 3s / 6s / 10s) com Web Audio API
- **Sleep timer** (15/30/45/60 min ou “ao fim da música”)
- **Equalizador** de 5 bandas (60, 230, 910, 3.6k, 14k Hz), −12 a +12 dB
- Visualizador de áudio
- Controle de volume e barra de progresso acessível por teclado
- **Persistência local**: File System Access API + IndexedDB — guarda a pasta, posição de reprodução, volume, shuffle e repeat
- **Media Session API** — controles na notificação e tela de bloqueio
- **PWA instalável** — shell offline, cache sem arquivos de áudio, botão de instalação e aviso para aplicar atualizações
- Layout responsivo (celular / tablet / desktop com 2 colunas)
- Curtida local (estado salvo só no navegador, sem API de terceiros)

## Como usar

1. Abra o site publicado e clique em **“Adicionar músicas”** ou **“Adicionar pasta”**. No celular, selecione várias faixas em “Adicionar músicas”; escolher pastas depende do navegador.
2. Toque nas faixas da playlist. Pronto — funciona sem conta.
3. Para buscar música online, abra **“Ouvir Online”**, pesquise e toque em **“Reproduzir”**. O conteúdo é exibido no player do YouTube, com seus controles e possíveis anúncios.
4. Para instalar, use **“Instalar app”** no topo. No iPhone/iPad, abra no Safari e use **Compartilhar → Adicionar à Tela de Início**.

> A URL do repositório no GitHub mostra o código-fonte, não é o aplicativo. Abra o site publicado em [plinq-music-player.pages.dev](https://plinq-music-player.pages.dev/). O PWA exige uma origem HTTPS.

Se o navegador suportar a File System Access API (Chrome/Edge), o banner **“Continuar de onde parei”** restaura a pasta e a posição ao reabrir. Sem esse suporte (Firefox, Safari), o botão de pasta mantém o comportamento padrão do `<input>`.

## Estrutura do projeto

```
plinq/
├── index.html            interface e layout
├── style.css             toda a visualização
├── script.js             motor do player (playlist, crossfade, EQ, sleep, Media Session)
├── persistence.js        FSA + IndexedDB (estado entre sessões)
├── discover.js           busca YouTube e player incorporado oficial
├── pwa.js                registro do service worker e aplicação segura de atualizações
├── service-worker.js     shell offline (não armazena API nem arquivos de áudio)
├── manifest.webmanifest  metadados de instalação PWA
├── pwa-icon.svg          ícone vetorial de instalação do PWA
├── privacy.html          aviso de privacidade da busca online
├── AGENTS.md             contexto atual, regras e próximos passos para agentes de IA
├── favicon.svg           ícone
├── _headers              headers de segurança (Cloudflare Pages)
├── .assetsignore         lista do que NUNCA publicar como asset
├── functions/            backend Cloudflare Pages Functions
│   ├── _middleware.js     CORS + headers das APIs
│   ├── api/               youtube-search e endpoints legados de conta
│   └── _lib/              auth (PBKDF2/JWT), access, cpf, getSession
├── db/schema.sql          schema D1 (usuários)
├── scripts/
│   ├── check-syntax.js      verificação de sintaxe (npm test)
│   └── smoke-test.js        teste do player e do PWA no Chrome
└── wrangler.jsonc        configuração do Pages, D1 e KV
```

O Plinq é distribuído como site/PWA, sem APK ou projeto Capacitor. Em navegador compatível, use “Instalar app”; atualizações ficam disponíveis pelo botão **Atualizar** do próprio Plinq para não interromper uma música em andamento. Reprodução minimizada e controles de mídia dependem do suporte e das políticas de cada navegador/sistema; não são garantidos igualmente em todos os dispositivos.

## Comandos

```bash
npm install          # dependências
npm test             # checagem de sintaxe (web + functions)
npm run smoke        # teste do player e PWA no Chrome
```

## Busca online e deploy

- O site publicado é servido pelo **Cloudflare Pages**. A URL do repositório GitHub não instala nem executa o aplicativo. O checkout e as telas de pagamento foram removidos; não há cobrança no Plinq.
- `/api/youtube-search` usa uma Cloudflare Pages Function para consultar a YouTube Data API sem expor a chave no navegador. O KV `SUBSCRIPTIONS` existente aplica limite de buscas por endereço IP.
- O Google oferece, por padrão, **100 chamadas de busca por dia** para `search.list`; essa cota é compartilhada pelo projeto Google. A disponibilidade pode parar quando a cota diária acabar.
- Para ativar a busca: crie um projeto no [Google Cloud Console](https://console.cloud.google.com/), habilite **YouTube Data API v3**, crie uma chave e restrinja-a à YouTube Data API v3. No Cloudflare Pages, adicione `YOUTUBE_API_KEY` como **Secret** em Settings → Variables and Secrets. Nunca coloque a chave no Git, no HTML ou em mensagens públicas.
- O player incorporado mostra o vídeo e os controles oficiais; não pode ser reduzido a um fluxo de áudio nem contornar anúncios, login ou restrições do YouTube. O compartilhamento da sessão Google depende dos cookies do navegador.
- O deploy só atualiza o domínio publicado se o repositório estiver conectado ao Cloudflare Pages e o deploy terminar com sucesso.

Segredo necessário para a busca online: `YOUTUBE_API_KEY` (não coloque no código nem no Git).

O contexto e os próximos passos de desenvolvimento estão em **[AGENTS.md](AGENTS.md)**. O passo a passo de segurança, a lista de segredos e o checklist de contenção de incidente estão em **[SECURITY.md](SECURITY.md)**.

## Pendências conhecidas

Estas ressalvas não impedem o uso do player local:

- **Exposição no servidor da Locaweb**: uma verificação anterior reportou `.git`, credenciais e arquivos internos acessíveis com HTTP 200. A situação atual precisa ser confirmada e contida no painel da hospedagem — ver [SECURITY.md](SECURITY.md). O projeto já não distribui APK; a antiga chave de assinatura exposta não deve ser reutilizada.
- A busca YouTube requer configurar `YOUTUBE_API_KEY` como Secret no Cloudflare Pages e publicar um novo deploy.
- A API do YouTube tem uma cota diária limitada; o catálogo e a conta Google não são controlados pelo Plinq.
- A reprodução em segundo plano depende do suporte do navegador e das políticas do sistema operacional.
- Os testes cobrem sintaxe, primitivos de segurança e smoke test do player/PWA; ainda faltam CI e testes completos de persistência.

## Stack

HTML5 · CSS3 · JavaScript vanilla (sem frameworks) · PWA · Web Audio API · YouTube Data API · Cloudflare Pages Functions + KV.

## Licença

Todos os direitos reservados. Uso, cópia, modificação ou redistribuição não são permitidos sem autorização do autor.
