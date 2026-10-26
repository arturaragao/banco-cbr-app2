// Executar: node teste/ri-dia.test.js (sem framework).
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const fonte=fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8');
const trecho=(inicio,fim)=>fonte.slice(fonte.indexOf(inicio),fonte.indexOf(fim,fonte.indexOf(inicio)));
for(const nome of ['riPreserva','riHoje','iniciaRI','mergeRemote']){
  assert.ok(fonte.includes('function '+nome+'('),'Função ausente no app remontado: '+nome);
}
const ctx=vm.createContext({assert,console});
const questoes=fs.readFileSync(require('node:path').join(__dirname,'../build/questoes.js'),'utf8');
const abre=questoes.slice(questoes.indexOf('function qAbre(){'),questoes.indexOf('function qTroca('));
assert.equal(trecho('function qAbre(){','function qTroca('),abre);
vm.runInContext(`
let dia='2026-10-26',cfg={diario:3,ri:null},all=[],log=[],sess=null,salvas=0,montagens=0,prova=true;
let Q=[],QID={},tela='quiz';
const dKey=()=>dia,modoProva=()=>prova,tamanhoRI=()=>cfg.diario;
const persist=()=>salvas++,hoje0=()=>0,render=()=>{};
const _pvBase=()=>({kS:()=>null,kT:()=>null}),pesoVolume=()=>1,PARAM={};
const prioridades=()=>({P:{a:1}}),srs={},DIF={f:{w:1}},embaralha=a=>a,DAY=86400000;
const sorteioPonderado=(pool,w,n)=>pool.slice(0,n);
function banco(ids){Q=ids.map(id=>({id,gab:'A',_a:'a',_d:'f'}));QID=Object.fromEntries(Q.map(q=>[q.id,q]))}
function revisaoDoDia(){montagens++;return prova?pacoteVolume(cfg.diario):revisaoDoDiaOrig()}
function iniciar(ids,modo){sess={ids:ids.filter(id=>QID[id]&&QID[id].gab),modo,resp:{},i:0}}
`,ctx);
vm.runInContext(abre,ctx);
vm.runInContext([
  trecho('function riPreserva(', 'function iniciaRI('),
  trecho('function iniciaRI(', 'function revisaoDoDiaOrig('),
  trecho('function revisaoDoDiaOrig(', '// ===== temas (Revisão Teórica)'),
  trecho('function pacoteVolume(', '// texto do cartão da Revisão Inteligente'),
  trecho('function mergeRemote(', 'async function iniciaSync('),
].join('\n'),ctx);
vm.runInContext(`
for(const modo of [true,false]){
  prova=modo;cfg={diario:3,ri:null};all=[];log=[];montagens=0;
  banco(['a','b']);
  const antes=[...riHoje()];assert.equal(antes.length,2);
  const resposta={q:antes[0],t:1,modo:'hoje',e:'A',conf:'certeza',ok:true};
  all.push(resposta);log.push(resposta);
  banco(['e','d','c','b','a']); // banco cresceu e veio em outra ordem
  const depois=[...riHoje()];
  assert.deepEqual(depois.slice(0,antes.length),antes);assert.equal(depois.length,3);
  assert.equal(new Set(depois).size,depois.length);assert.equal(montagens,1);
  iniciaRI();assert.equal(sess.resp[antes[0]].esc,'A');assert.equal(sess.i,1);
  cfg.diario=5;const maior=[...riHoje()];
  assert.deepEqual(maior.slice(0,depois.length),depois);assert.equal(maior.length,5);
  assert.equal(qAbre(),true);assert.deepEqual(sess.ids,maior);
  assert.equal(sess.resp[antes[0]].esc,'A');
  cfg.diario=1;assert.deepEqual(riHoje(),maior); // meta menor não encurta
  cfg.ri.v=1;cfg.ri.cal=false;banco(['e','d']);
  assert.deepEqual(riHoje(),maior); // versão/calendário/carga parcial não invalidam
  cfg.ri=JSON.parse(JSON.stringify(cfg.ri));assert.deepEqual(riHoje(),maior);
  const unida=riPreserva(cfg.ri,{d:dia,ids:['nova',...maior].reverse()});
  assert.deepEqual(unida.ids,[...maior,'nova']);
  assert.deepEqual(riPreserva(cfg.ri,null).ids,maior);
  cfg.ri=unida;cfg.diario=2;dia='2026-10-27';
  assert.equal(riHoje().length,2);assert.equal(montagens,2);
  dia='2026-10-26';
}
// Reabrir uma RI concluída também restaura todas as respostas.
cfg={diario:2,ri:{d:dia,ids:['d','e']}};banco(['d','e']);
log=['d','e'].map(q=>({q,t:1,modo:'hoje',e:'A',ok:true}));
iniciaRI();assert.equal(Object.keys(sess.resp).length,2);assert.equal(sess.i,0);
// Carga parcial não muda a lista salva nem desloca a próxima questão disponível.
cfg={diario:3,ri:{d:dia,ids:['ausente','d','e']}};banco(['d','e']);
log=[{q:'d',t:1,modo:'hoje',e:'B',ok:false}];
iniciaRI();assert.deepEqual(sess.ids,['d','e']);assert.equal(sess.i,1);
assert.equal(sess.resp.d.esc,'B');assert.deepEqual(cfg.ri.ids,['ausente','d','e']);
// Recarrega a configuração e o histórico persistidos, sem uma sessão em memória.
cfg=JSON.parse(JSON.stringify(cfg));log=JSON.parse(JSON.stringify(log));sess=null;
iniciaRI();assert.equal(sess.resp.d.esc,'B');assert.equal(sess.i,1);
// Executa a sincronização real: estado remoto novo não substitui a ordem local.
let estU=0,resetAt=0,over={},cards=[],pon={},uimg={},fcs={},ia={},metoU=0,estDirty=false;
const dirty=new Set(),normCfg=x=>({...x}),saveL=()=>{},wkKey=()=> 'semana';
const aplicaNomes=()=>{},reArea=()=>{},aplicaTema=()=>{},aplicaEdTodas=()=>{};
const recalc=()=>{},flush=()=>{},setSync=()=>{};
mergeRemote([{id:'estado',data:()=>({u:10,cfg:{diario:3,ri:{d:dia,ids:['e','nova','d']}}})}]);
assert.deepEqual(cfg.ri.ids,['ausente','d','e','nova']);
mergeRemote([{id:'estado',data:()=>({u:20,cfg:{diario:3,ri:null}})}]);
assert.deepEqual(cfg.ri.ids,['ausente','d','e','nova']);
`,ctx);
console.log('OK: RI preserva ordem/respostas e só cresce; reinicia apenas no dia seguinte (ambos os modos).');
