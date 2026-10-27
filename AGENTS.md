# Plinq — contexto do projeto para agentes de IA

Atualizado em 27/10/2026. Este arquivo registra a direção do produto, o estado conhecido e a ordem recomendada de trabalho. Atualize-o quando uma decisão ou prioridade mudar; não use este arquivo como diário de cada alteração.

## Produto e decisões que não devem ser presumidas

- Plinq é um player **local-first**: tocar músicas escolhidas pelo usuário é grátis, funciona sem conta e não envia os arquivos de áudio ao servidor.
- A busca online usa YouTube Data API e reproduz exclusivamente no player oficial incorporado. Não baixar, extrair, converter ou hospedar áudio do YouTube.
- Player local e busca online são gratuitos e não exigem conta Plinq; a experiência de pagamento/trial foi removida.
- Checkout e webhook de pagamento não existem mais; não apresentar preço, assinatura ou cadastro ao usuário.
- A busca exige `YOUTUBE_API_KEY` configurada como Secret no Cloudflare Pages. Nunca colocar chave no Git, HTML ou respostas.
- O player do YouTube pode ou não reconhecer a conta Google do navegador conforme cookies e políticas do dispositivo; não solicitar nem receber senha Google.
- O produto é **PWA-only** (HTML, CSS e JavaScript vanilla, Cloudflare Pages Functions, D1/KV); não reintroduzir Capacitor ou APK sem uma decisão explícita do titular.
- A reprodução em segundo plano e controles de mídia são limitados pelo navegador e pelas políticas do sistema operacional; nunca prometer paridade ou continuidade em todas as plataformas.
- Privacidade e segurança são requisitos de produto, não tarefas opcionais de acabamento.

## Organização e fonte dos arquivos

- Os arquivos web editáveis ficam na raiz: `index.html`, `style.css`, `script.js`, `persistence.js` e `discover.js`.
- O PWA usa `manifest.webmanifest`, `service-worker.js` e `pwa.js`. O service worker não deve armazenar respostas de `/api/` nem conteúdo de áudio.
- `README.md` é a documentação para pessoas. `SECURITY.md` contém as medidas de contenção e rotação. Ambos são usados; não os remova como documentação obsoleta.

## Estado confirmado e ressalvas

- O player local possui playlist, reprodução, gapless, crossfade, EQ, timer, persistência local e integração de mídia no navegador.
- Testar instalação e reprodução minimizada nos navegadores/plataformas-alvo e documentar limitações observadas. O PWA não consegue impor execução em segundo plano quando o sistema suspende o navegador.
- O domínio principal e credenciais foram descritos como expostos em `SECURITY.md`. Essa situação requer confirmação externa e correção no painel de hospedagem; alterações locais não provam que o incidente foi contido. O Plinq não distribui APK; a antiga chave de assinatura exposta está aposentada e não deve ser reutilizada.
- A URL de repositório GitHub (`github.com/...`) não é o aplicativo. A interface PWA é publicada em `https://hdjlucas-maker.github.io/plinq-music-player/` e chama a API no Cloudflare Pages; essa origem precisa estar autorizada em CORS.
- A árvore de trabalho já continha alterações locais em autenticação, rate limit, persistência, testes e CSS antes desta tarefa. Preserve essas alterações; não faça reset, checkout ou limpeza ampla.
- Há testes de sintaxe, segurança, endpoint de busca simulado e smoke test. Ainda faltam CI e validação da busca com chave real/dispositivo.

## Próximos passos, em ordem

1. **Segurança e publicação:** confirmar a exposição documentada, mover a raiz pública para os assets finais, bloquear arquivos internos e rotacionar credenciais comprometidas. Ver checklist em `SECURITY.md`.
2. **PWA multiplataforma:** verificar instalação, shell offline, ausência de cache de API/áudio, aviso de atualização e comportamento em navegadores-alvo.
3. **Qualidade:** ampliar testes automatizados para playlist, áudio, persistência e falhas; executar `npm test` e `npm run smoke` quando Chrome estiver disponível.
4. **Busca online:** configurar e restringir `YOUTUBE_API_KEY` no Cloudflare; respeitar a cota, os Termos/Políticas do YouTube e manter o player oficial com controles e anúncios.

## Regras de trabalho para a IA

- Antes de editar, examine `git status` e leia os arquivos existentes; preserve trabalho local e nunca substitua arquivos gerados sem necessidade.
- Prefira mudanças pequenas, consistentes com os padrões atuais e cobertas por teste.
- Não afirme que reprodução em segundo plano, PWA, domínio ou busca externa foram validados sem executar os testes correspondentes no ambiente/dispositivo adequado.
- Não inclua segredos, dados de conta, chaves ou keystores em código, documentação pública ou respostas.
- Ao concluir uma tarefa, atualize este contexto apenas se o estado/prioridades duráveis tiverem mudado; atualize o `README.md` quando uma instrução de uso ou comportamento visível mudar.

## Comandos úteis

```bash
npm test
npm run smoke
```
