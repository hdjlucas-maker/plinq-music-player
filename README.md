# Plinq 🎵

**Plinq**, criado por **devlucas**, é um player de música web com versão Android em preparação — simples, leve e sem distrações, inspirado na simplicidade dos players clássicos, mas com visual moderno.

O app inclui cadastro e login, 30 dias de teste grátis e, depois, acesso por R$ 9,90 a cada 30 dias via InfinitePay. A conta do proprietário tem acesso permanente. O pagamento não é renovado automaticamente.

---

## ✨ Funcionalidades

- ▶️ Player completo: play, pause, próxima, anterior
- 🔀 Modo aleatório e repetição
- 📂 Adicione músicas individuais **ou pastas inteiras** de uma vez
- 🎧 Suporte aos formatos mais comuns: MP3, FLAC, WAV, M4A, AAC, OGG, OPUS
- 📃 Criação automática de playlist com nome e duração das faixas
- 🎚️ Controle de volume e barra de progresso interativa
- 📊 Visualizador de áudio animado
- 👍 Botão de curtidas (contador público, sem login)
- 🔒 100% local — os arquivos de música nunca saem do seu dispositivo
- 👤 Cadastro e login disponíveis na web e no app Android
- ⏳ Trial de 30 dias, com bloqueio do player quando o acesso expira
- 💳 Pagamento de R$ 9,90 por 30 dias via InfinitePay
- 👑 Acesso permanente para a conta do proprietário

---

## 🖥️ Como usar

1. Acesse a versão web. O APK Android atualizado ainda aguarda compilação e distribuição.
2. Crie uma conta com e-mail, senha e CPF; o período grátis começa no primeiro acesso.
3. Toque em **"Adicionar músicas"** para escolher arquivos ou em **"Adicionar pasta"** para importar uma pasta inteira.
4. Após os 30 dias, pague R$ 9,90 via InfinitePay para liberar os próximos 30 dias.

> **Importante:** o player local toca arquivos que já estão no seu dispositivo. A biblioteca online usa faixas da Jamendo. O período de teste e a assinatura são controlados pela conta Plinq.

---

## 🚀

Acesse: https://plinq-music-player.pages.dev

---

## 🛠️ Tecnologias

- HTML5
- CSS3
- JavaScript (vanilla, sem frameworks ou dependências externas)
- Cloudflare Pages Functions, D1 e KV para contas e assinaturas
- InfinitePay para checkout e confirmação de pagamento
- Capacitor para empacotar a experiência web como app Android
- [Web Audio API](https://developer.mozilla.org/pt-BR/docs/Web/API/Web_Audio_API) para o visualizador
- [CountAPI](https://countapi.xyz) para o contador de curtidas

---

## 📁 Estrutura do projeto

```
plinq-music-player/
├── index.html, style.css, script.js → interface web e player
├── functions/                       → login, trial, checkout e webhook
├── www/                             → cópia preparada para o app Android
├── android/                         → projeto nativo Capacitor/Gradle
└── scripts/sync-android-web.js      → sincroniza web → Android
```

Depois de alterar os arquivos da aplicação web, rode `npm run android:sync`.
Esse comando atualiza `www/` e os assets usados pelo app Android antes do commit.

---

## 🗺️ Roadmap

- [ ] Gerar e distribuir o APK assinado (requer Android SDK 36)
- [ ] Validar o APK em aparelho físico e concluir uma compra real de ponta a ponta
- [ ] Recuperação segura de senha por e-mail
- [ ] Equalizador de áudio
- [ ] Leitura automática da biblioteca de música do dispositivo

---

## 📄 Licença
Todos os direitos reservados. Este código está disponível apenas para visualização — uso, cópia, modificação ou redistribuição não são permitidos sem autorização do autor.


