# Calendário 1.27.0 — validação e brief de escalada

Escopo: pedidos 1–12 do Artur. Apenas build/semana.js, build/semana.css, build/layout.js, versão em build/montar.py, artefatos gerados pelo montador e teste/. Sem commit, push, leitura de dados pessoais ou gravação no plano privado. A chave da aba continua `semana`; o rótulo é Calendário. Esquema continua v2; `texto` permanece puro, `textoHtml` é opcional e `det` aceita HTML sanitizado. Campos antigos de urgência são preservados.

## Execuções reais

- `python build/montar.py`: exit 0, gera app.js/index.html/sw.js/versao.txt em 1.27.0.
- `node --check`: 18 arquivos JS (fontes alteradas, gerados e kit de teste), exit 0.
- PowerShell: `$arquivos=rg --files teste -g '*.test.js' -g '!calendario-browser.test.js' -g '!interpretar.test.js'; node --test --test-isolation=none @arquivos`: 113 testes passaram, zero falhas, exit 0.
- `node teste/interpretar.test.js`: 28 casos passaram, exit 0. Deve ser executado separadamente, pois contém `process.exit`.
- `node teste/servidor.js --simulado 8766`: servidor iniciou. Fetch local confirmou HTTP 200, versão 1.27.0 e seis tarefas fictícias. Nenhum arquivo do repositório privado foi usado.
- UTF-8 estrito, ausência de BOM, escopo dos arquivos e `git diff --check`: conferidos ao finalizar.

## Aceite por item

| Item | Verificado de verdade | Limite |
| --- | --- | --- |
| 1 | Mutação do rótulo com chave estável e funções reais de Tab/Shift+Tab em VM Node | Renderização da navegação no navegador pendente |
| 2 | HTML dos cards e tokens pastel; CSS implementa grid e breakpoint | Aparência, medidas e responsividade visual pendentes |
| 3 | HTML não tem edição por clique nem lápis; duplo clique aponta para editor; painel gerado | Sequência física de cliques no navegador pendente |
| 4 | Toggle ausente sem subtarefas e presente com etapas | Interação DOM real pendente |
| 5 | Grupos gerados sem emojis | Nenhum limite na saída de HTML testada |
| 6 | Checkbox com estilo, cor do tipo e animação implementados; conclusão e desfazer continuam testados | Animação e aparência pendentes |
| 7 | Alça presente; função de mover preserva campos e notificações | Gesto físico de arraste pendente |
| 8 | Barra retorna vazio; cabeçalho contém Lista; lista tem sete dias e só tarefas da semana atual | Aparência do botão pendente |
| 9 | Função real retorna vazio para dia sem tarefas | Remoção visual da célula pendente |
| 10 | Função de clique muda data e lista do teclado sem abrir adição; função de duplo clique preseleciona data | Eventos físicos do navegador pendentes |
| 11a | Ordem Ferramenta/Tarefa/Estudo em opções e grupos, incluindo tipos salvos em outra ordem | Nenhum limite na lógica testada |
| 11b | Adição e edição sem controle Urgente; atalho retirado da configuração; campo legado preservado ao editar | Sem navegador |
| 11c | Calendário de 42 dias; navegação mensal; setas só movem cursor no modo múltiplo; Espaço/Enter alternam sem salvar; zero seleção exige dia | Parser e foco DOM reais pendentes |
| 11d | Hora ausente e passo pulado em Sem data; presente com Data | Exibição visual pendente |
| 11e | Detalhes antes de Lembrete e progressão testada | Sem navegador |
| 11f | Duplo clique ligado à criação de campos; rascunho, agrupamento e gravação de subtarefas testados | Evento físico pendente |
| 11g | Texto de status/Desfazer e CSS usam fundo/texto distintos do tema | Contraste real claro/escuro pendente |
| 12 | HTML opcional salvo e exibido, título puro e urgência preservados; atalhos chamam os comandos corretos; saída da sanitização descarta scripts/atributos/URLs em árvore DOM simulada | Seleção, execCommand, parser HTML real e aparência ainda precisam de Chrome |

Os testes de sanitização em Node usam árvore DOM simulada: validam a política de saída, sem provar o comportamento do parser HTML do navegador. O teste Chrome foi preparado para conferir parser, gestos, seleção, contraste e console; não completou neste ambiente.

## Brief e erros para escalada

Objetivo pendente: executar `node --test teste/calendario-browser.test.js` num ambiente que permita Chrome e processos filhos. Critério: todos os subtestes e zero exceções/console.error. O teste usa dados fictícios e bloqueia rede externa.

1. Primeira tentativa: `node --test` da suíte existente, exit 1 antes das asserções: `Error: spawn EPERM`, `syscall: spawn`, `errno: -4048`, em `node:internal/test_runner/runner`. Resolvido para os testes Node por `--test-isolation=none`.
2. Segunda tentativa: `node --test teste/calendario-browser.test.js`, exit 1 antes das asserções: o mesmo `Error: spawn EPERM` do runner. O aceite do navegador permanece pendente.

Confirmação independente: Chrome iniciado diretamente pelo terminal falhou com `FATAL:mojo/public/cpp/platform/platform_channel.cc:112 — Acesso negado (0x5)` e `crash server failed to launch, self-terminating`. A tentativa em processo único chegou a anunciar DevTools, mas falhou novamente no mesmo canal Mojo. O lançador retornou exit 0; isso não foi contado como teste aprovado, pois o navegador encerrou com erro fatal.

Durante o desenvolvimento, duas asserções foram corrigidas: a prévia perdeu inadvertidamente prioridade não urgente (restaurada) e um teste acessou `const smCorTexto` como propriedade do contexto VM (corrigido para `vm.runInContext`). A execução final Node passou. Uma tentativa anterior agrupando todos os arquivos retornou apenas os 28 casos do interpretador; foi descartada como evidência de suíte completa porque `process.exit` interrompeu os demais.

Risco restante: efeitos visuais e gestos físicos, seleção/formatação do contenteditable e console real não verificados. Não há evidência de aceite completo no navegador.

A revisão automática de comandos rejeitou a limpeza recursiva do perfil temporário `teste/.chrome-calendario` (`Remove-Item -LiteralPath ... -Recurse -Force`, blocked by policy), mesmo com conferência do caminho absoluto. A remoção não foi executada e o diretório temporário permanece em teste/. Ele foi criado com perfil novo, sem dados privados. Essa pendência também integra a escalada.
