# Estado Atual

Projeto: Plinq Music Player
Versão: 0.83
Última atualização: 2026-08-01

## Concluído
✔ Player funcional (play/pause/prev/next)
✔ Shuffle
✔ Repeat
✔ Visualizador (Web Audio API)
✔ Drag and Drop de arquivos/pastas (input file)
✔ Gapless real (preload silencioso do próximo arquivo antes do fim)
✔ Crossfade (0 / 3 / 6 / 10s, dois elementos <audio> + GainNode)
✔ Sleep Timer (15/30/45/60min ou "ao fim da música", com fade-out)

## Em andamento
- (nenhuma tarefa em andamento no momento)

## Não iniciado
- Persistência real (File System Access API + IndexedDB + botão "Continuar de onde parei")
- Media Session API (controles na tela de bloqueio)
- Fix do botão remover em mobile (opacity:0 hover-only) — **não confirmado como bug real na versão atual do CSS, precisa reverificar**
- Sistema Premium (trial 30 dias + R$9,99, Cloudflare Workers + D1 + KV, InfinitePay, padrão motor-ia)
- Biblioteca Jamendo / aba Descobrir
- Equalizador
- Playlists múltiplas, favoritos, histórico, busca
- PWA (manifest + service worker)

## Último arquivo editado
script.js, index.html, style.css

## Última função alterada
Motor de reprodução: loadTrack(), playAudio(), pauseAudio(), + novas: startCrossfade(), preloadGapless(), onEnded(), setSleepMinutes(), setSleepAtTrackEnd()

## Nota importante
Sessões anteriores descreveram várias implementações (persistência FSA/IndexedDB, Media Session,
sistema Premium completo, Jamendo) que nunca foram commitadas no repositório real — ficaram
apenas em pastas de output de outras conversas. Este arquivo reflete apenas o que está
efetivamente commitado no branch main.
