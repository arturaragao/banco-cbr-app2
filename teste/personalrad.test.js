const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const fonte=fs.readFileSync(path.join(__dirname,'../fonte/artefato-app.js'),'utf8');
const banco=fs.readFileSync(path.join(__dirname,'../build/banco.js'),'utf8');
const shim=fs.readFileSync(path.join(__dirname,'../shim.js'),'utf8');
function trecho(s,a,b){const i=s.indexOf(a),j=s.indexOf(b,i);assert.ok(i>=0&&j>i,a);return s.slice(i,j)}
function contexto(){
  const c=vm.createContext({console});
  vm.runInContext(trecho(fonte,'const DIF=','let metoU='),c);
  vm.runInContext(`let pon={},all=[],Q=[],log=[];const classTags=()=>{},nomeArea=x=>x,areaDe=q=>q.ar;`,c);
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
