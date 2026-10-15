# PROJECT_STATUS.md

Última atualização: 2026-10-15

## Concluído

Sprint 5 — Cloudflare/D1/KV/InfinitePay/Trial
Sprint 6 — Jamendo
Persistência (FSA + IndexedDB + Media Session)
Layout responsivo (celular/tablet/desktop)
Remoção de músicas da playlist (selecionar e remover)
Playlists múltiplas (criar/renomear/apagar/trocar)
Player local e online submetidos ao trial/assinatura; layout responsivo para celular na versão web

## Sprint 1 — pendente

- [ ] Correções gerais pendentes de identificação

## Pendência crítica

Gerar e instalar o APK release e concluir uma compra real InfinitePay para validar
o fluxo até a liberação da assinatura — ver BUGS.md.

## Celular

- Usuários precisam de conta: 30 dias de trial para o app inteiro, depois
  assinatura mensal de R$ 9,90.
- Acesso permanente do proprietário preparado por credenciais secretas.
- Site web e backend estão publicados no Cloudflare Pages; o HTML de produção
  exibe `Criado por devlucas` e a API permite CORS para o WebView Android.
- Cadastro, login por token de sessão, verificação de trial/assinatura e checkout
  InfinitePay estão conectados na interface Android sincronizada em `www/`.
- APK release ainda não foi compilado porque o ambiente não dispõe do Android SDK 36.
- A chave de assinatura Android nova está guardada localmente e ignorada pelo Git;
  usuários do APK antigo precisarão removê-lo antes de instalar o novo.
- O login permite exportar os dados de acesso em arquivo local, sob escolha
  explícita; recuperação de senha de uma conta antiga ainda não existe.
- Secrets do proprietário estão configurados no Cloudflare Pages.
