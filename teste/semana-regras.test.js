const {test}=require('node:test');
const assert=require('node:assert/strict');
const {ordenarTarefas,tarefasAtrasadas,normalizarAgenda,dedupeAgenda,lembreteTarefa,tarefasNativas}=require('../build/interpretar.js');
test('ordena U > alta > média > baixa > sem prioridade, sem separar por tipo',()=>{
  const tarefas=[{id:'baixa',prioridade:'baixa',ordem:0},{id:'sem'},{id:'alta',prioridade:'alta',area:'tarefas'},{id:'media',prioridade:'media',area:'estudo'},{id:'u',urg:true},{id:'alta2',prioridade:'alta',ordem:2}];
  const antes=JSON.stringify(tarefas);assert.deepEqual(ordenarTarefas(tarefas).map(t=>t.id),['u','alta','alta2','media','baixa','sem']);assert.equal(JSON.stringify(tarefas),antes);
});
test('atrasadas incluem todo o passado pendente; excluem sem data, próxima, feitas e datas inválidas',()=>{
  const lista=[{dia:'2020-01-01'},{dia:'2026-10-25'},{dia:'2026-10-25',feito:true},{dia:'sem'},{dia:'proxima'},{dia:'2026-02-30'},{dia:'2026-10-26'},{dia:'2026-10-27'}];
  assert.deepEqual(tarefasAtrasadas(lista,'2026-10-26'),lista.slice(0,2));
});
const agenda=[
  {titulo:'Plantão',inicio:'2026-10-26T18:00',fim:'2026-10-27T07:00',diaInteiro:false},
  {titulo:'Prova',inicio:'2026-10-26T00:00',fim:'2026-10-27T00:00',diaInteiro:true},
  {titulo:'plantão',inicio:'2026-10-26T18:00',fim:'2026-10-27T07:00'},
  {titulo:'Outro dia',inicio:'2026-10-28T12:00',fim:'2026-10-28T13:00'},
];
test('agenda deduplica por título normalizado no dia, preservando a versão manual',()=>{
  const antes=JSON.stringify(agenda);assert.deepEqual(dedupeAgenda(agenda,[{t:'  PLANTÃO  '}],'2026-10-26').map(e=>e.titulo),['Prova']);assert.equal(JSON.stringify(agenda),antes);
  assert.deepEqual(dedupeAgenda(agenda,[],'2026-10-28').map(e=>e.titulo),['Outro dia']);
});
test('plantão noturno aparece nos dois dias; fim de dia inteiro é exclusivo',()=>{
  assert.deepEqual(dedupeAgenda(agenda,[],'2026-10-27').map(e=>e.titulo),['Plantão']);
  assert.equal(dedupeAgenda([{titulo:'Noite',inicio:'2026-10-26T18:00',fim:'2026-10-27T00:00:00.000'}],[],'2026-10-27').length,0);
  assert.equal(dedupeAgenda([{titulo:'Dia',inicio:'2026-10-26',fim:'2026-10-26',diaInteiro:true}],[],'2026-10-26').length,1);
  assert.deepEqual(dedupeAgenda([null,{titulo:'inválido',inicio:'x'}],[],'2026-10-26'),[]);
});
test('agenda atual aceita objeto com eventos, avisos e metadados, mantendo o formato antigo',()=>{
  const entrada={atualizado:'2026-10-26T10:00:00Z',eventos:agenda,avisos:['Escala provisória','',null]},antes=JSON.stringify(entrada);
  assert.deepEqual(normalizarAgenda(entrada),{atualizado:entrada.atualizado,eventos:agenda,avisos:['Escala provisória']});
  assert.deepEqual(dedupeAgenda(entrada,[{t:'plantão'}],'2026-10-26').map(e=>e.titulo),['Prova']);
  assert.deepEqual(normalizarAgenda(agenda),{eventos:agenda,avisos:[],atualizado:null});
  assert.deepEqual(normalizarAgenda(null),{eventos:[],avisos:[],atualizado:null});
  assert.equal(JSON.stringify(entrada),antes);
});
test('lembrete usa ISO local, atravessa meia-noite e é opcional',()=>{
  assert.equal(lembreteTarefa({dia:'2026-11-01',hora:'00:10',lembrete:15}),'2026-10-31T23:55');
  assert.equal(lembreteTarefa({dia:'2026-10-26',hora:'09:00',lembrete:0}),'2026-10-26T09:00');
  assert.equal(lembreteTarefa({dia:'2026-10-26',hora:'09:00',lembrete:60}),'2026-10-26T08:00');
  for(const t of [{dia:'sem',hora:'09:00',lembrete:0},{dia:'2026-10-26',lembrete:15},{dia:'2026-10-26',hora:'09:00'},{dia:'2026-10-26',hora:'24:00',lembrete:0}])assert.equal(lembreteTarefa(t),null);
});
test('ponte inclui hoje a +14 dias inclusive, com o contrato exato e tarefas feitas',()=>{
  const dados=tarefasNativas([{id:1,texto:'💡 Tarefa',dia:'2026-10-26',urg:true},{id:2,texto:'Fim',dia:'2026-11-09',feito:true,prioridade:'media',hora:'08:00',lembrete:15},{id:3,dia:'2026-11-10'},{id:4,dia:'2026-10-25'},{id:5,dia:'sem'}],'2026-10-26');
  assert.deepEqual(dados,[{id:'1',titulo:'Tarefa',data:'2026-10-26',hora:null,lembrete:null,feita:false,prioridade:'u'},{id:'2',titulo:'Fim',data:'2026-11-09',hora:'08:00',lembrete:'2026-11-09T07:45',feita:true,prioridade:'media'}]);
});
