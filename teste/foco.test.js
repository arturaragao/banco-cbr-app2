const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ler=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function ctx(){const c=vm.createContext({console});vm.runInContext(ler('build/foco.js')+'\n;this.F={foCBR,focoCalc,foTab,foDifCmp,foSorteia};',c);vm.runInContext(ler('build/banco.js').slice(0,ler('build/banco.js').indexOf('async function bBaixar')).replace(/^let bq.*$/m,'').replace(/function bCorpo[\s\S]*?\n}\n/,'').replace(/function bStatus[^\n]*\n/,''),c);return c}
// dados fictícios: Neuro|A (4 CBR), Neuro|B (2 CBR), Torax|C (só banco geral, 1 sem fáceis/médias)
let seq=0;
const mk=(a,t,s,d,cbr,extra={})=>({id:'q'+(++seq),n:seq,gab:'A',_a:a,_d:d,cl:[t,s],pr_prova:cbr?{test:['Provas CBR'],year:['2025']}:{test:[]},pr_tags:{},...extra});
function dados(){
  seq=0;const Q=[];
  for(let i=0;i<4;i++)Q.push(mk('neuro','A','a1',i<3?'f':'m',true));
  for(let i=0;i<2;i++)Q.push(mk('neuro','B','b1','m',true));
  for(let i=0;i<3;i++)Q.push(mk('tor','C','c1','f',false));
  for(let i=0;i<2;i++)Q.push(mk('mama','D','d1','d',true));       // só difíceis: excluído
  Q.push(mk('sem','X','x','f',true));                              // fora da radiologia
  Q.push(mk('neuro','A','a1','f',true,{gab:null}));                // sem gabarito
  return Q}
test('foco: base, exclusão sem fáceis/médias, prioridade e meta',()=>{
  const c=ctx(),{focoCalc}=c.F,Q=dados();
  const F=focoCalc(Q,[],{orcamento:100});
  assert.equal(F.resumo.totC,8);assert.equal(F.resumo.totG,11);
  assert.equal(F.temas.map(t=>t.k).sort().join(),['neuro|A','neuro|B','tor|C'].join()); // mama|D excluído
  assert.equal(F.top[0].k,'neuro|A');
  const meta=F.top.reduce((a,t)=>a+t.meta,0);
  assert.ok(meta<=100);F.top.forEach(t=>assert.ok(t.meta<=t.restam));
  assert.equal(meta,9);                       // orçamento maior que tudo: meta = restantes (4+2+3)
  const peq=focoCalc(Q,[],{orcamento:5});
  assert.equal(peq.top.reduce((a,t)=>a+t.meta,0),5);peq.top.forEach(t=>assert.ok(t.meta<=t.restam));
  assert.ok(F.top.find(t=>t.k==='tor|C').viaGeral);
});
test('foco atualiza sozinho: nova resposta e nova questão mudam o resultado',()=>{
  const {focoCalc}=ctx().F,Q=dados();
  const a=focoCalc(Q,[],{orcamento:50}),ra=a.top.find(t=>t.k==='neuro|A');
  const log=[{q:Q[0].id,ok:0},{q:Q[1].id,ok:0}];
  const b=focoCalc(Q,log,{orcamento:50}),rb=b.top.find(t=>t.k==='neuro|A');
  assert.equal(rb.feitas,2);assert.equal(rb.restam,ra.restam-2);assert.ok(rb.erro>ra.erro);assert.equal(b.resumo.feitasC,2);
  const Q2=[...Q,mk('tor','NOVO','n','f',true)];
  const c2=focoCalc(Q2,log,{orcamento:50});
  assert.equal(c2.resumo.totC,a.resumo.totC+1);assert.ok(c2.temas.some(t=>t.k==='tor|NOVO'));
});
test('panorama e dificuldade: bases e ordenações',()=>{
  const {foTab,foDifCmp}=ctx().F,Q=dados();
  const cbr=foTab(Q,[],{nivel:'tema',base:'cbr'}),ger=foTab(Q,[],{nivel:'tema',base:'geral'});
  assert.equal(cbr.total,8);assert.equal(ger.total,11);assert.equal(cbr.rows[0].k,'neuro|A');
  assert.equal(foTab(Q,[],{nivel:'area',base:'geral',ordem:'rest'}).rows[0].q0._a,'neuro');
  assert.equal(foTab(Q,[],{nivel:'tema',base:'geral',ordem:'fac'}).rows[0].k,'tor|C');
  const D=foDifCmp(Q,[{q:Q[0].id,ok:1}]);assert.equal(D.nC,8);assert.equal(D.acerto.f,1);assert.equal(D.acerto.d,null);
});
test('foSorteia respeita o que resta e o total',()=>{
  const {foSorteia}=ctx().F,top=[{prio:3,restam:2},{prio:1,restam:50}];
  const c=foSorteia(top,10,()=>0);assert.equal(c[0],2);assert.equal(c[0]+c[1],10);
});
test('Banco: ordem decrescente por n, sem n no fim; filtro só CBR',()=>{
  const c=ctx(),L=[{n:3},{n:null},{n:10},{n:1},{}];
  c.L=L;const o=vm.runInContext('bOrdena(L).map(q=>q.n==null?"-":q.n).join()',c);
  assert.equal(o,'10,3,1,-,-');
  assert.equal(vm.runInContext('foCBR({pr_prova:{test:["Provas CBR"]}})&&!foCBR({pr_prova:{test:[]}})&&foCBR({pr_tags:{test:"Provas CBR"}})',c),true);
});
test('Painel: foco em primeiro e aparece sem respostas (receita)',()=>{
  const app=ler('app.js');
  assert.match(app,/const PN_BOXES=\[\['foco'/);
  assert.match(app,/if\(!log\.length\)return vFoco\(\)/);
  assert.match(app,/sv\.includes\('foco'\)\?r:\['foco'/);
  assert.match(app,/bOrdena\(Q\.filter/);
});
