# PERSISTENCE.md

## O que é

Persistência local-first do player: guarda a pasta de músicas e o estado de
reprodução no navegador, sem servidor, usando File System Access API (FSA) +
IndexedDB. Permite fechar a aba e continuar de onde parou.

## Arquivos envolvidos

- `persistence.js` — arquivo isolado, não modifica `script.js` diretamente
- `script.js` — expõe hooks em `window.PlinqPlayer` (`addFiles`, `getState`,
  `restoreState`) usados pelo `persistence.js`, além da Media Session API
  (`setupMediaSession`, `updateMediaSessionMetadata`, `updateMediaSessionPosition`)
- `index.html` — carrega `persistence.js` com `defer`, logo depois de `script.js`

## Como funciona

1. Usuário clica em "Adicionar pasta" (`#add-folder-btn`). Se o navegador
   suporta FSA, o `persistence.js` assume o clique, abre `showDirectoryPicker()`
   e salva o handle da pasta no IndexedDB (`rootHandle`).
2. A cada 5 segundos, e também no `beforeunload`, o estado de reprodução
   (faixa atual, posição, volume, shuffle, repeat) é salvo no IndexedDB
   (`playbackState`) via `window.PlinqPlayer.getState()`.
3. Ao reabrir o site, `persistence.js` verifica se existe `rootHandle` salvo
   e se a permissão de leitura ainda está concedida. Se sim, recarrega os
   arquivos de áudio da pasta e mostra o banner "Continuar de onde parou?".
4. Sem suporte a FSA (Firefox, Safari iOS): nada acontece, o botão "Adicionar
   pasta" mantém o comportamento original (`<input webkitdirectory>`, sem
   memória entre sessões).

## Status

- [x] Código completo e aplicado em produção (`persistence.js` na raiz,
      hooks em `script.js`, script tag em `index.html`)
- [ ] Teste end-to-end confirmado pelo usuário:
  - [ ] Fechar aba tocando → reabrir → banner aparece na posição certa
  - [ ] Media Session funcionando (lock screen / barra de mídia)
  - [ ] Fallback sem FSA testado em Firefox/Safari

## Limitações conhecidas

- Só funciona com pastas locais (FSA), não com arquivos individuais avulsos
- Sem suporte a FSA, não há "continuar de onde parou" entre sessões
- Permissão de leitura da pasta pode ser revogada pelo navegador/SO a
  qualquer momento — nesse caso a restauração automática é ignorada
  silenciosamente (comportamento esperado, sem erro pro usuário)