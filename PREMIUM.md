# Acesso e assinatura

- Toda conta pública recebe um teste de 30 dias na primeira utilização do app.
- Depois do teste, cada pagamento de R$ 9,90 libera mais 30 dias de acesso.
  A integração atual não faz cobrança automática recorrente.
- O proprietário recebe acesso permanente por credenciais configuradas somente
  como Secrets no Cloudflare Pages (`PLINQ_OWNER_EMAIL` e
  `PLINQ_OWNER_PASSWORD`). Nunca grave esses valores em código publicado.
- O arquivo local `PLINQ_OWNER_CREDENTIALS.txt` é ignorado pelo Git e contém
  as credenciais de proprietário geradas para esta instalação. Ele está em
  texto legível; mantenha-o privado.
- O checkout usa a API oficial da InfinitePay. O webhook confirma a transação
  com `payment_check` antes de ativar 30 dias de assinatura.
- O mesmo backend é usado pelo site e pelo Android. O APK consulta as Pages
  Functions usando sessão Bearer, pois não depende dos cookies do navegador.
- A aplicação publicada foi conferida: a página mostra `Criado por devlucas` e
  `/api/auth-me` aceita CORS da origem Android.

## Estado e pendências

`PLINQ_OWNER_EMAIL` e `PLINQ_OWNER_PASSWORD` estão configurados como Secrets no
Cloudflare Pages. Os commits do app e backend estão em GitHub `main`.

Falta compilar o APK release (Android SDK 36 ausente neste ambiente), testar num
aparelho real e confirmar uma compra real InfinitePay. A integração não faz
cobrança automática recorrente.
