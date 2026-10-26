// node --test teste/semana.test.js — sem dependências nem gravação de dados.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { tituloTarefa, tituloIdeia, agruparTarefas } = require('../build/interpretar.js');
const fonte = fs.readFileSync(require.resolve('../build/semana.js'), 'utf8');
const hoje = '2026-10-26';
test('títulos legados perdem apenas o prefixo inicial', () => {
  assert.equal(tituloTarefa('💡 Melhorar o app'), 'Melhorar o app');
  assert.equal(tituloTarefa('💡  Melhorar o app'), 'Melhorar o app');
  assert.equal(tituloTarefa('Manter 💡 aqui'), 'Manter 💡 aqui');
  assert.equal(tituloTarefa('💡'), '💡');
  assert.equal(tituloTarefa(null), '');
  assert.equal(tituloTarefa('Ação e revisão'), 'Ação e revisão');
  assert.equal(tituloTarefa(tituloIdeia('eu queria que o app abrisse mais rápido')), 'O app abrisse mais rápido');
});
test('agrupa todas as datas, sem data, legadas e próxima semana sem perder concluídas', () => {
  const lista = [
    {id:'futuro', dia:'2027-01-01'}, {id:'sem', dia:'sem', area:'ferramenta'},
    {id:'hoje', dia:hoje, feito:true}, {id:'antiga', dia:'2025-01-01'},
    {id:'proxima', dia:'proxima'}, {id:'legada'}, {id:'nula', dia:null}
  ];
  const antes = JSON.stringify(lista), g = agruparTarefas(lista, hoje);
  assert.deepEqual(g.map(x=>x.dia), ['2025-01-01', hoje, '2027-01-01', 'sem', 'proxima']);
  assert.equal(g.find(x=>x.dia===hoje).titulo, 'Hoje');
  assert.deepEqual(g.find(x=>x.dia==='sem').l.map(x=>x.id), ['sem','legada','nula']);
  assert.equal(g.flatMap(x=>x.l).length, lista.length);
  assert.equal(JSON.stringify(lista), antes);
  assert.deepEqual(agruparTarefas([], hoje), []);
});
test('urgência e ordem no dia; tarefas ligadas não são deduplicadas', () => {
  const l = [{id:1,dia:hoje,ordem:3,grupo:'g'}, {id:2,dia:hoje,ordem:1},
    {id:3,dia:hoje,ordem:4,urg:true}, {id:4,dia:'2026-10-27',grupo:'g'}];
  assert.deepEqual(agruparTarefas(l,hoje)[0].l.map(x=>x.id), [3,2,1]);
  assert.equal(agruparTarefas(l,hoje)[1].l[0].id, 4);
});
// Executa o código real de inicialização de sub-aba, isolado do restante do app.
const abas = fonte.slice(fonte.indexOf("try{SM.aba="), fonte.indexOf('function smTarefas()'));
test('lembra Calendário e tolera localStorage bloqueado ou valor inválido', () => {
  let salvo;
  const c = vm.createContext({SM:{}, localStorage:{getItem:()=> 'calendario', setItem:(k,v)=>{salvo=[k,v]}}, smkIni(){}, render(){}});
  vm.runInContext(abas,c); assert.equal(c.SM.aba,'calendario');
  c.smAba('tarefas'); assert.deepEqual(salvo,['sm_aba','tarefas']);
  c.localStorage={getItem(){throw Error('bloqueado')},setItem(){throw Error('bloqueado')}};
  vm.runInContext(abas,c); assert.equal(c.SM.aba,'tarefas');
  c.smAba('calendario'); assert.equal(c.SM.aba,'calendario');
  c.localStorage.getItem=()=> 'invalida'; vm.runInContext(abas,c); assert.equal(c.SM.aba,'tarefas');
});
const atalho = fonte.slice(fonte.indexOf('function smAtalhosInicia(){'), fonte.indexOf('// ---- Ponte com o app Android'));
for (const acao of ['tarefa','voz','ri']) for (const pendente of [false,true]) {
  test(`manifest ${acao}, rascunho pendente=${pendente}`, async () => {
    const manifest=JSON.parse(fs.readFileSync(require.resolve('../manifest.webmanifest'),'utf8'));
    const url=manifest.shortcuts.find(x=>x.url.endsWith('='+acao)).url;
    const chamadas=[];
    const c=vm.createContext({URL,location:{href:new URL(url,'https://exemplo.test/app/').href},
      history:{state:null,replaceState:(_,__,u)=>chamadas.push(u)},
      SM:{aba:'calendario',d:{},fila:Promise.resolve()},smCarga:Promise.resolve(),smSyncCarga:Promise.resolve(),
      qaRascLer:()=>pendente?{salvar:true}:null,smRascPend:()=>chamadas.push('salvar'),
      localStorage:{setItem(){}},go:t=>chamadas.push(t),qaAbre:()=>chamadas.push('abrir'),
      qaVozAPI:()=>true,qaVoz:()=>chamadas.push('voz'),iniciaRI:()=>chamadas.push('ri'),toast:assert.fail});
    vm.runInContext(atalho,c); c.smAtalhosInicia();
    await new Promise(r=>setImmediate(r));
    assert.equal(chamadas[0],'/app/');
    assert.equal(chamadas.includes('abrir'),acao!=='ri');
    assert.equal(chamadas.includes('voz'),acao==='voz');
    assert.equal(chamadas.includes('ri'),acao==='ri');
    if(acao!=='ri')assert.equal(c.SM.aba,'tarefas');
  });
}
test('renderização separa Tarefas e Calendário e remove os cartões pedidos', () => {
  const trecho=fonte.slice(fonte.indexOf('function vSemana(){'),fonte.indexOf('// cartão na aba Hoje'));
  const c=vm.createContext({SM:{ok:true,d:{},aba:'tarefas'},setTimeout(){},smAuto(){},
    smTarefas:()=> 'LISTA_TAREFAS',smCalendario:()=> 'CALENDARIO',smHojeGrande:()=> 'HOJE',esc:s=>s});
  vm.runInContext(trecho,c);
  let h=c.vSemana(); assert.ok(h.includes('LISTA_TAREFAS'));assert.ok(!h.includes('CALENDARIO'));
  c.SM.aba='calendario'; h=c.vSemana();assert.ok(h.includes('CALENDARIO'));assert.ok(!h.includes('LISTA_TAREFAS'));
  assert.ok(!h.includes('Anotações'));assert.ok(!h.includes('Temas fracos'));
});
test('lista renderiza tarefas de qualquer data, concluídas e sem data sem alterar dados', () => {
  const tarefas=[{id:'a',dia:'2026-01-01',feito:true},{id:'b',dia:hoje},
    {id:'c',dia:'2027-12-31'},{id:'d',dia:'sem'},{id:'e',dia:'proxima'}];
  const antes=JSON.stringify(tarefas);
  const c=vm.createContext({SM:{d:{tarefas}},smHoje:()=>hoje,agruparTarefas,
    esc:s=>s,smGrupos:l=>l.map(t=>'TAREFA_'+t.id).join(''),smAddLinha:()=>''});
  vm.runInContext(fonte.slice(fonte.indexOf('function smTarefas(){'),fonte.indexOf('function vSemana(){')),c);
  const html=c.smTarefas();
  tarefas.forEach(t=>assert.ok(html.includes('TAREFA_'+t.id)));
  assert.ok(html.includes('Sem data')); assert.ok(html.includes('Próximos dias'));
  assert.equal(JSON.stringify(tarefas),antes);
});
test('importação da caixa cria título sem marcador e mantém texto inteiro nos detalhes', async () => {
  const tarefas=[];
  const c=vm.createContext({smCarga:Promise.resolve(),SM:{d:{tarefas,ideiasVistas:[]}},
    smIdeiasUlt:0,BCBR:{REPO:'teste',api:async()=>({content:'caixa'})},smDec:s=>s,
    smIdeiasLinhas:()=>[{chave:'2026-10-26 10:00',texto:'eu queria que o app abrisse mais rápido. Detalhes completos.',feita:false}],
    smMudar:fn=>fn(c.SM.d),smNovos:(dias,texto,area,sub,det)=>[{id:'nova',dia:dias[0],texto,area,det}],
    tituloTarefa,tituloIdeia,console});
  vm.runInContext(fonte.slice(fonte.indexOf('async function smIdeiasSync(forca){'),fonte.indexOf('smIdeiasSync(true);')),c);
  await c.smIdeiasSync(true);
  assert.equal(tarefas[0].texto,'O app abrisse mais rápido');
  assert.equal(tarefas[0].det,'eu queria que o app abrisse mais rápido. Detalhes completos.');
  assert.equal(tarefas[0].dia,'sem');assert.equal(tarefas[0].area,'ferramenta');
  await c.smIdeiasSync(true);assert.equal(tarefas.length,1);
});
