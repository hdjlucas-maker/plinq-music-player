# NEXT_TASK.md

## Tarefa imediata — confirmar e testar layout responsivo

Código entregue (fora de sprint, ajuste de UI):
- `index.html` alterado (wrapper `player-main` envolvendo LCD + controles + volume + extras)
- `style.css` alterado (breakpoints tablet 700px+ e desktop 1000px+/1400px+)
- `script.js` não foi tocado

Passos que faltam (do usuário):
1. Substituir `index.html` e `style.css` na raiz do repo pelos arquivos completos entregues
2. `git add index.html style.css && git commit -m "Deixa o layout responsivo para desktop, tablet e celular" && git push`
3. Testar redimensionando a janela do navegador (ou F12 → modo celular/tablet):
   - Celular (até 699px): playlist com altura relativa (~45% da tela)
   - Tablet (700px+): card 620px, gêneros em 3 colunas
   - Desktop (1000px+): 2 colunas — player fixo à esquerda, playlist até 64% da altura da tela à direita
   - Telas largas (1400px+): card mais largo, sem esticar demais

**Enquanto o passo 3 não for confirmado, não considerar o layout responsivo concluído.**

## Depois disso — próxima tarefa da Sprint 1

Remoção de músicas da playlist (item ainda não iniciado da Sprint 1).

## Restrições (válidas pra qualquer tarefa client-side)

- 100% client-side
- Sem localStorage/sessionStorage para listas grandes — usar IndexedDB
- Sem novas dependências externas, sem build step (ver CLAUDE.md)
