# Banco CBR (app)

## Estado atual / Histórico
- 26/10/2026 — 1.24.0: Banco abre no primeiro clique (removida chamada inexistente a prVideoBloco), compartilha enunciado/alternativas com quiz e mostra todos os dados sem responder; dificuldade/% só no pós-resposta do quiz. 88 testes JS passaram; geração equivalente validada contra HEAD (Python ausente); navegador pendente por indisponibilidade da ferramenta.

1.23.0: topo com dificuldade/% dos alunos e prova/ano; após responder, % por alternativa e aviso de qualidade. Tags do site ficam guardadas, separadas das do app.
`build/personalrad.js`: qualidade ×0,6, prova real ×1,1, incidência normalizada ×0,8–1,25 (expoente 0,25; sem casamento ×1). `shim.js` carrega/cacheia taxonomia e simulados privados; testes em `teste/personalrad.test.js`.
86 testes JS passaram. Artefatos gerados por execução equivalente da receita (HEAD reproduzido exatamente); execução nativa de `montar.py`/testes Python e pull pendentes (Python negado/rede indisponível).

@README.md

**Fonte da verdade do projeto: `CLAUDE.md` do repo privado `arturaragao/banco-cbr-app`** — leia antes de mexer. Não editar `app.js`/`index.html` à mão (gerados por `python build/montar.py`).
