const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const fonte=fs.readFileSync(path.join(__dirname,'../fonte/artefato-app.js'),'utf8');
const banco=fs.readFileSync(path.join(__dirname,'../build/banco.js'),'utf8');
const shim=fs.readFileSync(path.join(__dirname,'../shim.js'),'utf8');
const pr=fs.readFileSync(path.join(__dirname,'../build/personalrad.js'),'utf8');
const gerado=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
function trecho(s,a,b){const i=s.indexOf(a),j=s.indexOf(b,i);assert.ok(i>=0&&j>i,a);return s.slice(i,j)}
function contexto(){
  const c=vm.createContext({console});
  vm.runInContext(trecho(fonte,'const DIF=','let metoU='),c);
  vm.runInContext(`let pon={},all=[],Q=[],log=[];const classTags=()=>{},nomeArea=x=>x,areaDe=q=>q.ar;`,c);
  vm.runInContext(pr,c);
  vm.runInContext(trecho(fonte,'function refQ(q){','const aplicaEdTodas='),c);
  vm.runInContext(trecho(banco,'function prAcertoBloco(q){','function bCorpo(q){'),c);
  vm.runInContext(trecho(banco,'function pesoVolume(q){','function pacoteVolume('),c);
  vm.runInContext(trecho(banco,'function _restantesFM(){','function diasProva('),c);
  vm.runInContext(`const PARAM_STUB={};function _pvBase(){const i={m:{},me:1};return {iA:i,iT:i,iS:i,kA:()=>null,kT:()=>null,kS:()=>null,eA:{},eT:{},eS:{}}}`,c);
  return c;
}
const executar=(c,s)=>vm.runInContext(s,c);
function preparar(c,extra=''){
  executar(c,`let q={id:'q1',ar:'neuro',tags:[],enunciado:'Teste',alts:{A:'A'},gab:'A',classif:'claude',dif:'f',acerto:85,pr_stats:{acerto:20,respostas:15},dif_pr:'d',${extra}};aplicaEd(q);Q=[q]`);
}

test('estatística prevalece sobre classificação antiga; peso e meta usam dificuldade efetiva',()=>{
  const c=contexto();preparar(c);
  assert.equal(executar(c,'q._d'),'d');
  assert.equal(executar(c,'acertoDe(q)'),20);
  assert.equal(executar(c,'_restantesFM()'),0);
  const pesoD=executar(c,'pesoVolume(q)');
  executar(c,`pon['e:q1']={e:{dif:'f'}};aplicaEd(q)`);
  assert.equal(executar(c,'q._d'),'f');
  assert.equal(executar(c,'_restantesFM()'),1);
  assert.equal(executar(c,'pesoVolume(q)')/pesoD,40);
  assert.equal(executar(c,'DIF[q._d].meta'),95);
});

test('edição manual persiste ao reaplicar; removê-la restaura PersonalRad',()=>{
  const c=contexto();preparar(c);
  executar(c,`pon['e:q1']={e:{dif:'m'}};aplicaEd(q);aplicaEd(q)`);
  assert.equal(executar(c,'q._d'),'m');
  assert.equal(executar(c,'DIF[q._d].meta'),75);
  executar(c,`pon['e:q1']={e:null};aplicaEd(q)`);
  assert.equal(executar(c,'q._d'),'d');
  assert.equal(executar(c,'DIF[q._d].meta'),20);
  assert.equal(executar(c,'q.dif'),'f');
  assert.equal(executar(c,'q.acerto'),85);
});

test('14 respostas preservam nível; cortes incluem exatamente 30 e 60',()=>{
  const c=contexto();preparar(c,'pr_stats:{acerto:20,respostas:14}');
  assert.equal(executar(c,'q._d'),'f');
  executar(c,`q.dif_pr=null;q.pr_stats.respostas=15`);
  for(const [acerto,dif] of [[0,'d'],[30,'d'],[30.01,'m'],[59.99,'m'],[60,'f'],[70,'f'],[100,'f']]){
    assert.equal(executar(c,`q.pr_stats.acerto=${acerto};difDe(q)`),dif);
  }
  executar(c,'q.pr_stats.acerto=null');
  assert.equal(executar(c,'difDe(q)'),'f');
});

test('salvar texto não transforma acerto antigo em edição manual; acerto editado tem prioridade',()=>{
  const c=contexto();preparar(c);
  executar(c,`pon['e:q1']={e:{enunciado:'Outro',acerto:85}};aplicaEd(q)`);
  assert.equal(executar(c,'q._d'),'d');
  executar(c,`pon['e:q1'].e.acerto=80;aplicaEd(q)`);
  assert.equal(executar(c,'acertoDe(q)'),80);
  assert.equal(executar(c,'q._d'),'f');
  executar(c,`pon['e:q1'].e.dif='m';aplicaEd(q)`);
  assert.equal(executar(c,'q._d'),'m');
});

test('sem classificação por IA também usa dificuldade real e peso correspondente',()=>{
  const c=contexto();preparar(c,'classif:null,dif:null,acerto:null');
  assert.equal(executar(c,'q._d'),'d');
  assert.equal(executar(c,'_restantesFM()'),0);
  const peso=executar(c,'pesoVolume(q)');
  executar(c,`q.classif='claude'`);
  assert.equal(executar(c,'pesoVolume(q)'),peso);
});

test('ação no campo de acerto prevalece mesmo ao voltar ao original e após recarga',()=>{
  const c=contexto();preparar(c);
  executar(c,`const QID={q1:q};let sess={};
    const persist=()=>{},hk=()=>0,render=()=>{},toast=()=>{},clParse=()=>[];
    const campos={'#ed_a_A':'A','#ed_c_A':'','#ed_en':'Outro','#ed_g':'A','#ed_cl':'','#ed_ac':'85'};
    const $=s=>({value:campos[s]});`);
  executar(c,trecho(fonte,'function edSet(','Q.forEach(aplicaEd);'));
  executar(c,trecho(fonte,'function qEdita(','// ---- tags editáveis:'));
  const input=fonte.match(/<input id="ed_ac"[^>]*oninput="([^"]+)"/);
  assert.ok(input,'campo deve registrar a ação de edição');
  // Salvar somente texto não assume o acerto antigo como manual.
  executar(c,`qEdita('q1');qSalva('q1')`);
  assert.equal(executar(c,'acertoDe(q)'),20);
  assert.equal(executar(c,'q._d'),'d');
  for(const acerto of [80,85,0]){
    executar(c,`qEdita('q1');campos['#ed_ac']='${acerto}'`);
    executar(c,input[1]);
    executar(c,`qSalva('q1');pon=JSON.parse(JSON.stringify(pon));delete q._acertoManual;aplicaEd(q)`);
    assert.equal(executar(c,'acertoDe(q)'),acerto);
    assert.equal(executar(c,'q._d'),acerto===0?'d':'f');
    assert.equal(executar(c,`pon['e:q1'].e.acertoManual`),true);
  }
  // Restaurar original remove a prioridade; tocar o campo já em 85% a registra de novo.
  executar(c,`edSet('q1',null);qEdita('q1');campos['#ed_ac']='85'`);
  assert.equal(executar(c,'acertoDe(q)'),20);
  executar(c,input[1]);
  executar(c,`qSalva('q1');qEdita('q1');qSalva('q1');aplicaEd(q)`);
  assert.equal(executar(c,'acertoDe(q)'),85);
  assert.equal(executar(c,'q._d'),'f');
});

test('gabarito mostra somente acerto e N, incluindo 0%; sem dados não mostra nada',()=>{
  const c=contexto();preparar(c);
  assert.match(executar(c,'prAcertoBloco(q)'),/acerto dos alunos 20% \(15\)/);
  executar(c,'q.pr_stats.acerto=0');
  assert.match(executar(c,'prAcertoBloco(q)'),/acerto dos alunos 0% \(15\)/);
  executar(c,'q.pr_stats.respostas=0');
  assert.equal(executar(c,'prAcertoBloco(q)'),'');
  executar(c,'q.pr_stats=null');
  assert.equal(executar(c,'prAcertoBloco(q)'),'');
});

test('ponte de dados mantém estatísticas e dificuldade sem substituir campos antigos',()=>{
  const c=contexto();
  executar(c,trecho(shim,'const limpa =','// fundo=true:'));
  c.entrada=[{id:'q',alts:{A:'A'},pr_stats:{acerto:0,respostas:20},dif_pr:'d',dif:'f',acerto:85,dificuldade_site:'Difícil'}];
  assert.equal(executar(c,'adaptar(entrada)[0].pr_stats.acerto'),0);
  assert.equal(executar(c,'adaptar(entrada)[0].dif_pr'),'d');
  assert.equal(executar(c,'adaptar(entrada)[0].dif'),'f');
  assert.equal(executar(c,'adaptar(entrada)[0].acerto'),85);
});

test('pesos moderados: aviso, prova real e incidência normalizada, sem casamento é neutro',()=>{
  const c=contexto();preparar(c);
  assert.equal(executar(c,'pesoPR(q)'),1);
  executar(c,`q.pr_qualidade={needsReview:true};q.pr_prova={test:['Título CBR'],year:['2026']}`);
  assert.equal(executar(c,'pesoPR(q)'),.66);
  executar(c,`q.pr_qualidade={needsReview:false,reportsOpen:1}`);
  assert.equal(executar(c,'prAviso(q)'),true);
  executar(c,`q.pr_qualidade={reportsOpen:0};q.pr_prova={test:['Simulado CBR']}`);
  assert.equal(executar(c,'pesoPR(q)'),1);
  executar(c,`q.cl=['TÓRAX'];Q=[q,{cl:['Abdome']}];globalThis.TAXONOMIA_PR={termos:[
    {type:'theme',nome:' tórax ',questoes:10000},{type:'theme',nome:'Abdome',questoes:1},
    {type:'theme',nome:'Sem casamento',questoes:1e9}],arvores:[]}`);
  assert.ok(executar(c,'prPesoTema(q)')>1);
  assert.equal(executar(c,"prPesoTema({cl:['Abdome']})"),.8);
  assert.equal(executar(c,"prPesoTema({cl:['Desconhecido']})"),1);
  assert.ok(executar(c,'prPesoTema(q)')<=1.25);
  executar(c,`TAXONOMIA_PR={arvores:[{root:{type:'theme',label:'Tórax',questionsActiveCount:2,subtreeQuestionsActiveCount:50}}]}`);
  assert.equal(executar(c,"prContagens(TAXONOMIA_PR)['torax']"),50);
});

test('percentuais só após resposta; 0% é válido; metadados não viram tags',()=>{
  const c=contexto();preparar(c);
  executar(c,`const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
    q.pr_stats.alternativas={A:{percentual:0},B:{percentual:87.65}};
    q.pr_prova={test:['Título CBR'],year:['2026']}`);
  assert.equal(executar(c,"prAlternativa(q,'A',false)"),'');
  assert.match(executar(c,"prAlternativa(q,'A',true)"),/>0%</);
  assert.match(executar(c,"prAlternativa(q,'B',true)"),/87,65%/);
  assert.equal(executar(c,"prAlternativa(q,'C',true)"),'');
  assert.match(executar(c,'prProvaBloco(q)'),/Título CBR · 2026/);
  executar(c,trecho(shim,'const limpa =','// fundo=true:'));
  c.entrada=[{id:'q',alts:{A:'A'},tags:['Claude'],cl:['Tema'],pr_tags:{theme:['Site']},pr_prova:{year:['2026']},pr_qualidade:{needsReview:true}}];
  assert.equal(executar(c,"adaptar(entrada)[0].tags.join()"),'Claude');
  assert.equal(executar(c,"adaptar(entrada)[0].pr_tags.theme[0]"),'Site');
  assert.equal(executar(c,'adaptar(entrada)[0].pr_qualidade.needsReview'),true);
});

for(const [nome,script] of [['fonte',fonte],['app gerado',gerado]])test(`${nome}: pistas só com gabarito; correta verde, marcada errada vermelha e demais neutras`,()=>{
  const c=contexto();preparar(c);
  executar(c,`const esc=String,AREA_BY={neuro:{nome:'Neuro'}},AREAS=[],TES='';
    const etapaDe=()=>'',anoDe=()=>'',norm=x=>x,posDe=()=>1,keyLab=()=>'',tgHtml=q=>'Tags Claude',
      barra=()=>'',pct=()=>0,
    precisaConf=()=>false,imgSrc=()=>false,pontoBloco=()=>'',iaBloco=()=>'',cur=()=>q,selAtual=()=>sess.sel||null;
    const galeria=()=>'',comentAlt=()=>'',cursoBloco=()=>'',claudeMdBloco=()=>'',bannerResp=()=>'',
      blocoFeedback=(q,r,s)=>s,verCom=()=>true;
    const difTag=q=>'<span class="dif '+q._d+'">Dif</span>';
    let sess={i:0,ids:['q1'],resp:{},cut:{},nvOpen:true};
    q.alts={A:'Certa',B:'Errada marcada',C:'Outra errada'};q.gab='A';q.cl=['Tema Claude'];q.coment={};
    q.pr_stats.alternativas={A:{percentual:60},B:{percentual:30},C:{percentual:10}};
    q.pr_qualidade={reportsOpen:1};q.pr_prova={year:['2026']};q.pr_tags={theme:['NÃO EXIBIR']};`);
  executar(c,trecho(script,'function tituloQ(q','const TES='));
  executar(c,trecho(script,'function nvBloco(){','const DIFV='));
  executar(c,`const QID={q1:q};DIF.d.nome='Difícil';`);
  if(nome==='app gerado'){
    const helpers=fs.readFileSync(path.join(__dirname,'../build/questoes.js'),'utf8');
    executar(c,helpers.slice(helpers.indexOf('function qDificuldade(q)')));
  }
  executar(c,trecho(script,'function vQuiz(){','function reclass('));
  const antes=executar(c,'vQuiz()');
  assert.doesNotMatch(antes,/class="dif |acerto dos alunos|possível erro na questão|pr-percentual|NÃO EXIBIR|Tags Claude|Tema Claude|Neuro|por dificuldade|Difícil/);
  executar(c,`sess.sel='B'`);
  assert.doesNotMatch(executar(c,'vQuiz()'),/class="dif |acerto dos alunos|pr-percentual|Tags Claude|Tema Claude|Neuro|por dificuldade|Difícil/);
  executar(c,`sess.resp.q1={esc:'B',ok:false,conf:'certeza'}`);
  const depois=executar(c,'vQuiz()');
  assert.match(depois,/class="dif d"/);
  assert.match(depois,/acerto dos alunos 20%/);
  assert.match(depois,/possível erro na questão/);
  for(const texto of ['Tags Claude','Tema Claude','Neuro','por dificuldade','Difícil'])assert.ok(depois.includes(texto),texto);
  assert.match(depois,/class="alt ok [^"]*"[^]*?Certa[^]*?60%/);
  assert.match(depois,/class="alt bad [^"]*"[^]*?Errada marcada[^]*?30%/);
  assert.match(depois,/class="alt  [^"]*"[^]*?Outra errada[^]*?10%/);
  assert.doesNotMatch(depois,/NÃO EXIBIR/);
  executar(c,'sess.sim=true');
  assert.doesNotMatch(executar(c,'vQuiz()'),/class="dif |acerto dos alunos|pr-percentual|Tags Claude|Tema Claude|Neuro|por dificuldade|Difícil/);
});

test('pesos do site são aplicados uma vez também no sorteio de revisões',()=>{
  const c=contexto();preparar(c);
  executar(c,trecho(fonte,'function sorteioPonderado(','const embaralha='));
  executar(c,`q.pr_qualidade={needsReview:true};const outra={...q,id:'outra',pr_qualidade:null};
    Q=[q,outra];Math.random=()=>.3`);
  assert.equal(executar(c,'sorteioPonderado(Q,()=>1,1)[0].id'),'q1');
  assert.equal(executar(c,'sorteioPonderado(Q,pesoVolume,1,false)[0].id'),'q1');
  assert.ok(executar(c,'pesoVolume(q)<pesoVolume(outra)'));
});

test('taxonomia e simulados usam SHA, atualização em fundo e cache offline',async()=>{
  const cache=new Map(),baixados=[];
  let lista=[{name:'questoes.json',sha:'q'},{name:'taxonomia-pr.json',sha:'t1'},{name:'simulados-pr.json',sha:'s'}];
  const textos={q:'[]',t1:JSON.stringify({termos:[{type:'theme',nome:'Tórax',questoes:20}]}),
    t2:JSON.stringify({termos:[{type:'theme',nome:'Tórax',questoes:40}]}),s:JSON.stringify({items:[{id:'sim'}]})};
  const c=vm.createContext({window:{},REPO:'privado/teste',api:async()=>lista,
    raw:async sha=>{baixados.push(sha);return textos[sha]},kvGet:async k=>cache.get(k),kvSet:async(k,v)=>cache.set(k,v),adaptar:u=>u});
  executar(c,trecho(shim,'  async function carregarDados(fundo)','  // ---------- progresso:'));
  assert.equal(await c.carregarDados(),true);
  assert.equal(c.window.TAXONOMIA_PR.termos[0].questoes,20);
  assert.equal(c.window.SIMULADOS_PR.items[0].id,'sim');
  assert.equal(await c.carregarDados(),false);
  assert.equal(baixados.length,3);
  lista[1].sha='t2';assert.equal(await c.carregarDados(true),true);
  assert.equal(c.window.TAXONOMIA_PR.termos[0].questoes,20);
  c.window={};c.api=async()=>{throw Error('offline')};
  assert.equal(await c.dadosDoCache(),true);
  assert.equal(c.window.TAXONOMIA_PR.termos[0].questoes,40);
  assert.equal(c.window.SIMULADOS_PR.items[0].id,'sim');
  c.api=async()=>lista;lista=lista.slice(0,1);
  assert.equal(await c.carregarDados(true),true);await c.dadosDoCache();
  assert.equal(c.window.TAXONOMIA_PR,null);assert.equal(c.window.SIMULADOS_PR,null);
});
