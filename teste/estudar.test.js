const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const app=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const shim=fs.readFileSync(path.join(__dirname,'../shim.js'),'utf8');
function trecho(fonte,inicio,fim){
  const i=fonte.indexOf(inicio),j=fonte.indexOf(fim,i);
  assert.ok(i>=0&&j>i,`Trecho ausente: ${inicio}`);return fonte.slice(i,j);
}
function estudar(metodos){
  const c=vm.createContext({window:{METODOS_DADOS:metodos},console});
  vm.runInContext(`const norm=s=>String(s).normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase();
    const esc=s=>String(s??'').replaceAll('"','&quot;');
    let over={},cfg={nomes:{}},Q=[],log=[],srs={};const difDe=()=> 'm';`,c);
  vm.runInContext(trecho(app,'// ===== áreas do edital','// ===== dificuldade'),c);
  vm.runInContext(trecho(app,'function aplicaNomes(){','aplicaNomes();'),c);
  vm.runInContext(trecho(app,'function refQ(q){','// edições do usuário'),c);
  vm.runInContext(trecho(app,'let fl={','const clParse='),c);
  vm.runInContext(trecho(app,'function outrosFiltros(){','function vEstudar(){'),c);
  vm.runInContext(trecho(app,'function filtrar(){','function comecaFiltro'),c);
  return c;
}
function banco(c,qs){c.questoes=qs;vm.runInContext('Q=questoes;Q.forEach(refQ)',c)}
const q=(id,ar,tags=[])=>({id,ar,tags,gab:'A',enunciado:'Teste',cl:[]});
const fileiras=html=>[...html.matchAll(/class="trw ar [^"]*"[^>]*><i>▸<\/i><span class="nm">([^<]+)/g)].map(m=>m[1]);

test('Estudar ordena áreas pelo corpo e depois por incidência; omite usg e códigos sem rótulo',()=>{
  const c=estudar();
  const qs=['go','uro','dig','mama','tor','cp','neuro','dens','msk','ped'].map(a=>q(a,a));
  for(let i=0;i<6;i++)qs.push(q('msk'+i,'msk'));
  for(let i=0;i<3;i++)qs.push(q('ped'+i,'ped'));
  qs.push(q('antiga','usg'),q('sem','sem'),q('sem-gabarito','int'));
  qs.at(-1).gab=null;banco(c,qs);
  vm.runInContext("Q.push({...Q[0],id:'desconhecida',_a:'sem-rotulo'});cfg.nomes={'a|dig':'Sistema digestório','a|uro':'Sistema urogenital','a|go':'US em Ginecologia e Obstetrícia'};aplicaNomes()",c);
  assert.deepEqual(fileiras(c.arvoreTags()),['Neurorradiologia','Cabeça e pescoço','Tórax','Mama','Trato gastrointestinal','Trato urogenital','Ginecologia e Obstetrícia','Musculoesquelético','Pediatria','Densitometria Óssea','Sem classificação']);
  vm.runInContext("fl.area='dig'",c);assert.deepEqual(fileiras(c.arvoreTags()),['Trato gastrointestinal']);
  vm.runInContext("fl.area='';fl.tagq='pescoço'",c);assert.deepEqual(fileiras(c.arvoreTags()),['Cabeça e pescoço']);
  assert.ok(!c.outrosFiltros().includes('Tipo de conteúdo'));
  banco(c,[q('nomes','dig',['Sistema digestório','Sistema urogenital','US em Ginecologia e Obstetrícia'])]);
  assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(Q[0].tags)',c)),['Trato gastrointestinal','Trato urogenital','Ginecologia e Obstetrícia']);
});

test('metodos.json define associações múltiplas, contagens, filtros e ordem mesmo com seleção',()=>{
  const c=estudar({ordem:['RM','TC','US'],q:{a:['TC','RM','TC'],b:['RM'],d:['US'],inexistente:['US']}});
  banco(c,[q('a','neuro',['ultrassom']),q('b','tor',['radiografia']),q('c','neuro',['tomografia']),q('d','neuro'),{...q('e','neuro'),gab:null}]);
  let html=c.outrosFiltros();assert.ok(html.includes('RM 2'));assert.ok(html.includes('TC 1'));assert.ok(html.includes('US 1'));
  assert.ok(html.indexOf('RM 2')<html.indexOf('TC 1'));assert.ok(html.indexOf('TC 1')<html.indexOf('US 1'));
  assert.ok(!html.includes('USG'));assert.ok(!html.includes('RX'));assert.ok(!html.includes('Tipo de conteúdo'));
  vm.runInContext("fl.sel.m=['TC'];fl.status='todas'",c);
  assert.equal(vm.runInContext('filtrar().map(q=>q.id).join()',c),'a');
  html=c.outrosFiltros();assert.ok(html.indexOf('RM 2')<html.indexOf('TC 1'));
  vm.runInContext("fl.area='neuro'",c);html=c.outrosFiltros();assert.ok(html.includes('RM 1'));
  vm.runInContext("fl.tagq='US'",c);html=c.outrosFiltros();assert.ok(!html.includes('RM 1'));assert.ok(html.includes('TC 1'));assert.ok(html.includes('US 1'));
});

test('sem metodos.json, Estudar mantém classificação e contagens por tags',()=>{
  const c=estudar();banco(c,[q('a','neuro',['tomografia','anatomia radiologica']),q('b','tor',['ressonancia']),q('c','tor',['tomografia'])]);
  const html=c.outrosFiltros();assert.ok(html.includes('TC 2'));assert.ok(html.includes('RM 1'));assert.ok(!html.includes('Tipo de conteúdo'));
  vm.runInContext("fl.sel.m=['TC'];fl.status='todas'",c);assert.equal(vm.runInContext('filtrar().length',c),2);
});

test('metodos.json compartilha cache por SHA, atualização em fundo e abertura offline das questões',async()=>{
  const cache=new Map(),baixados=[],mt={ordem:['RM','TC'],q:{a:['TC','RM']}};
  let lista=[{name:'questoes.json',sha:'q1'},{name:'metodos.json',sha:'m1'}];
  const textos={q1:JSON.stringify([q('a','neuro')]),m1:JSON.stringify(mt),m2:JSON.stringify({ordem:['TC'],q:{a:['TC']}})};
  const c=vm.createContext({window:{},REPO:'privado/teste',api:async()=>lista,raw:async sha=>{baixados.push(sha);return textos[sha]},kvGet:async k=>cache.get(k),kvSet:async(k,v)=>cache.set(k,v),adaptar:u=>u});
  vm.runInContext(trecho(shim,'  async function carregarDados(fundo)','  // ---------- progresso:'),c);
  assert.equal(await c.carregarDados(),true);assert.deepEqual(JSON.parse(JSON.stringify(c.window.METODOS_DADOS)),mt);
  assert.deepEqual(baixados.sort(),['m1','q1']);assert.equal(await c.carregarDados(),false);assert.equal(baixados.length,2);
  lista[1].sha='m2';assert.equal(await c.carregarDados(true),true);assert.deepEqual(Array.from(c.window.METODOS_DADOS.ordem),['RM','TC']);
  c.api=async()=>{throw new Error('offline')};c.window={};assert.equal(await c.dadosDoCache(),true);
  assert.deepEqual(Array.from(c.window.METODOS_DADOS.ordem),['TC']);assert.equal(c.window.QUESTOES[0].id,'a');assert.equal(baixados.length,3);
  c.api=async()=>lista;lista=lista.slice(0,1);assert.equal(await c.carregarDados(true),true);
  assert.equal(await c.dadosDoCache(),true);assert.equal(c.window.METODOS_DADOS,null);
  assert.equal(await c.carregarDados(),false);assert.equal(baixados.length,3);
});
