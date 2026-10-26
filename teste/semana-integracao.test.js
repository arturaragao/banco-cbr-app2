const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const fonte=['interpretar','semana'].map(n=>fs.readFileSync(require.resolve('../build/'+n+'.js'),'utf8')).join('\n');
const copia=x=>JSON.parse(JSON.stringify(x));
async function app(tarefas=[],nativo=false){
  const inicial={v:2,dias:{},tarefas:copia(tarefas)},salvos=[],avisos=[],recebidos=[],confirmados=[],elementos=new Map(),tempos=[],mem=new Map([['sm_cache2',JSON.stringify({sha:'s0',d:inicial})]]);
  const estado={remoto:copia(inicial),pendentes:[],conflito:false,falhar:false};
  const el=tag=>({tagName:tag.toUpperCase(),children:[],setAttribute(k,v){this[k]=v},append(...xs){this.children.push(...xs)},remove(){elementos.delete(this.id)}});
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
    tela:'semana',render(){},toast:m=>avisos.push(m),cfg:{diario:10},PARAM:{},log:[],DAY:86400000,metaHoje:()=>10,metaDia:()=>10,
    esc:s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),URL,Blob,
  });
  vm.runInContext(fonte,c);await vm.runInContext('smCarga',c);await new Promise(r=>setImmediate(r));
  return{c,estado,salvos,avisos,recebidos,confirmados,elementos,tempos,mem,lista:()=>copia(vm.runInContext('SM.d.tarefas',c)),fila:()=>vm.runInContext('SM.fila',c)};
}
test('quadro tem sete dias seg→dom, tarefas ordenadas, eventos antes e faixa no topo',async()=>{
  const a=await app([{id:'baixa',dia:'2026-10-26',texto:'Baixa',prioridade:'baixa'},{id:'u',dia:'2026-10-26',texto:'Urgente',urg:true},{id:'velha',dia:'2020-01-01',texto:'Vencida'}]);
  vm.runInContext("SM.d.dias['2026-10-26']={ev:[{id:'e',t:'Evento',c:'azul'}]}",a.c);
  const html=a.c.vSemana();assert.equal((html.match(/<section class="sm-dia /g)||[]).length,7);
  assert.ok(html.indexOf('Seg 26/10')<html.indexOf('Dom 1/11'));
  assert.ok(html.indexOf('Evento')<html.indexOf('Urgente'));assert.ok(html.indexOf('Urgente')<html.indexOf('Baixa'));
  assert.ok(html.indexOf('Passar tudo para hoje')<html.indexOf('id="sm_quadro"'));
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
  vm.runInContext("Object.assign(QA,{texto:'comprar ração sexta 9h30 !alta #pacs',prioridade:'baixa',hora:'10:00',lembrete:'15',det:'Marca habitual'})",a.c);
  assert.match(a.c.qaPrevTxt(),/30\/10 · 09:30 · alta/);
  assert.match(a.c.qaPrevTxt(),/#pacs/);
  a.c.qaSalvar();await a.fila();
  const t=a.lista()[0];assert.equal(t.texto,'Comprar ração');assert.equal(t.dia,'2026-10-30');assert.equal(t.hora,'09:30');assert.equal(t.prioridade,'alta');assert.equal(t.det,'Marca habitual');assert.deepEqual(t.etiquetas,['pacs']);
  assert.equal(a.recebidos.at(-1)[0].lembrete,'2026-10-30T09:15');
});
test('campos de Nova tarefa persistem no rascunho e entram na gravação pendente',async()=>{
  const a=await app();
  vm.runInContext("Object.assign(QA,{texto:'Revisar',on:true,prioridade:'media',hora:'08:30',lembrete:'60',repetir:{tipo:'semanal',dias:[2,4]}})",a.c);
  a.c.qaRascSalva({salvar:true});const r=JSON.parse(a.mem.get('bcbr_rasc_tarefa'));
  assert.equal(r.prioridade,'media');assert.equal(r.hora,'08:30');assert.equal(r.lembrete,'60');assert.deepEqual(r.repetir.dias,[2,4]);
  const html=a.c.qaExtrasHtml();for(const id of ['qa_prioridade','qa_hora','qa_lembrete','qa_repetir'])assert.ok(html.includes('id="'+id+'"'));
  assert.match(a.c.qaPrevTxt(),/27\/10 · 08:30 · média · toda semana/);
  a.c.smRascPend();await a.fila();const t=a.lista()[0];assert.equal(t.dia,'2026-10-27');assert.equal(t.prioridade,'media');assert.equal(t.lembrete,60);assert.deepEqual(t.repetir.dias,[2,4]);
});
test('agenda atual usa cor por tipo, local, avisos recolhíveis e dedupe dos manuais',async()=>{
  const a=await app();
  const tipos=['br','norte','hsi','br-manha','almoco','estagio','cobre-pos'];
  a.estado.agenda={atualizado:'2026-10-26T09:00:00Z',eventos:tipos.map(tipo=>({titulo:'Evento '+tipo,local:'Hospital',inicio:'2026-10-26T08:00',fim:'2026-10-26T09:00',tipo})),avisos:['Confirmar <troca>']};
  await a.c.smAgendaPuxar();const html=a.c.vSemana();
  for(const tipo of tipos)assert.ok(html.includes('c-escala-'+tipo));
  assert.ok(html.includes('Hospital'));assert.ok(html.includes('<details class="sm-avisos">'));assert.ok(html.includes('Confirmar &lt;troca>'));assert.ok(!html.includes('<details class="sm-avisos" open'));
  vm.runInContext("SM.d.dias['2026-10-26']={ev:[{id:'manual',t:'Evento br',c:'azul'}]}",a.c);
  const eventos=copia(vm.runInContext("smEvL('2026-10-26')",a.c));assert.equal(eventos.filter(e=>e.t==='Evento br').length,1);assert.equal(eventos[0].c,'azul');
  const editor=a.c.smEvEditor('2026-10-26');assert.ok(editor.includes('Escala · somente leitura'));assert.equal((editor.match(/onclick="smEvDel/g)||[]).length,1);
  assert.equal(JSON.parse(a.mem.get('sm_agenda')).avisos.length,1);
  delete a.estado.agenda;await a.c.smAgendaPuxar();assert.equal(vm.runInContext("smEvL('2026-10-26').length",a.c),1);assert.ok(!a.c.vSemana().includes('sm-avisos'));
});
