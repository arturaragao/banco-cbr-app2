# Redirecionamento do Radio

Conteúdo do novo repositório `banco-cbr-app2`, a publicar no GitHub Pages depois
que o repositório do app for renomeado para `radio` pelo maestro.

`index.html` e `404.html` usam `location.replace` para preservar subcaminho,
query e hash em `/radio/`. Sem JavaScript, o link e o meta refresh abrem a raiz
nova (o fallback estático não consegue transportar query/hash/subcaminho).

Publicar `sw.js` exatamente em `/banco-cbr-app2/sw.js`: na próxima atualização
do SW antigo, ele assume os clientes, cancela o próprio registro e navega apenas
as janelas do caminho antigo para o equivalente novo. Nenhum cache é apagado;
localStorage e IndexedDB permanecem na mesma origem. Instalações offline precisam
voltar à rede e receber a atualização; validar o comportamento no aparelho.

Teste local, sem dependências: `node teste.mjs` (quatro casos nas três entradas).
Esta preparação não renomeia repositórios, não publica e não faz commit/push.
