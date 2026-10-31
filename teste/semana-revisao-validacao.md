# Revisão local 1.27.0 — 31/10/2026

## Brief para escalada

Corrigir exclusivamente os três achados em build/semana.js, preservar a versão
1.27.0 e as alterações locais existentes, gerar pelo montar.py, sem commit/push.
Implementação concluída: cópias de subtarefas independentes; det como texto puro
e detHtml como HTML sanitizado; hora exibida/salva somente com data, inclusive
na edição de grupos. Detalhes e rascunhos passam por três round-trips nos testes.

Houve duas execuções de validação com falha, registradas abaixo conforme a regra
de escalada do Artur. O segundo erro foi corrigido. A pendência para outro
ambiente é executar o teste Chrome sem a restrição de criação de processos.
Nenhum dado pessoal, serviço real, commit ou push foi usado na validação.

## Erro 1 — ambiente bloqueia subprocesso do teste de navegador

Comando: node --test --test-isolation=none teste/calendario-browser.test.js

Código de saída 1; zero testes aprovados, uma falha no início do teste pai.
O servidor local não chegou a iniciar e os subtestes não foram executados.

```text
Error: spawn EPERM
  at ChildProcess.spawn (node:internal/child_process:458:11)
  at spawn (node:child_process:813:9)
  at TestContext.<anonymous> (teste/calendario-browser.test.js:11:18)
errno: -4048
code: EPERM
syscall: spawn
```

Não houve tentativa de contornar permissões. Os novos subtestes desse arquivo
continuam disponíveis para execução com Chrome e processos locais permitidos.

## Erro 2 — acesso incorreto a constante lexical da VM no teste novo

Comando: node --test --test-isolation=none teste/semana-integracao.test.js

Código de saída 1; 34 testes aprovados, dois reprovados pelo mesmo erro:

```text
TypeError: a.c.smRascEd is not a function
  at TestContext.<anonymous> (teste/semana-integracao.test.js:171:24)
TypeError: a.c.smRascEd is not a function
  at TestContext.<anonymous> (teste/semana-integracao.test.js:193:22)
```

Corrigido usando vm.runInContext para a constante lexical smRascEd. Adicionado
focus() aos elementos simulados para permitir as sucessivas reaberturas.
A execução final desse arquivo passou: 36/36, saída 0.

## Ocorrência adicional — aspas do comando de verificação

Na primeira tentativa das asserções adicionais, o PowerShell removeu as aspas
do argumento de node -e: SyntaxError: missing ) after argument list, saída 1.
Nenhuma asserção dessa tentativa foi considerada aprovada. O comando foi
substituído por código em here-string enviado pela entrada padrão do Node.
Resultado real da execução corrigida: oito arquivos UTF-8 sem BOM, fonte
integrada e versão 1.27.0 preservada; saída 0. O build e os quatro node --check
da mesma etapa já haviam retornado saída 0 antes desse erro de invocação.

## Validação final

Node v24.20.0; Python 3.13.15. Cada arquivo foi executado separadamente com
node --test --test-isolation=none, nunca passando uma pasta.

| Arquivo (sob teste/) | Resultado final | Saída |
| --- | --- | --- |
| semana-integracao.test.js | 36/36 | 0 |
| semana.test.js | 9/9 | 0 |
| semana-regras.test.js | 7/7 | 0 |
| ri-dia.test.js | 1/1 | 0 |
| repeticao.test.js | 18/18 | 0 |
| prova.test.js | 5/5, incluindo versão 1.27.0 | 0 |
| personalrad.test.js | 17/17 | 0 |
| interpretar.test.js | 28 casos, resultado explícito do script | 0 |
| interpretar-natural.test.js | 17/17 | 0 |
| estudar.test.js | 4/4 | 0 |
| banco.test.js | 2/2 | 0 |
| calendario-browser.test.js | bloqueado por spawn EPERM | 1 |

Total aprovado: 116 testes reportados pelo runner e 28 casos do script de
interpretação. As novas regressões Node executam as funções reais da aplicação
com armazenamento/API/DOM simulados. O parser de HTML do Chrome e as interações
reais de data não puderam ser validados neste ambiente; os subtestes de navegador
cobrem essas verificações quando executados em um ambiente compatível.

Comandos adicionais, todos com saída 0:

- node --check build/semana.js
- node --check teste/semana-integracao.test.js
- node --check teste/calendario-browser.test.js
- node --check app.js
- python build/montar.py (app.js/index.html em 1.27.0)

Verificações finais por asserções Node: UTF-8 válido sem BOM nos arquivos
afetados/gerados, fonte semana.js presente no app.js, versão 1.27.0 preservada
no montador, nos artefatos e no service worker. Sem validação de sincronização
real ou WebView Android.
