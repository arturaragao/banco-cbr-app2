const {test}=require('node:test');
const assert=require('node:assert/strict');
const {interpretarTarefa}=require('../build/interpretar.js');
const hoje='2026-10-26'; // segunda
for(const [texto,esperado] of [
  ['plantão ter 18h',{texto:'Plantão',dia:'2026-10-27',hora:'18:00'}],
  ['estudar neuro amanhã',{texto:'Estudar neuro',dia:'2026-10-27'}],
  ['comprar ração sexta 9h30 !alta',{texto:'Comprar ração',dia:'2026-10-30',hora:'09:30',prioridade:'alta'}],
  ['questões todo dia',{texto:'Questões',dia:hoje,repetir:{tipo:'diaria'}}],
  ['dia 12/12 prova',{texto:'Prova',dia:'2026-12-12'}],
  ['daqui a 3 dias',{dia:'2026-10-29'}],
  ['atualizar !! #pacs',{texto:'Atualizar',prioridade:'alta',etiquetas:['pacs']}],
  ['revisar #PACS #pacs !média',{texto:'Revisar',prioridade:'media',etiquetas:['pacs']}],
  ['ler !baixa urgente',{texto:'Ler',urg:true,prioridade:'baixa'}],
  ['estudar dias úteis',{texto:'Estudar',dia:hoje,repetir:{tipo:'uteis'}}],
  ['revisar toda semana seg e qua',{texto:'Revisar',dia:hoje,repetir:{tipo:'semanal',dias:[1,3]}}],
  ['pagar todo mês',{texto:'Pagar',dia:hoje,repetir:{tipo:'mensal',diaMes:26}}],
  ['renovar dia 31 todo mês',{texto:'Renovar',dia:'2026-10-31',repetir:{tipo:'mensal',diaMes:31}}],
  ['nota sem data 25h',{texto:'Nota 25h',dia:'sem',hora:null}],
  ['prova 31/02',{texto:'Prova 31/02',dia:null}],
]) test(texto,()=>{const r=interpretarTarefa(texto,hoje);assert.equal(r.length,1);for(const [k,v] of Object.entries(esperado))assert.deepEqual(r[0][k],v,k)});
test('semana escolhida começa no próximo dia selecionado',()=>{
  assert.equal(interpretarTarefa('treino toda semana ter e qui',hoje)[0].dia,'2026-10-27');
  assert.equal(interpretarTarefa('estudar dias úteis','2026-10-31')[0].dia,'2026-11-02');
});
test('mais de uma tarefa mantém campos independentes',()=>{
  const r=interpretarTarefa('ler amanhã !! #pacs; correr sexta 8h !baixa',hoje);
  assert.equal(r.length,2);assert.equal(r[1].prioridade,'baixa');assert.deepEqual(r[1].etiquetas,[]);
  assert.deepEqual(interpretarTarefa('ação amanhã !!',hoje),interpretarTarefa('ação amanhã !!',hoje));
});
