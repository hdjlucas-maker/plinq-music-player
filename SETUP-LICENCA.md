# Setup do Sistema Premium (Cloudflare Pages)

Passo a passo pra deixar o backend de licença/assinatura funcionando de verdade.
Sem isso, o botão "Criar conta"/"Assinar" da aba Descobrir não vai funcionar.

## 1. Instalar o Wrangler (se ainda não tiver)
```
npm install -g wrangler
wrangler login
```

## 2. Migrar o site pra Cloudflare Pages

Se o Plinq hoje está só no GitHub Pages, crie o projeto Pages apontando pro mesmo repositório GitHub:

```
wrangler pages project create plinq-music-player
```

Ou pelo painel: dashboard.cloudflare.com → Workers & Pages → Create → Pages → Connect to Git →
selecione `hdjlucas-maker/plinq-music-player`. Build command: (vazio, é site estático).
Output directory: `/` (raiz).

## 3. Criar o banco D1

```
wrangler d1 create plinq-db
```

Isso imprime um `database_id`. Copie e cole em `wrangler.jsonc`, no lugar de
`COLE_AQUI_O_ID_DO_D1_DEPOIS_DE_CRIAR`.

Depois rode o schema:
```
wrangler d1 execute plinq-db --remote --file=./db/schema.sql
```

## 4. Criar o KV de assinaturas

```
wrangler kv namespace create SUBSCRIPTIONS
```

Copie o `id` retornado e cole em `wrangler.jsonc`, no lugar de
`COLE_AQUI_O_ID_DO_KV_DEPOIS_DE_CRIAR`.

## 5. Configurar as variáveis de ambiente (Secrets)

**Nunca** coloque essas variáveis direto no código. No painel do Cloudflare Pages:
Settings → Environment variables → Production (e repita em Preview se quiser testar):

| Variável | Valor |
|---|---|
| `AUTH_SECRET` | uma string aleatória longa (ex: gere com `openssl rand -hex 32`) |
| `INFINITEPAY_HANDLE` | `servicoslucas` |
| `APP_BASE_URL` | a URL final do seu site (ex: `https://plinq-music-player.pages.dev` ou seu domínio próprio) |

Ou via linha de comando:
```
wrangler pages secret put AUTH_SECRET --project-name plinq-music-player
wrangler pages secret put INFINITEPAY_HANDLE --project-name plinq-music-player
wrangler pages secret put APP_BASE_URL --project-name plinq-music-player
```

## 6. Deploy

```
git push
```
(o Cloudflare Pages já faz deploy automático a cada push, se conectado via Git —
não precisa rodar `wrangler pages deploy` manualmente depois do passo 2).

## 7. Testar

1. Abra o site publicado, vá na aba **Descobrir**.
2. Clique em "Criar conta / Entrar", crie uma conta de teste com um CPF válido.
3. Confirme que aparece o banner "Teste grátis: 30 dia(s) restante(s)".
4. Clique num gênero, confirme que as faixas da Jamendo tocam.
5. Pra testar o pagamento, clique em "Assinar" e complete um pagamento de teste
   na InfinitePay (ou aguarde os 30 dias / ajuste manualmente o KV pra simular expiração).

## Notas
- O `client_secret` da Jamendo **não é usado em lugar nenhum** — só o `client_id`
  (que é público por design da própria API da Jamendo).
- CPF é armazenado só como hash SHA-256 (nunca em texto puro), só pra impedir
  múltiplos cadastros de teste grátis pela mesma pessoa.
- Se o webhook da InfinitePay não chegar (ex: rede instável), a assinatura fica
  presa em "trial expirado" até o próximo pagamento confirmado — vale monitorar
  os logs em Cloudflare Pages → Functions → Real-time Logs se algo não bater.
