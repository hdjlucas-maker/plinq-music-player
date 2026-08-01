# Bugs

## Corrigido nesta sessão
✔ Remover item não funciona em iPhone/touch — botão tinha opacity:0 preso a :hover.
   Corrigido com @media (hover: none) { opacity: 1 }.

## Abertos (não verificados nesta sessão, herdados da documentação anterior)
- Playlist não salva corretamente no Firefox (depende da persistência real, ainda não implementada)
- Media Session falha no Safari (Media Session ainda não implementado)
- Sleep Timer não inicia após pausa — REVISADO: Sleep Timer é uma feature nova implementada
  do zero nesta sessão, não existia antes. Precisa ser testado manualmente pelo usuário.
