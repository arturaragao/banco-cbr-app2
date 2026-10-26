const {test}=require('node:test');
const assert=require('node:assert/strict');
const {proximaData,concluirTarefa}=require('../build/interpretar.js');
for(const [base,rep,esperado] of [
  ['2026-12-31',{tipo:'diaria'},'2027-01-01'],
  ['2026-10-30',{tipo:'uteis'},'2026-11-02'],
  ['2026-10-31',{tipo:'uteis'},'2026-11-02'],
  ['2026-11-02',{tipo:'uteis'},'2026-11-03'],
  ['2026-10-26',{tipo:'semanal',dias:[1,3,5]},'2026-10-28'],
  ['2026-10-30',{tipo:'semanal',dias:[1,3,5]},'2026-11-02'],
  ['2026-10-26',{tipo:'semanal'},'2026-11-02'],
  ['2026-01-31',{tipo:'mensal',diaMes:31},'2026-02-28'],
  ['2026-02-28',{tipo:'mensal',diaMes:31},'2026-03-31'],
  ['2028-01-31',{tipo:'mensal',diaMes:31},'2028-02-29'],
  ['2026-12-12',{tipo:'mensal'},'2027-01-12'],
  ['sem',{tipo:'diaria'},null],
  ['2026-02-30',{tipo:'diaria'},null],
  ['2026-10-26',{tipo:'desconhecida'},null],
])test(`próxima ${base} ${JSON.stringify(rep)}`,()=>assert.equal(proximaData(base,rep),esperado));
test('conclusão é imutável e idempotente, reinicia checklist e preserva nota/anexos',()=>{
  const t={id:'a',dia:'2026-10-26',texto:'Ler',repetir:{tipo:'diaria'},feito:false,urg:true,prioridade:'alta',hora:'09:30',lembrete:15,det:'Nota',etiquetas:['pacs'],anexos:[{nome:'foto.jpg'}],subtarefas:[{id:'s',texto:'Parte 1',feito:true}]};
  const entrada=JSON.stringify(t),l=concluirTarefa([t],'a','2026-10-26T10:00:00Z','2026-10-26');
  assert.equal(JSON.stringify(t),entrada);assert.equal(l.length,2);assert.equal(l[0].feito,true);
  const n=l[1];assert.equal(n.dia,'2026-10-27');assert.equal(n.feito,false);assert.equal(n.subtarefas[0].feito,false);
  for(const campo of ['det','anexos','hora','lembrete','prioridade','etiquetas'])assert.deepEqual(n[campo],t[campo]);
  assert.deepEqual(concluirTarefa(l,'a','outro instante','2026-10-26'),l);
});
test('conclusão atrasada pula ocorrências vencidas, sem criar todas as datas intermediárias',()=>{
  const l=concluirTarefa([{id:'a',dia:'2026-10-01',repetir:{tipo:'diaria'}}],'a','agora','2026-10-26');
  assert.equal(l.length,2);assert.equal(l[1].dia,'2026-10-27');
});

test('repetição pula datas ocupadas pelo mesmo grupo conforme cada regra',()=>{
  for(const [dia,repetir,ocupadas,alvo] of [
    ['2026-10-26',{tipo:'diaria'},['2026-10-27','2026-10-28'],'2026-10-29'],
    ['2026-10-30',{tipo:'uteis'},['2026-11-02'],'2026-11-03'],
    ['2026-10-26',{tipo:'semanal',dias:[1,3,5]},['2026-10-28','2026-10-30'],'2026-11-02'],
    ['2026-01-31',{tipo:'mensal'},['2026-02-28'],'2026-03-31'],
  ]) {
    const entrada=[{id:'r',grupo:'g',dia,repetir},...ocupadas.map((dia,i)=>({id:'ocupada'+i,grupo:'g',dia,feito:i===0})),{id:'outro-grupo',grupo:'outro',dia:alvo}];
    const antes=JSON.stringify(entrada),lista=concluirTarefa(entrada,'r','agora',dia);
    assert.equal(lista.at(-1).dia,alvo,JSON.stringify(repetir));assert.equal(lista.length,entrada.length+1);
    assert.equal(lista[0].feito,true);assert.equal(JSON.stringify(entrada),antes);
  }
});
test('tarefa antiga sem campos novos conclui sem repetir; mensal preserva dia de origem',()=>{
  assert.equal(concluirTarefa([{id:'a',dia:'sem'}],'a','agora','2026-10-26').length,1);
  const fev=concluirTarefa([{id:'a',dia:'2026-01-31',repetir:{tipo:'mensal'}}],'a','agora','2026-01-31');
  const mar=concluirTarefa(fev,fev[1].id,'agora','2026-02-28');
  assert.equal(mar[2].dia,'2026-03-31');
});
