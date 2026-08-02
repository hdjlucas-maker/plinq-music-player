# NEXT_TASK.md

## Tarefa imediata — confirmar e testar persistência

O código da Sprint 1 (persistência) já foi entregue nesta sessão:
- `persistence.js` (novo arquivo, raiz do repo)
- `PATCH_SCRIPT_JS.md` (4 patches pontuais em `script.js`)
- 1 linha em `index.html`

Passos que faltam (do usuário, fora desta sessão):
1. Baixar `persistence.js` e colocar na raiz do repo
2. Aplicar os 4 patches de `PATCH_SCRIPT_JS.md` no `script.js`
3. Adicionar `<script src="persistence.js" defer></script>` no `index.html` (logo após `script.js`)
4. `git add . && git commit -m "Adiciona persistencia local (FSA + IndexedDB + Media Session)" && git push`
5. Testar em produção:
   - Reabrir o navegador não deve pedir permissão de novo (quando o navegador permitir)
   - Fechar aba tocando aos 1:23 de uma faixa, reabrir, deve oferecer retomar em 1:23
   - Media Session mostrando controles corretos no Android/desktop
   - Testar fallback em navegador sem FSA (Firefox/Safari) — deve cair no `<input type="file">` normal, sem persistir handle

**Enquanto o passo 5 não for confirmado, não considerar a Sprint 1 (persistência) concluída.**

## Depois disso — próxima tarefa da Sprint 1

Remoção de músicas da playlist (item ainda não iniciado da Sprint 1).

## Restrições (válidas pra qualquer tarefa client-side)

- 100% client-side
- Sem localStorage/sessionStorage para listas grandes — usar IndexedDB
- Sem novas dependências externas, sem build step (ver CLAUDE.md)
