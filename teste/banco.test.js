const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ler=p=>fs.readFileSync(require('node:path').join(__dirname,'..',p),'utf8');
const banco=ler('build/banco.js'),questoes=ler('build/questoes.js');
function contexto(){
  const c=vm.createContext({console});
  vm.runInContext(`const esc=String,md=String,isMeta=()=>false,verCom=()=>true;
    const AREA_BY={neuro:{nome:'Neuro'}},difTag=()=>'<span class="dif f">Fácil · ~70%</span>',
      prStats=()=>({}),acertoPR=()=>null,acertoDe=()=>70,prProvaBloco=()=>'',prAvisoBloco=()=>'',
      prDadosBloco=()=>'',prAlternativa=()=>'',pontoDe=q=>q.ponto,iaParse=s=>({rest:s});
    let log=[],QID={},q={id:'q1',_a:'neuro',_d:'f',classif:'claude',cl:['Tema','Subtema'],
      enunciado:'Enunciado completo',alts:{A:'Correta',B:'Errada',C:'C',D:'D',E:'E'},gab:'A',tags:['tag'],
      curso:{ponto:'PersonalRad',coment:{A:'Explicação do curso'}},coment:{A:'Explicação Claude'},
      claudeMd:'Comentário didático',ponto:'Conceito',origem:'extensao',chegou:'2026-10-26',
      imgs:['imagem'],legendas:['Legenda'],imgsCom:[]};QID.q1=q;
    const imgSrc=String;`,c);
  vm.runInContext(banco.slice(0,banco.indexOf('async function bBaixar')),c);
  vm.runInContext(banco.slice(banco.indexOf('function claudeMdBloco'),banco.indexOf('function mdFlash')),c);
  vm.runInContext(banco.slice(banco.indexOf('const gIdx='),banco.indexOf('function galVai')),c);
  vm.runInContext(questoes.slice(questoes.indexOf('function qDificuldade(q)')),c);
  return c;
}
test('Banco abre sem sessão e mostra questão, galeria, comentários, metadados e alternativas sem resposta',()=>{
  const c=contexto(),h=vm.runInContext('bCorpo(q)',c);
  for(const texto of ['Enunciado completo','gal_q1_q','Legenda','Gabarito: A','PersonalRad','Explicação do curso','Explicação Claude','Comentário didático','Conceito','Neuro › Tema › Subtema','Fácil · ~70%','tag','Não feita','pela extensão'])assert.ok(h.includes(texto),texto);
  assert.match(h,/class="alt ok /);
  assert.doesNotMatch(h,/escolher\(|responder\(|riscar\(|Fazer esta questão/);
  vm.runInContext("log=[{q:'q1',e:'B',ok:false,conf:'certeza'}]",c);
  const feita=vm.runInContext('bCorpo(q)',c);
  assert.match(feita,/class="alt bad /);assert.match(feita,/Feita · errou/);
});
test('toggle insere no primeiro clique, recupera corpo ausente e ignora nós antigos sem renderizar',()=>{
  const c=contexto();
  vm.runInContext(`let corpo='',insercoes=0;const el={open:true,isConnected:true,
    querySelector:()=>corpo?{remove:()=>corpo=''}:null,
    insertAdjacentHTML:(onde,h)=>{insercoes++;corpo=h}};bTog('q1',el);`,c);
  assert.equal(vm.runInContext('insercoes',c),1);
  vm.runInContext("bTog('q1',el);corpo='';bTog('q1',el)",c);
  assert.equal(vm.runInContext('insercoes',c),2);
  vm.runInContext("el.isConnected=false;el.open=false;bTog('q1',el)",c);
  assert.equal(vm.runInContext("bAbertos.has('q1')",c),true);
  vm.runInContext("el.isConnected=true;bTog('q1',el)",c);
  assert.equal(vm.runInContext("bAbertos.has('q1')",c),false);
  assert.equal(vm.runInContext('corpo',c),'');
});
