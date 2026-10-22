# Kit de teste (Banco CBR)
Serve o app direto desta pasta e simula a API do GitHub com os dados de `../banco-cbr-app` (privado, nada é copiado para cá). PUT = só 200, nada grava. O `sw.js` é trocado por um nulo.

**Subir:** `node teste/servidor.js [pasta-dados] [porta]` (padrão: `../banco-cbr-app`, 8765; ou `BCBR_DADOS`/`PORT`). Rodar com o diretório do repo como base.
**Abrir (Browser pane):** navegar para `http://localhost:8765/`. O servidor injeta (só na resposta) um fetch que desvia `api.github.com` para `/api` e grava token falso em `bcbr_gh_token`. O app não precisa de linha nenhuma.
**Prova/meta:** no console `cfg.prova='2026-12-20'; render()` (modoProva já vem ligado). Nota: `requestAnimationFrame` fica travado no Browser pane; para testar `qRola` use `window.requestAnimationFrame=f=>setTimeout(()=>f(performance.now()),16)`.
**Dica:** esperar ~4 s após carregar; eventos de teclado: `document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'g',bubbles:true,cancelable:true}))`.

## Roteiro
1. Carga: sem erro de JS no console (404 de recursos pode aparecer); `QUESTOES.length` > 2000; abas: Hoje, Semana, Questões, Estudar, Flashcards, Painel, Banco, Config.
2. Questão com imagem: `iniciar(['q28','q1048','q1058'],'estudo')` (2-3 imagens cada). Tecla G seleciona imagem, ←/→ trocam sem mudar a questão, G abre zoom, G fecha. Rodapé `.qatalhos` presente.
3. Imagem não pisca: após responder (Enter com alternativa escolhida), o `<img>` principal continua o mesmo nó DOM.
4. Abas: `go('questoes')` abre bloco/tela "Nenhum bloco"; Tab/Shift+Tab trocam aba (de Questões: Estudar / Semana).
5. Meta única: `riHoje().length === metaHoje() === ALVO.ri() === smMetaDe(smHoje())` e os números na aba Hoje (metaProvaCard, riDesc) e Semana (cartão Hoje).
6. Semana: `.sm-hoje1.kbsel`, ↓/↑ marcam `.sm-row.kbsel`, Enter alterna, F apaga (só em memória), Esc solta, Alt+A abre Nova tarefa.
