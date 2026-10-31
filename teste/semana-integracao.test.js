const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const appFonte=fs.readFileSync(require.resolve('../app.js'),'utf8');
const fixos=appFonte.slice(appFonte.indexOf('const DATA_PROVA='),appFonte.indexOf('let Q='));
assert.ok(fixos.includes('RI_DIARIA=50'));
const fonte=fixos+'\n'+['interpretar','semana'].map(n=>fs.readFileSync(require.resolve('../build/'+n+'.js'),'utf8')).join('\n');
const copia=x=>JSON.parse(JSON.stringify(x));
async function app(tarefas=[],nativo=false){
  const inicial={v:2,dias:{},tarefas:copia(tarefas)},salvos=[],avisos=[],recebidos=[],confirmados=[],elementos=new Map(),tempos=[],mem=new Map([['sm_cache2',JSON.stringify({sha:'s0',d:inicial})]]);
  const estado={remoto:copia(inicial),pendentes:[],conflito:false,falhar:false};
  const el=tag=>({tagName:tag.toUpperCase(),children:[],querySelector(){return null},querySelectorAll(){return []},setAttribute(k,v){this[k]=v},append(...xs){this.children.push(...xs)},remove(){elementos.delete(this.id)}});
  const document={visibilityState:'visible',addEventListener(){},querySelector(){return null},querySelectorAll(){return []},getElementById:id=>elementos.get(id)||null,createElement:el,body:{appendChild(x){elementos.set(x.id,x)},classList:{remove(){},add(){}}}};
  const B={tarefas:json=>recebidos.push(JSON.parse(json)),pendentes:()=>JSON.stringify(estado.pendentes),confirmar:json=>confirmados.push(JSON.parse(json)),dados(){}};
  const c=vm.createContext({console,document,window:{addEventListener(){},...(nativo?{BCBRNativo:B}:{})},navigator:{},
    localStorage:{getItem:k=>mem.get(k)||null,setItem:(k,v)=>mem.set(k,v),removeItem:k=>mem.delete(k)},
    setTimeout:(fn,ms)=>{tempos.push({fn,ms});return tempos.length},clearTimeout(){},setInterval(){},clearInterval(){},
    atob:s=>Buffer.from(s,'base64').toString('binary'),btoa:s=>Buffer.from(s,'binary').toString('base64'),
    Date:class extends Date{constructor(...args){super(...(args.length?args:['2026-10-26T12:00:00']))}static now(){return new Date('2026-10-26T12:00:00').getTime()}},
    dKey:n=>{const d=new Date(n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')},
    BCBR:{REPO:'privado/teste',b64:s=>Buffer.from(s).toString('base64'),api:async(path,opt)=>{
      if(path.endsWith('semana/plano.json')){
        if(opt?.method==='PUT'){
          if(estado.conflito){estado.conflito=false;estado.remoto.tarefas.push({id:'outro',texto:'Outro aparelho',dia:'2026-10-27'});throw Object.assign(new Error('conflito'),{status:409})}
          if(estado.falhar)throw Object.assign(new Error('offline'),{status:503});
          estado.remoto=JSON.parse(Buffer.from(JSON.parse(opt.body).content,'base64').toString());salvos.push(copia(estado.remoto));return{content:{sha:'s'+salvos.length}};
        }
        return{sha:salvos.length?'s'+salvos.length:'s0',content:Buffer.from(JSON.stringify(estado.remoto)).toString('base64')};
      }
      if(path.endsWith('semana/agenda.json')&&estado.agenda)return {sha:'agenda'+JSON.stringify(estado.agenda).length,content:Buffer.from(JSON.stringify(estado.agenda)).toString('base64')};
      throw Object.assign(new Error('não existe'),{status:404});
    }},
    tela:'semana',render(){},toast:m=>avisos.push(m),cfg:{diario:10},PARAM:{},log:[],DAY:86400000,metaHoje:()=>10,metaDia:()=>10,_restantesFM:()=>100,
    esc:s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),URL,Blob,
  });
  vm.runInContext(fonte,c);await vm.runInContext('smCarga',c);await new Promise(r=>setImmediate(r));
  return{c,estado,salvos,avisos,recebidos,confirmados,elementos,tempos,mem,lista:()=>copia(vm.runInContext('SM.d.tarefas',c)),fila:()=>vm.runInContext('SM.fila',c)};
}
test('semana usa grade ampliada, mantém Hoje e faixa de atrasadas e ordena tarefas',async()=>{
  const a=await app([{id:'baixa',dia:'2026-10-26',texto:'Baixa',prioridade:'baixa'},{id:'u',dia:'2026-10-26',texto:'Urgente',urg:true},{id:'velha',dia:'2020-01-01',texto:'Vencida'}]);
  vm.runInContext("SM.d.dias['2026-10-26']={ev:[{id:'e',t:'Evento',c:'azul'}]}",a.c);
  const html=a.c.vSemana();assert.equal((html.match(/class="sm-cel /g)||[]).length,7);
  assert.ok(html.includes('sm-grid sm-vsem'));assert.ok(!html.includes('sm-colunas'));assert.ok(!html.includes('sm_quadro'));
  assert.ok(html.indexOf('data-drop="2026-10-25"')<html.indexOf('data-drop="2026-10-26"'));
  assert.ok(html.indexOf('Evento')<html.indexOf('Urgente'));assert.ok(html.indexOf('Urgente')<html.indexOf('Baixa'));
  assert.ok(html.indexOf('Passar tudo para hoje')<html.indexOf('sm-grid sm-vsem'));
  assert.ok(!html.includes('Temas fracos'));assert.ok(!html.includes('💡'));assert.equal(a.lista()[2].dia,'2020-01-01');
  a.c.smRola();await a.fila();assert.equal(a.lista()[2].dia,'2026-10-26');
});
test('concluir e desfazer em 5 s remove próxima ocorrência intacta e notifica Android',async()=>{
  const a=await app([{id:'r',dia:'2026-10-26',texto:'Ler',feito:false,repetir:{tipo:'diaria'}}],true);
  await a.c.smCheck('r',true);assert.equal(a.lista().length,2);assert.equal(a.lista()[0].feito,true);
  assert.ok(a.tempos.some(t=>t.ms===5000));const barra=a.elementos.get('sm_dz');assert.equal(barra.children[0].textContent,'Concluída ·');
  barra.children[1].onclick();await a.fila();assert.equal(a.lista().length,1);assert.equal(a.lista()[0].feito,false);
  assert.equal(a.recebidos.at(-1)[0].feita,false);
});
test('conflito remoto reaplica conclusão e repetição uma vez e mantém tarefa do outro aparelho',async()=>{
  const a=await app([{id:'r',dia:'2026-10-26',texto:'Ler',feito:false,repetir:{tipo:'diaria'}}]);
  a.estado.conflito=true;await a.c.smCheck('r',true);
  assert.equal(a.lista().length,3);assert.equal(a.lista().filter(t=>t.id==='r~2026-10-27').length,1);assert.ok(a.lista().some(t=>t.id==='outro'));
});

test('Desfazer usa os ids realmente criados após conflito e reabre a original',async()=>{
  const a=await app([{id:'r',dia:'2026-10-26',texto:'Ler',feito:false,repetir:{tipo:'diaria'}}]);
  a.estado.remoto.tarefas[0].dia='2026-10-28';
  a.estado.remoto.tarefas.push({id:'r~2026-10-27',serie:'r',dia:'2026-10-27',texto:'Ler',feito:false,repetir:{tipo:'diaria'},subtarefas:[]});
  a.estado.conflito=true;await a.c.smCheck('r',true);
  assert.ok(a.estado.remoto.tarefas.some(t=>t.id==='r~2026-10-29'));
  vm.runInContext("smTar('r~2026-10-29').texto='Texto alterado'",a.c);
  a.elementos.get('sm_dz').children[1].onclick();await a.fila();
  assert.equal(a.estado.remoto.tarefas.find(t=>t.id==='r').feito,false);
  assert.deepEqual(a.estado.remoto.tarefas.map(t=>t.id),['r','r~2026-10-27','outro']);
});

test('widget só confirma conclusão gravada, inclusive cache feito e conflitos no retry',async()=>{
  const a=await app([{id:'r',dia:'2026-10-26',texto:'Ler',feito:false,repetir:{tipo:'diaria'}}],true);
  a.estado.pendentes=[{id:'widget-retry',tipo:'concluir',tarefa:'r'}];a.estado.falhar=true;
  a.c.smNativoImporta();await a.fila();await new Promise(r=>setImmediate(r));
  assert.equal(a.lista()[0].feito,true);assert.equal(a.estado.remoto.tarefas[0].feito,false);assert.equal(a.confirmados.length,0);
  a.estado.falhar=false;a.estado.conflito=true;
  const api=a.c.BCBR.api;let liberar,gravando;
  const iniciou=new Promise(r=>{gravando=r}),aguardar=new Promise(r=>{liberar=r});
  a.c.BCBR.api=async(path,opt)=>{if(opt?.method==='PUT'){gravando();await aguardar}return api(path,opt)};
  a.c.smNativoImporta();await iniciou;assert.equal(a.confirmados.length,0);liberar();
  await a.fila();await new Promise(r=>setImmediate(r));
  assert.equal(a.estado.remoto.tarefas.find(t=>t.id==='r').feito,true);
  assert.equal(a.estado.remoto.tarefas.filter(t=>t.id==='r~2026-10-27').length,1);
  assert.deepEqual(a.confirmados.at(-1),['widget-retry']);
  assert.ok(JSON.parse(a.mem.get('bcbr_nat_importados')).includes('widget-retry'));
});
test('widget conclui, repete, confirma após gravação e ignora reenvio',async()=>{
  const a=await app([{id:'r',dia:'2026-10-26',texto:'Ler',feito:false,repetir:{tipo:'diaria'}}],true);
  a.estado.pendentes=[{id:'widget1',tipo:'concluir',tarefa:'r'}];a.c.smNativoImporta();await a.fila();await new Promise(r=>setImmediate(r));
  assert.equal(a.lista().length,2);assert.equal(a.lista()[0].feito,true);assert.deepEqual(a.confirmados.at(-1),['widget1']);
  a.c.smNativoImporta();await a.fila();await new Promise(r=>setImmediate(r));assert.equal(a.lista().length,2);
});
test('pendência sem tarefa conhecida não é confirmada e falha de gravação pode ser repetida',async()=>{
  const a=await app([{id:'r',dia:'2026-10-26',texto:'Ler',feito:false,repetir:{tipo:'diaria'}}],true);
  a.estado.pendentes=[{id:'p',tipo:'concluir',tarefa:'r'},{id:'inexistente',tipo:'concluir',tarefa:'x'}];a.estado.falhar=true;
  a.c.smNativoImporta();await a.fila();await new Promise(r=>setImmediate(r));assert.equal(a.confirmados.length,0);
  a.estado.falhar=false;a.c.smNativoImporta();await a.fila();await new Promise(r=>setImmediate(r));
  assert.equal(a.lista().length,2);assert.deepEqual(a.confirmados.at(-1),['p']);
});
test('tipos antigos de pendência continuam entrando e retry não duplica nova tarefa',async()=>{
  const a=await app([],true);a.estado.pendentes=[{id:'voz1',texto:'Ler amanhã 9h !! #pacs',voz:true},{id:'ideia1',tipo:'ideia',texto:'Uma ideia'}];a.estado.falhar=true;
  a.c.smNativoImporta();await a.fila();await new Promise(r=>setImmediate(r));assert.equal(a.confirmados.length,0);
  a.estado.falhar=false;a.c.smNativoImporta();await a.fila();await new Promise(r=>setImmediate(r));
  assert.equal(a.lista().length,1);assert.equal(a.lista()[0].hora,'09:00');assert.equal(a.lista()[0].prioridade,'alta');assert.equal(a.lista()[0].texto,'Ler');
  assert.deepEqual(a.confirmados.at(-1),['voz1','ideia1']);assert.equal(vm.runInContext('smIdeiaNova',a.c),true);
});
test('mover tarefa preserva campos e atualiza lembrete enviado ao Android',async()=>{
  const a=await app([{id:'r',dia:'2026-10-26',texto:'Consulta',hora:'09:00',lembrete:60,subtarefas:[{id:'s',texto:'Documentos'}]}],true);
  a.c.smMover('r','2026-10-28');await a.fila();assert.equal(a.lista()[0].dia,'2026-10-28');assert.equal(a.lista()[0].subtarefas.length,1);
  assert.equal(a.recebidos.at(-1)[0].lembrete,'2026-10-28T08:00');
});
test('Nova tarefa salva texto natural com os mesmos dia, hora e prioridade da prévia',async()=>{
  const a=await app([],true);
  vm.runInContext("Object.assign(QA,{texto:'comprar ração sexta 9h30 !alta #pacs',quando:'2026-10-30',prioridade:'baixa',hora:'10:00',lembrete:'15',det:'Marca habitual'})",a.c);
  assert.match(a.c.qaPrevTxt(),/30\/10 · 09:30 · alta/);
  assert.match(a.c.qaPrevTxt(),/#pacs/);
  a.c.qaSalvar();await a.fila();
  const t=a.lista()[0];assert.equal(t.texto,'comprar ração sexta 9h30 !alta #pacs');assert.equal(t.dia,'2026-10-30');assert.equal(t.hora,'09:30');assert.equal(t.prioridade,'alta');assert.equal(t.det,'Marca habitual');assert.deepEqual(t.etiquetas,['pacs']);
  assert.equal(a.recebidos.at(-1)[0].lembrete,'2026-10-30T09:15');
});
test('campos de Nova tarefa persistem no rascunho e entram na gravação pendente',async()=>{
  const a=await app();
  vm.runInContext("Object.assign(QA,{texto:'Revisar',on:true,quando:'2026-10-27',prioridade:'media',hora:'08:30',lembrete:'60',repetir:{tipo:'semanal',dias:[2,4]}})",a.c);
  a.c.qaRascSalva({salvar:true});const r=JSON.parse(a.mem.get('bcbr_rasc_tarefa'));
  assert.equal(r.prioridade,'media');assert.equal(r.hora,'08:30');assert.equal(r.lembrete,'60');assert.deepEqual(r.repetir.dias,[2,4]);
  vm.runInContext('QA.passo=4;QA.alcance=6',a.c);
  const html=a.c.qaExtrasHtml();assert.ok(html.includes('id="qa_hora"'));assert.doesNotMatch(html,/Prioridade|Repetir|qa_prioridade|qa_repetir/);
  assert.match(a.c.qaPrevTxt(),/27\/10 · 08:30 · média · toda semana/);
  a.c.smRascPend();await a.fila();const t=a.lista()[0];assert.equal(t.dia,'2026-10-27');assert.equal(t.prioridade,'media');assert.equal(t.lembrete,60);assert.deepEqual(t.repetir.dias,[2,4]);
});
test('agenda mantém eventos e avisos; plantões viram apenas etiquetas sem horário',async()=>{
  const a=await app();
  const tipos=['br','norte','hsi','br-manha','almoco','estagio','cobre-pos'];
  a.estado.agenda={atualizado:'2026-10-26T09:00:00Z',eventos:tipos.map(tipo=>({titulo:'Evento '+tipo,local:'Hospital',inicio:'2026-10-26T08:00',fim:'2026-10-26T09:00',tipo})),avisos:['Confirmar <troca>']};
  await a.c.smAgendaPuxar();const html=a.c.vSemana();
  for(const tipo of tipos.filter(t=>!['br','hsi','br-manha'].includes(t)))assert.ok(html.includes('c-escala-'+tipo));
  for(const tipo of ['br','hsi','br-manha'])assert.ok(!html.includes('c-escala-'+tipo+'"'));
  assert.ok(html.includes('class="sm-nt br">BR</span>'));
  assert.ok(html.includes('Hospital'));assert.ok(html.includes('<details class="sm-avisos">'));assert.ok(html.includes('Confirmar &lt;troca>'));assert.ok(!html.includes('<details class="sm-avisos" open'));
  vm.runInContext("SM.d.dias['2026-10-26']={ev:[{id:'manual',t:'Evento norte',c:'azul'}]}",a.c);
  const eventos=copia(vm.runInContext("smEvL('2026-10-26')",a.c));assert.equal(eventos.filter(e=>e.t==='Evento norte').length,1);assert.equal(eventos[0].c,'azul');
  const editor=a.c.smEvEditor('2026-10-26');assert.ok(editor.includes('Escala · somente leitura'));assert.equal((editor.match(/onclick="smEvDel/g)||[]).length,1);
  assert.equal(JSON.parse(a.mem.get('sm_agenda')).avisos.length,1);
  delete a.estado.agenda;await a.c.smAgendaPuxar();assert.equal(vm.runInContext("smEvL('2026-10-26').length",a.c),1);assert.ok(!a.c.vSemana().includes('sm-avisos'));
});

test('HSI de sexta 13/11 a sábado 14/11 usa a mesma etiqueta, sem cartão nem horário',async()=>{
  const a=await app();
  a.estado.agenda={eventos:[{titulo:'Sobreaviso HSI',tipo:'hsi',inicio:'2026-11-13T22:00',fim:'2026-11-14T23:00'}]};
  await a.c.smAgendaPuxar();
  vm.runInContext("SM.d.dias['2026-11-13']={agenda:'Sobreaviso HSI 22h–7h30'};SM.semana='2026-11-09'",a.c);
  const html=a.c.smCalendario();
  for(const dia of ['2026-11-13','2026-11-14']){
    const cel=html.slice(html.indexOf('data-drop="'+dia+'"')).split('</button>')[0];
    assert.ok(cel.includes('<span class="sm-nt hsi">HSI</span>'));
    assert.ok(!cel.includes('class="sm-ev '));assert.ok(!cel.includes('<small>22:00'));
  }
  assert.equal(vm.runInContext("smNoite('2026-11-14')",a.c),'HSI');
  vm.runInContext("SM.d.dias['2026-11-14']={noite:''}",a.c);
  assert.equal(vm.runInContext("smNoite('2026-11-14')",a.c),'');
});

test('dia e Tarefas sem data recuperam grupos, ícones e cores, com prioridades e campos novos',async()=>{
  const tarefas=['2026-10-26','sem'].flatMap(dia=>[
    {id:dia+'b',dia,area:'estudo',texto:'Baixa',prioridade:'baixa'},
    {id:dia+'u',dia,area:'estudo',texto:'Urgente',urg:true},
    {id:dia+'f',dia,area:'ferramenta',texto:'Ferramenta',hora:'09:00',repetir:{tipo:'diaria'}},
    {id:dia+'t',dia,area:'tarefas',texto:'Tarefa',subtarefas:[{texto:'Uma etapa',feito:true}],anexos:[{nome:'Foto'}]},
  ]);
  const a=await app(tarefas);
  for(const html of [a.c.smPainelDia('2026-10-26'),a.c.smSemData()]){
    for(const [tipo,icone] of [['estudo','📚'],['ferramenta','🛠️'],['tarefas','✅']]){
      assert.ok(html.includes('sm-grp sm-'+tipo));assert.ok(html.includes(icone));
    }
    assert.ok(html.indexOf('Urgente')<html.indexOf('Baixa'));
    for(const texto of ['09:00','↻','1/1','1 anexo(s)'])assert.ok(html.includes(texto));
  }
});

test('meta do calendário recalcula saldo e dias de estudo, ignora valor salvo e não grava meta',async()=>{
  const a=await app();let restantes=230;a.c._restantesFM=()=>restantes;
  vm.runInContext("cfg.prova='2026-11-16';PARAM.revisao_final_dias=14;SM.d.dias['2026-10-26']={meta:999}",a.c);
  assert.equal(vm.runInContext('smProvaIso()',a.c),'2026-12-12');assert.equal(vm.runInContext('smRetaIni()',a.c),'2026-11-28');
  assert.equal(a.c.smMetaDe('2026-10-26'),10); // 23 dias úteis até 28/11, descontados 2/11 e 20/11
  assert.equal(a.c.smMetaDe('2026-10-27'),10);
  restantes=115;assert.equal(a.c.smMetaDe('2026-10-26'),5);
  vm.runInContext("SM.d.dias['2026-10-27']={tipo:'descanso'}",a.c);
  assert.equal(a.c.smMetaDe('2026-10-26'),6);assert.equal(a.c.smMetaDe('2026-10-27'),0);
  vm.runInContext("SM.d.dias['2026-10-31']={noite:'BR'}",a.c);
  assert.equal(a.c.smMetaDe('2026-10-26'),5);assert.equal(a.c.smMetaDe('2026-10-31'),5);
  assert.equal(a.c.smMetaDe('2026-12-12'),0);assert.equal(a.c.smMetaDe('2026-12-14'),0);
  restantes=0;assert.equal(a.c.smMetaDe('2026-10-26'),0);
  a.c.smAuto();await a.fila();assert.equal(a.salvos.length,0);
  vm.runInContext("cfg.prova='2026-10-30'",a.c);restantes=30;
  assert.equal(a.c.smMetaDe('2026-10-26'),2); // data gravada não adianta a reta final
  a.c.Date.now=()=>new Date('2026-11-30T12:00').getTime();
  assert.equal(a.c.smMetaDe('2026-11-30'),3); // reta final: dez dias úteis até a prova fixa
});

test('painel progressivo omite prioridade/repetir e salva só texto e tipo sem data',async()=>{
  const legado={id:'antiga',texto:'Legado',dia:'sem',prioridade:'alta',repetir:{tipo:'diaria'}};
  const a=await app([legado]);a.c.qaAbre();
  let html=a.c.qaHtml();assert.doesNotMatch(html,/Prioridade|Repetir|qa_prioridade|qa_repetir/);
  assert.match(html,/data-passo="1" hidden/);assert.match(html,/data-passo="2" hidden/);
  a.c.qaTxt('Revisar amanhã');
  const tecla=key=>a.c.qaTecla({key,target:{},preventDefault(){}});
  tecla('ArrowDown');assert.equal(vm.runInContext('QA.passo',a.c),1);
  tecla('ArrowRight');assert.equal(vm.runInContext('QA.area',a.c),'tarefas|Casamento');
  a.c.qaEscolhe('area','estudo',true);assert.equal(vm.runInContext('QA.passo',a.c),2);
  a.c.qaEscolhe('quando','sem');
  html=a.c.qaHtml();assert.match(html,/qa-resumo/);assert.match(html,/data-valor="sem"[^>]*aria-pressed="true"/);
  tecla('ArrowUp');assert.equal(vm.runInContext('QA.passo',a.c),1);
  tecla('Enter');await a.fila();
  const t=a.lista().at(-1);assert.equal(t.texto,'Revisar amanhã');assert.equal(t.area,'estudo');assert.equal(t.dia,'sem');
  assert.deepEqual(a.lista()[0],legado);assert.equal(a.lista().length,2);
});

test('setas do calendário escolhem data; chips de toque avançam e vários dias agrupam',async()=>{
  const a=await app();a.c.qaAbre();a.c.qaTxt('Consulta');a.c.qaPasso(2);
  a.c.qaEscolhe('quando','data',true);assert.equal(vm.runInContext('QA.passo',a.c),2);
  assert.equal((a.c.qaCalendario().match(/data-cal=/g)||[]).length,42);
  a.c.qaTecla({key:'ArrowDown',target:{dataset:{cal:'2026-10-26'}},preventDefault(){}});
  assert.equal(vm.runInContext('QA.quando',a.c),'2026-11-02');
  a.c.qaCalDia('2026-11-03',true);assert.equal(vm.runInContext('QA.passo',a.c),3);
  a.c.qaEscolhe('lembrete','15',true);assert.equal(vm.runInContext('QA.passo',a.c),4);
  a.c.qaPasso(2);a.c.qaEscolhe('quando','varios',true);
  a.c.qaMultiDia('2026-10-27');a.c.qaMultiDia('2026-10-29');a.c.qaSalvar();await a.fila();
  assert.deepEqual(a.lista().map(t=>t.dia),['2026-10-27','2026-10-29']);
  assert.equal(a.lista()[0].grupo,a.lista()[1].grupo);assert.equal(a.lista()[0].lembrete,15);
});

test('painel acompanha altura do teclado virtual, mantém rascunho no Esc e cores por tipo',async()=>{
  const a=await app();a.c.qaAbre();a.c.qaTxt('Texto preservado');
  const el=a.elementos.get('qa');el.style={setProperty(k,v){this[k]=v}};
  a.c.window.visualViewport={height:320,offsetTop:12};a.c.qaAjustaTela();
  assert.equal(el.style.height,'320px');assert.equal(el.style.top,'12px');assert.equal(el.style['--qa-altura'],'320px');
  vm.runInContext("SM.d.tipos=[...SM_TIPOS0,{id:'a',nome:'Pessoal'},{id:'b',nome:'Casa'},{id:'c',nome:'Trabalho'}]",a.c);
  assert.deepEqual(['tarefas','estudo','ferramenta','a','b','c'].map(a.c.qaCor),['#E9E3FF','#DCEBFF','#DDF5E8','#FFE4D6','#FFE0EC','#FFF4CC']);
  a.c.qaTecla({key:'Escape',preventDefault(){}});assert.equal(a.elementos.has('qa'),false);
  assert.equal(JSON.parse(a.mem.get('bcbr_rasc_tarefa')).texto,'Texto preservado');
  delete a.c.window.visualViewport;a.c.qaAbre();assert.equal(vm.runInContext('QA.texto',a.c),'Texto preservado');
});

test('setas horizontais editam campos; nome do novo tipo preserva todas as setas',async()=>{
  const a=await app();a.c.qaAbre();a.c.qaTxt('Consulta');
  const painel=a.elementos.get('qa');
  for(const [id,passo,value] of [['qa_in',0,'Consulta'],['qa_hora',4,'09:30'],['qa_tn',1,'Meu novo tipo']]){
    a.c.qaPasso(passo);
    const alvo={id,tagName:'INPUT',value,selectionStart:2,selectionEnd:2};
    const html=painel.innerHTML,area=vm.runInContext('QA.area',a.c);
    for(const key of id==='qa_tn'?['ArrowLeft','ArrowRight','ArrowUp','ArrowDown']:['ArrowLeft','ArrowRight']){
      let impedida=false;a.c.qaTecla({key,target:alvo,preventDefault(){impedida=true}});
      assert.equal(impedida,false,key+' em '+id);
      assert.equal(vm.runInContext('QA.passo',a.c),passo);
      assert.equal(vm.runInContext('QA.area',a.c),area);
      assert.equal(alvo.value,value);assert.equal(alvo.selectionStart,2);assert.equal(painel.innerHTML,html);
    }
  }
  for(const id of ['qa_in','qa_hora']){
    a.c.qaPasso(0);
    for(const [key,passo] of [['ArrowDown',1],['ArrowUp',0]]){
      let impedida=false;a.c.qaTecla({key,target:{id,tagName:'INPUT'},preventDefault(){impedida=true}});
      assert.equal(impedida,true);assert.equal(vm.runInContext('QA.passo',a.c),passo);
    }
  }
});

test('data digitada preseleciona Quando e conserva texto ao salvar e reabrir rascunho',async()=>{
  const a=await app();a.c.qaAbre();a.c.qaTxt('Consulta dia 20/11');
  assert.equal(vm.runInContext('QA.quando',a.c),'2026-11-20');
  a.c.qaPasso(2);assert.match(a.c.qaHtml(),/data-valor="data"[^>]*aria-pressed="true"/);
  assert.match(a.c.qaCalendario(),/data-cal="2026-11-20"[^>]*aria-pressed="true"/);
  assert.match(a.c.qaPrevTxt(),/20\/11/);
  a.c.qaFecha();a.c.qaAbre();assert.equal(vm.runInContext('QA.texto',a.c),'Consulta dia 20/11');
  assert.equal(vm.runInContext('QA.quando',a.c),'2026-11-20');
  a.c.qaSalvar();await a.fila();
  assert.equal(a.lista()[0].texto,'Consulta dia 20/11');assert.equal(a.lista()[0].dia,'2026-11-20');
  a.c.qaAbre();a.c.qaTxt('Consulta dia 20/11');a.c.qaCalDia('2026-11-22');
  a.c.qaTxt('Consulta dia 20/11 com documentos');assert.equal(vm.runInContext('QA.quando',a.c),'2026-11-22');
  a.c.qaEscolhe('quando','sem');a.c.qaFecha();a.c.qaAbre();a.c.qaTxt('Consulta dia 20/11 confirmada');
  assert.equal(vm.runInContext('QA.quando',a.c),'');
  a.c.qaSalvar();await a.fila();
  assert.equal(a.lista()[1].dia,'sem');assert.equal(a.lista()[1].texto,'Consulta dia 20/11 confirmada');
});

test('datas de várias tarefas preservam cada texto e escolhas explícitas do painel',async()=>{
  const a=await app();a.c.qaAbre();a.c.qaTxt('Consulta dia 20/11; Ligar amanhã');
  a.c.qaSalvar();await a.fila();
  assert.deepEqual(a.lista().map(t=>t.texto),['Consulta dia 20/11','Ligar amanhã']);
  assert.deepEqual(a.lista().map(t=>t.dia),['2026-11-20','2026-11-20']);
});

test('mudar mês só move visualização; escolher dia altera data e gravação',async()=>{
  const a=await app();a.c.qaAbre();a.c.qaTxt('Consulta');a.c.qaPasso(2);
  a.c.qaEscolhe('quando','data');a.c.qaCalDia('2026-11-20');
  const salvo=a.mem.get('bcbr_rasc_tarefa');
  for(const [n,cursor] of [[1,'2026-12-01'],[-1,'2026-11-01'],[-1,'2026-10-01'],[1,'2026-11-01']]){
    a.c.qaCalMes(n);assert.equal(vm.runInContext('QA.calCursor',a.c),cursor);
    assert.equal(vm.runInContext('QA.quando',a.c),'2026-11-20');
    assert.equal(a.mem.get('bcbr_rasc_tarefa'),salvo);assert.match(a.c.qaCalendario(),/Usar data · 20\/11/);
  }
  a.c.qaCalDia('2026-11-24',true);assert.equal(vm.runInContext('QA.quando',a.c),'2026-11-24');
  a.c.qaSalvar();await a.fila();assert.equal(a.lista()[0].dia,'2026-11-24');
});

test('Tab e Shift+Tab circulam apenas nos controles visíveis; Esc restaura o abridor',async()=>{
  const a=await app(),doc=a.c.document;
  const controle=(id,extra={})=>({id,tabIndex:0,focus(){doc.activeElement=this},closest(){return null},getClientRects(){return [{}]},...extra});
  for(const id of ['qa_fab','outro_abridor']){
    const abridor=controle(id,{isConnected:true});doc.activeElement=abridor;a.c.qaAbre();
    const painel=a.elementos.get('qa'),primeiro=controle('fechar'),meio=controle('qa_in'),ultimo=controle('limpar');
    const oculto=controle('oculto',{closest(){return {hidden:true}}}),desabilitado=controle('desabilitado',{disabled:true});
    const semTab=controle('dia_fora_do_cursor',{tabIndex:-1}),invisivel=controle('invisivel',{getClientRects(){return []}});
    painel.querySelectorAll=()=>[primeiro,oculto,desabilitado,semTab,invisivel,meio,ultimo];
    const tab=(origem,shiftKey,destino)=>{
      doc.activeElement=origem;let impedida=false;
      a.c.qaTecla({key:'Tab',target:origem,shiftKey,preventDefault(){impedida=true}});
      assert.equal(impedida,true);assert.equal(doc.activeElement,destino);
    };
    tab(ultimo,false,primeiro);tab(primeiro,true,ultimo);
    tab(primeiro,false,meio);tab(meio,true,primeiro);tab(abridor,false,primeiro);tab(abridor,true,ultimo);
    doc.activeElement=meio;a.c.qaAbre(); // Reabrir enquanto aberto não substitui o abridor.
    let impedida=false;a.c.qaTecla({key:'Escape',preventDefault(){impedida=true}});
    assert.equal(impedida,true);assert.equal(a.elementos.has('qa'),false);assert.equal(doc.activeElement,abridor);
  }
});
