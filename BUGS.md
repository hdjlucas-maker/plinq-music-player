# BUGS.md

## Abertos

1. O fluxo de pagamento ainda precisa de uma compra real para confirmar o ciclo
   InfinitePay → webhook → liberação do acesso.
2. Reprodução e cadastro precisam de validação no APK em aparelho Android real.
3. Não há redefinição de senha. Senhas existentes são armazenadas como hash e
   não podem ser recuperadas; a exportação local ajuda só em acessos futuros.
4. O APK atualizado ainda não foi compilado; este ambiente não tem Android SDK 36.

## Resolvidos

- Build falhando por pacote `cap`.
- Deployments antigos parecendo travados (falso positivo).
- Persistência → testada e OK.
- Binding KV → `SUBSCRIPTIONS`.
- 3ª env var → `AUTH_SECRET`.
- Layout responsivo → testado e OK.
- Remoção de músicas da playlist → OK.
- Playlists múltiplas → OK.
- Acesso da conta do proprietário sem trial/assinatura preparado por Secrets.
- Exportação local opcional de credenciais disponível após autenticação/cadastro.
- As telas web atuais são sincronizadas para `www/` e os assets Android pelo
  comando `npm run android:sync`.
- GitHub `main` e Cloudflare Pages estão atualizados com as funções Android de
  cadastro, sessão Bearer, CORS e controle de acesso; a página publicada responde
  e exibe a autoria `devlucas`.
