# Validação 1.28.0 — 03/11/2026

Escopo: somente banco-cbr-app2; sem commit, push ou chamadas ao GitHub real. Fixtures fictícias e API local; nenhum token real lido/exposto.

## Causa do login repetido
`shim.js` exibia `telaConfig` após qualquer falha no download sem cache, incluindo rede, permissões/rate limit/404/409; também classificava certos 403 contendo “token/credential” como credencial inválida. A chave já persistia em `bcbr_gh_token`; o SW preservava `bcbr-cfg`. A correção mantém a chave, recupera a cópia anterior de `bcbr-cfg/__token` se necessário, trata somente 401 como credencial recusada e usa coordenação entre abas (Web Locks + aviso compartilhado). Abas bloqueadas na carga retomam após salvar a credencial em outra aba; requisições antigas não invalidam uma chave recém-alterada.

## Verificações
- Resultado final: **155 testes, 155 aprovados, zero falhas/skips/cancelamentos**, saída 0; interpretador **28/28**, saída 0; `git diff --check`, saída 0. Saída final em `teste/validacao-1.28.log`. O build também terminou com saída 0.
- Build: `node build/montar-node.js`; versão 1.28.0 em app.js/index.html/versao.txt/sw.js. O gerador lê as trocas de `montar.py` e verifica suas contagens. Teste com `git show HEAD:<arquivo>` confirmou reprodução exata dos quatro artefatos anteriores, normalizando CRLF/LF como a leitura Python.
- Suíte completa PowerShell: `$testes = Get-ChildItem teste/*.test.js | Where-Object Name -ne 'interpretar.test.js' | ForEach-Object FullName; node --test --test-isolation=none $testes`.
- Interpretador executado à parte: `node teste/interpretar.test.js`, pois chama `process.exit`. `ri-dia.test.js` também executa asserções reais de RI, sem registrar casos node:test.
- Chrome headless: desktop 1280/800 px e celular 390 px; separação das abas, Tab/Shift+Tab, toggle que remove filhos do DOM, check independente, edição rica, lista semanal, teclado/calendário, grade e arraste, Notas com edição sem perder foco, busca/fixação/confirmação de exclusão/persistência local. Requisições externas bloqueadas.
- Testes de regressão novos: rede/403/404/409/429/503 não pedem login com/sem cache; 401 deduplicado entre abas; migração/reabertura de token; Accept raw; toggle persistido; meta 50 preservando 37 explícito; migração da ordem das abas; CRUD e confirmação de notas; recarga offline, conflitos com outra nota/tarefa, exclusão offline e compactação de 100 edições.
- Planejamento de mês/semana fica em Tarefas; abrir esses controles não reinsere cartões no Calendário semanal/mensal/lista. Notas reordena ao terminar a edição, preserva foco durante sync e durante a busca; fixadas têm precedência sobre atualização.

## Ajustes nos testes existentes
Expectativas de calendário+tarefas misturados foram atualizadas para as duas telas. A comparação de fonte da RI normaliza CRLF/LF. No Chrome, a sanitização aceita representações equivalentes hex/rgb; a grade é verificada no container `.sm-gs` (os grupos internos são flex) e ignora tracks vazios de auto-fit, mantendo asserções de largura/gap/mobile/arraste.

## Erros e escalada
1. Primeiro `node --check app.js`: parêntese excedente na inicialização do Set de toggles; corrigido antes da primeira suíte.
2. Primeira suíte parcial: 65/69, com quatro falhas (expectativas antigas das telas, stub de escape HTML e acesso a const lexical no contexto VM); corrigidas. Revisão de escalada solicitada conforme instruções do Artur.
3. A ferramenta de escalada não iniciou: `failed to load model context ... invalid thread-store request: no rollout found`. A revisão local e os testes continuaram. As rodadas intermediárias apontaram ainda fixtures de recarga sem remoto compartilhado e expectativas antigas de CSS/CRLF, documentadas acima e corrigidas.

## Limites
Python não está disponível neste ambiente: a receita foi executada pelo equivalente Node e sua reprodução foi testada. GitHub real e aparelho físico não foram usados; sync/401/conflitos/offline foram exercitados com respostas controladas. A emulação móvel é do Chrome, não um teste de Android/iOS físico. Não houve validação do ciclo real de atualização do PWA instalado; versão/cache e preservação da configuração são verificadas nos artefatos/testes.
