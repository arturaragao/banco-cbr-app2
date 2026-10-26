// node --test teste/semana.test.js — sem dependências nem gravação de dados.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { tituloTarefa, tituloIdeia } = require('../build/interpretar.js');
const fonte = fs.readFileSync(require.resolve('../build/semana.js'), 'utf8');

test('títulos legados perdem apenas o prefixo inicial', () => {
  assert.equal(tituloTarefa('💡 Melhorar o app'), 'Melhorar o app');
  assert.equal(tituloTarefa('💡  Melhorar o app'), 'Melhorar o app');
  assert.equal(tituloTarefa('Manter 💡 aqui'), 'Manter 💡 aqui');
  assert.equal(tituloTarefa('💡'), '💡');
  assert.equal(tituloTarefa(null), '');
  assert.equal(tituloTarefa('Ação e revisão'), 'Ação e revisão');
  assert.equal(tituloTarefa(tituloIdeia('eu queria que o app abrisse mais rápido')), 'O app abrisse mais rápido');
});

const atalho = fonte.slice(fonte.indexOf('function smAtalhosInicia(){'), fonte.indexOf('// ---- Ponte com o app Android'));
for (const acao of ['tarefa', 'voz', 'ri']) for (const pendente of [false, true]) {
  test(`manifest ${acao}, rascunho pendente=${pendente}`, async () => {
    const manifest = JSON.parse(fs.readFileSync(require.resolve('../manifest.webmanifest'), 'utf8'));
    const url = manifest.shortcuts.find(x => x.url.endsWith('='+acao)).url;
    const chamadas = [];
    const c = vm.createContext({URL, location:{href:new URL(url, 'https://exemplo.test/app/').href},
      history:{state:null, replaceState:(_,__,u)=>chamadas.push(u)},
      SM:{d:{}, fila:Promise.resolve()}, smCarga:Promise.resolve(), smSyncCarga:Promise.resolve(),
      qaRascLer:()=>pendente?{salvar:true}:null, smRascPend:()=>chamadas.push('salvar'),
      go:t=>chamadas.push(t), qaAbre:()=>chamadas.push('abrir'),
      qaVozAPI:()=>true, qaVoz:()=>chamadas.push('voz'), iniciaRI:()=>chamadas.push('ri'), toast:assert.fail});
    vm.runInContext(atalho, c); c.smAtalhosInicia();
    await new Promise(r=>setImmediate(r));
    assert.equal(chamadas[0], '/app/');
    assert.equal(chamadas.includes('abrir'), acao !== 'ri');
    assert.equal(chamadas.includes('voz'), acao === 'voz');
    assert.equal(chamadas.includes('ri'), acao === 'ri');
  });
}

test('Semana mantém calendário e tarefas juntos, sem sub-aba nem cartões removidos', () => {
  const trecho = fonte.slice(fonte.indexOf('function vSemana(){'), fonte.indexOf('function smCardHoje()'));
  assert.ok(trecho.includes('${smSemData()}'));
  assert.ok(trecho.includes('${smCalendario()}'));
  assert.ok(trecho.includes("SM.vis!=='semana'?smHojeGrande():''"));
  assert.ok(!trecho.includes('sm-seg'));
  assert.ok(!fonte.includes("localStorage.getItem('sm_aba')"));
  assert.ok(!fonte.includes("localStorage.setItem('sm_aba'"));
  assert.ok(!trecho.includes('Anotações'));
  assert.ok(!trecho.includes('Temas fracos'));
});

test('importação da caixa cria título sem marcador e mantém texto inteiro nos detalhes', async () => {
  const tarefas = [];
  const c = vm.createContext({smCarga:Promise.resolve(), SM:{d:{tarefas, ideiasVistas:[]}},
    smIdeiasUlt:0, BCBR:{REPO:'teste', api:async()=>({content:'caixa'})}, smDec:s=>s,
    smIdeiasLinhas:()=>[{chave:'2026-10-26 10:00', texto:'eu queria que o app abrisse mais rápido. Detalhes completos.', feita:false}],
    smMudar:fn=>fn(c.SM.d), smNovos:(dias,texto,area,sub,det)=>[{id:'nova',dia:dias[0],texto,area,det}],
    tituloTarefa, tituloIdeia, console});
  const fim = fonte.indexOf('smIdeiasSync(true);');
  vm.runInContext(fonte.slice(fonte.indexOf('async function smIdeiasSync(forca){'), fim), c);
  await c.smIdeiasSync(true);
  assert.equal(tarefas[0].texto, 'O app abrisse mais rápido');
  assert.equal(tarefas[0].det, 'eu queria que o app abrisse mais rápido. Detalhes completos.');
  assert.equal(tarefas[0].dia, 'sem'); assert.equal(tarefas[0].area, 'ferramenta');
  await c.smIdeiasSync(true); assert.equal(tarefas.length, 1);
});
