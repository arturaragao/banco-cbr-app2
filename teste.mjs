import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const origem = 'https://arturaragao.github.io';
const casos = [
  ['/banco-cbr-app2/', '/radio/'],
  ['/banco-cbr-app2/?pagina=abc', '/radio/?pagina=abc'],
  ['/banco-cbr-app2/pasta/nota?aba=notas&acao=tarefa', '/radio/pasta/nota?aba=notas&acao=tarefa'],
  ['/banco-cbr-app2/?aba=notas#bloco-2', '/radio/?aba=notas#bloco-2'],
];

// Executa o código publicado, em vez de testar uma cópia da função.
for (const arquivo of ['index.html', '404.html', 'sw.js']) {
  const conteudo = await readFile(new URL(arquivo, import.meta.url), 'utf8');
  const codigo = arquivo.endsWith('.html') ? conteudo.match(/<script>([\s\S]*?)<\/script>/)[1] : conteudo;
  for (const [entrada, esperado] of casos) {
    let destino;
    const contexto = vm.createContext({
      URL,
      location: { href: origem + entrada, replace: valor => { destino = valor; } },
      self: { addEventListener() {} },
    });
    vm.runInContext(codigo, contexto);
    assert.equal(contexto.montarDestino(origem + entrada), origem + esperado, `${arquivo}: ${entrada}`);
    if (arquivo.endsWith('.html')) assert.equal(destino, origem + esperado);
  }
}
console.log('OK: 4 casos de URL em index.html, 404.html e sw.js (12 verificações; location.replace conferido).');
