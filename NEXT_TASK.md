# NEXT_TASK.md

Sprint 1 — Persistência real (local-first)

## Objetivo

Usuário não deve precisar re-selecionar arquivos/pastas a cada visita.
Player deve lembrar faixa, posição e configurações entre sessões.

## Escopo

1. File System Access API (FSA)
   - Guardar o handle da pasta/arquivos selecionados (não o arquivo em si)
   - Reobter acesso sem novo diálogo, exceto quando o navegador exigir permissão

2. IndexedDB
   - Persistir: lista de faixas conhecidas (nome + referência ao handle)
   - Playlist atual, posição da faixa tocando (segundos), volume, shuffle/repeat
   - Guardar `FileSystemFileHandle`/`FileSystemDirectoryHandle` diretamente como valor

3. "Continuar de onde parei"
   - Ao abrir o site, oferecer retomar última faixa na posição exata

4. Media Session API
   - Controles play/pause/next/previous no SO/lock screen/notificação
   - Metadata: título, artista, capa da faixa atual

## Restrições

- 100% client-side
- Sem localStorage/sessionStorage para listas grandes — usar IndexedDB
- Sem novas dependências externas, sem build step (ver CLAUDE.md)

## Compatibilidade

FSA API não suportada em Firefox nem Safari (iOS).
Obrigatório: fallback para `<input type="file">` sem persistência de handle
quando `window.showOpenFilePicker` não existir.

## Critério de conclusão

- Reabrir o navegador não pede permissão de novo (quando o navegador permitir)
- Fecha aba tocando aos 1:23 de uma faixa, reabre, oferece retomar em 1:23
- Media Session mostra controles corretos no Android/desktop
- Fallback funcional testado em navegador sem suporte a FSA
