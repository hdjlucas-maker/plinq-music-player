# Segurança do Plinq

Documento único de segurança: exposição atual, segredos, modelo de autenticação, headers e checklist de deploy. Atualizado em **2026-10-25**.

---

## 1. INCIDENTE CRÍTICO — servidor da Locaweb

O domínio principal está servindo a **raiz do repositório** como se fosse a pasta pública. Auditoria confirmou **HTTP 200** para:

| Arquivo exposto | Risco |
|---|---|
| `/.git/*` (repo inteiro, inclusive histórico) | vazamento total do código e de arquivos já commitados |
| `/PLINQ_OWNER_CREDENTIALS.txt` | login permanente do proprietário |
| `/PLINQ_ANDROID_SIGNING.txt` | senha do keystore de assinatura Android |
| `/android/keystore.properties` | caminho e senha do keystore |
| `/android/keystore/plinq-release.jks` | **chave de assinatura do APK** |
| `/functions/*` | lógica de autenticação, sessão e webhook |
| `/db/schema.sql` | estrutura do banco |
| `/wrangler.jsonc` | `database_id` do D1, `id` do KV, handle e base URL |

Os quatro arquivos sensíveis têm hash SHA-256 **idêntico** ao do repositório local.

### Ações obrigatórias (só o titular do painel da Locaweb pode executar)

1. **Mover a raiz do site** de `~/` para uma pasta pública que contenha **apenas** o asset final (`index.html`, `style.css`, `script.js`, `api-client.js`, `persistence.js`, `premium.js`, `favicon.svg`, `_headers`, `robots.txt`).
2. **Remover da raiz web** `.git`, `PLINQ_*`, `android/`, `functions/`, `db/`, `scripts/`, `wrangler.jsonc`, `package*.json`, `node_modules/`.
3. **Bloquear o acesso** a `.git` e `*.txt` na configuração do servidor (nginx `location ~ /\.git { deny all; }`).
4. **Configurar proxy same-origin** para a API, sem o qual o login e a aba online não funcionam no domínio principal:

   ```nginx
   location /api/ {
       proxy_pass         https://plinq-music-player.pages.dev;
       proxy_set_header   Host plinq-music-player.pages.dev;
       proxy_set_header   X-Real-IP $remote_addr;
       proxy_set_header   CF-Connecting-IP $remote_addr;
   }
   ```

5. O Plinq não distribui mais APK nem mantém projeto Android. A chave de assinatura exposta está aposentada e **não pode ser reutilizada**. Quem ainda tiver o APK antigo deve removê-lo.
6. **Rotacionar tudo** (item 2 abaixo).

> Esta etapa **não foi executável** neste ambiente: não há acesso à hospedagem nem ao DNS.

---

## 2. Segredos e rotação

Nunca escrever estes valores em código, README ou commit. Configurar no painel → *Settings → Variables and secrets → Secret*.

| Variável | Uso | Em caso de comprometimento |
|---|---|---|
| `AUTH_SECRET` | assina os tokens de sessão (HMAC-SHA256) | gerar novo (`openssl rand -hex 32`); invalida todas as sessões |
| `PLINQ_OWNER_EMAIL` / `PLINQ_OWNER_PASSWORD` | login permanente do proprietário | trocar a senha; nunca reutilizar a do arquivo exposto |
| `CPF_PEPPER` | pimenta no hash do CPF (HMAC) | gerar novo; hashes antigos continuam válidos |
| `INFINITEPAY_HANDLE` | identificador público da InfinitePay | se houver indício de uso indevido, revisar no painel InfinitePay |
| `APP_BASE_URL` | checkout + webhook | — |
| `PLINQ_OWNER_CREDENTIALS.txt` | arquivo local (ignorado pelo Git) | **apagar** após rotacionar |
| `PLINQ_ANDROID_SIGNING.txt`, `*.jks`, `keystore.properties` | assinatura do antigo APK (aposentada) | nunca reutilizar; remover cópias expostas quando seguro |

Recomendação: tratar qualquer arquivo já exposto como **permanentemente comprometido**. Rotação, não limpeza.

---

## 3. Modelo de autenticação

- **Senha**: PBKDF2-SHA256, 100.000 iterações, salt aleatório de 16 bytes por usuário, resultado `salt:hash` em hex. Nunca há texto puro no banco; **não é possível recuperar a senha** — só redefinição, que ainda não existe.
- **Sessão**: JWT (header.payload.assinatura) assinado com HMAC-SHA256 via `AUTH_SECRET`, validade de 30 dias. Entregue como cookie `HttpOnly; Secure; SameSite=Lax` no PWA.
- **Cookie leitura**: `plinq_session`; verificação em `functions/_lib/getSession.js`.
- **CPF**: usado apenas para impedir vários trials. Guardado como hash — sem pepper em instalações antigas, com **HMAC-SHA256 + `CPF_PEPPER`** nas contas novas. Nunca em texto puro.
- **CORS**: lista explícita de origens web em `functions/_middleware.js`. Nada de `*` nem origens de apps nativos.
- **Proprietário**: identificado por Secrets; a comparação é feita em tempo constante e a conta nunca é criada pelo fluxo público de cadastro.
- **Pagamento**: o webhook **não confia no payload**. Ele revalida com `payment_check` da InfinitePay, confere o valor exato do plano (990 centavos) e recusa transação duplicada.

### Limitações assumidas

- Sem recuperação de senha (não há provedor de e-mail integrado).
- Sem e-mail de verificação.
- Sem revogação total de sessão no servidor (o token é autocontido; revogação exige store de sessões no D1).
- A contenção do servidor Locaweb **exige acesso ao painel** — ver seção 1.

---

## 4. Headers de segurança

Definidos em **`_headers`** (Cloudflare Pages):

```
Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none';
  frame-ancestors 'none'; form-action 'self'; script-src 'self';
  style-src 'self' 'unsafe-inline'; img-src 'self' data:;
  media-src 'self' blob:; connect-src 'self';
  font-src 'self'; frame-src 'none'; upgrade-insecure-requests
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
```

`script-src 'self'` sem `'unsafe-inline'` é possível porque o `index.html` não tem scripts inline.

Para o servidor da Locaweb estes headers **não se aplicam** — precisa ser configurado lá.

---

## 5. O que nunca publicar

`_headers` está inútil se os arquivos subirem junto. Por isso existe **`.assetsignore`**, que impede o Cloudflare Pages de servir:

```
.git  .github  .gitignore  *.md  android  www  db  scripts  functions
node_modules  package.json  package-lock.json  wrangler.jsonc
capacitor.config.json
PLINQ_OWNER_CREDENTIALS.txt  PLINQ_ANDROID_SIGNING.txt
*.jks  *.keystore  .env  .env.*
```

Confirme após cada deploy: `https://<dominio>/.git/` e `https://<dominio>/PLINQ_OWNER_CREDENTIALS.txt` devem responder **404**.

---

## 6. Checklist de deploy seguro

- [ ] Raiz web contém apenas os assets finais
- [ ] `.git` e arquivos `PLINQ_*` fora da raiz web e fora de qualquer branch
- [ ] APK antigo aposentado e nenhuma chave de assinatura exposta reutilizada
- [ ] `AUTH_SECRET` rotacionado
- [ ] `PLINQ_OWNER_PASSWORD` rotacionado
- [ ] `CPF_PEPPER` definido
- [ ] Proxy `/api/` same-origin funcionando no domínio principal
- [ ] `.git/` e `PLINQ_*.txt` respondendo 404
- [ ] `npm test` verde
- [ ] Teste manual: player local abre e toca **sem** login
- [ ] Teste manual: aba “Ouvir Online” exige conta e o cadastro funciona
- [ ] `npm audit` sem vulnerabilidades críticas
