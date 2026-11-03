# Validação 1.31.2 — 03/11/2026

Escopo: classificação no quiz após resposta, blocos banco/Codex e PersonalRad separados; Banco sem pr_tags; agregações e pesos RI isolados de pr_tags. Nenhum commit/push.

- `node build/montar-node.js`: saída 0; regenerou app.js, index.html, versao.txt e sw.js em 1.31.2.
- `node --test teste/*.test.js`: saída 0; 169 testes passaram, 0 falhas, 0 ignorados; interpretador adicional confirmou 28 casos. Inclui testes existentes no Chrome para desktop/celular e verificação de build, sintaxe e UTF-8 sem BOM.
- Testes da mudança executam a renderização real gerada em VM: antes da resposta, alternativa apenas selecionada, após resposta, sem tags, sem tags/cl, e simulado sem feedback. Confirmam todos os níveis PersonalRad, escape HTML e bloco Codex condicional. Banco aberto/fechado continua sem PersonalRad.
- Novo teste executa areaDe/classTags, statsPor, temas, vSub, vIncidencia, _pvBase, pesoVolume e prPesoTema; compara agregados e pesos antes/depois de incluir pr_tags conflitantes, inclusive questão sem tags/cl.
- shim.js inspecionado: preserva pr_tags separado de tags/cl; nenhuma mudança necessária. Agregações existentes já ignoravam pr_tags; nenhuma alteração necessária no algoritmo.

## Brief de escalada e erros corrigidos

Objetivo: teste de regressão demonstrando que pr_tags não modifica agregações ou pesos.
1. Primeira execução direcionada: 26/27 passaram. `SyntaxError: Identifier 'PARAM' has already been declared` no ambiente VM do teste novo. Corrigido removendo a declaração duplicada no stub.
2. Segunda execução direcionada: 26/27 passaram. `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal` no retrato de agregados: temas() devolve referências às questões completas, incluindo pr_tags; a comparação serializava também esses dados de origem. Corrigido comparando IDs de questões no retrato e fixando Date.now para evitar variação temporal.

Escalada solicitada com brief e os dois erros ao agente escalada; ferramenta falhou com `failed to load model context ... invalid thread-store request: no rollout found`. Correção local concluída; suíte completa passou em seguida.

Limites: interface específica do quiz validada por HTML real em VM; sem inspeção visual manual do quiz ou aparelho físico. Build pela alternativa Node documentada no README; Python não executado.
