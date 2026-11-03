# Validação 1.30.0 — Tarefas

03/11/2026. Fontes alteradas em `build/`; artefatos gerados com `node build/montar-node.js`.

- Causa dos espaços: linhas compartilhadas da grade de duas colunas assumiam a altura da tarefa mais alta. Colunas independentes mantêm intervalo de 6 px, inclusive com texto longo e detalhes; uma coluna no celular.
- Fundo: cor do tipo a 10% sobre `--card` (12% no hover), com cores para tipos personalizados e suporte aos temas claro/escuro.
- Título superior removido; planejamento semanal/mensal e seus painéis ficam após todas as tarefas.
- Arrasto inicia apenas na alça; texto selecionável com mouse. Grupos informam dia/tipo/subtema. Soltar em outro grupo usa `smMudar`, com cache, fila, PUT e reaplicação após conflito; preserva os demais campos da tarefa. Reordenação/Alt+setas limitadas ao tipo e subtema, mantendo prioridade antes da ordem.

## Comandos e resultados

```sh
node build/montar-node.js
CHROME_PATH=/usr/bin/chromium node --test --test-isolation=none $(rg --files teste -g '*.test.js' -g '!interpretar.test.js')
node teste/interpretar.test.js
git diff --check
```

168/168 testes Node passaram, incluindo 15 testes do aceite Chrome (desktop e celular). Os 28/28 casos do interpretador passaram separadamente. `--test-isolation=none` segue a orientação do kit para este ambiente; processos Chrome/git executados com a permissão necessária.

Cobertura nova: seleção real de texto sem arrasto; arrasto real pela alça para outro tipo; espaçamento com alturas diferentes; cor nos dois temas; planejamento no final; troca de tipo/subtema com conflito 409 sem perder detalhes, HTML, etiquetas, subtarefas, anexos ou repetição; tarefa ligada em outro dia preservada; reordenação e evento Alt+seta. Regressões do editor, Calendário, Notas, login e sincronização simulada passaram.

Nenhuma gravação foi feita no repositório de dados privado. Toque em aparelho físico não foi testado.
