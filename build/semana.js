// ===== ABA SEMANA (pedido do Artur, 21/10/2026 — substitui o artefato "Minha Semana") =====
// Dados: semana/atual.json no repo privado banco-cbr-app (mesma chave do app). Histórico: semana/historico/<inicio>.json.
// A revisão de domingo (tarefa agendada do Claude) arquiva a semana e grava a nova. O resto é automático, sem tokens:
// contador de questões/acertos por dia (do log do banco), check "N questões" marcado sozinho, temas fracos, contagem até a prova.
const SM={d:null,sha:null,ok:false,erro:'',ed:null,add:{},dr:{},abertos:new Set(),passada:false,hist:undefined,fila:Promise.resolve(),auto:new Set(),fr:[]};
const SM_ARQ='semana/atual.json';
try{JSON.parse(localStorage.getItem('sm_abertos')||'[]').forEach(x=>SM.abertos.add(x))}catch(e){}
try{const c=JSON.parse(localStorage.getItem('sm_cache')||'null');if(c){SM.d=c.d;SM.sha=c.sha;SM.ok=true}}catch(e){}
const smDec=s=>decodeURIComponent(escape(atob(String(s).replace(/\n/g,''))));
const smId=()=>'x'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const smHoje=()=>dKey(Date.now());
const smDOW=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const smRot=iso=>{if(iso==='proxima')return'Próx. semana';const[y,m,d]=iso.split('-').map(Number);return smDOW[new Date(y,m-1,d).getDay()]+' '+d};
const smDt=iso=>{const[y,m,d]=iso.split('-').map(Number);return new Date(y,m-1,d)};
function smGuardaCache(){try{localStorage.setItem('sm_cache',JSON.stringify({sha:SM.sha,d:SM.d}))}catch(e){}}

async function smPuxar(){
  try{
    const f=await BCBR.api(`/repos/${BCBR.REPO}/contents/${SM_ARQ}`);
    SM.ok=true;SM.erro='';
    if(f.sha!==SM.sha){SM.d=JSON.parse(smDec(f.content));SM.sha=f.sha;smGuardaCache();smAuto();smRender()}
  }catch(e){SM.ok=true;if(e.status===404){SM.d=null;SM.sha=null}else SM.erro='Sem conexão com o GitHub agora; mostrando a última cópia do aparelho.';smRender()}
}
function smRender(){if(tela==='semana'||tela==='hoje')render()}
// toda mudança é uma função idempotente: aplica na hora e de novo na gravação (se outro aparelho mudou o arquivo, relê e reaplica)
function smMudar(fn,msg){
  if(!SM.d)return;fn(SM.d);smGuardaCache();render();
  const tarefa=async()=>{
    for(let t=0;t<6;t++){
      try{
        fn(SM.d);
        const body={message:'semana: '+(msg||'atualização'),content:BCBR.b64(JSON.stringify(SM.d,null,1)),branch:'main'};if(SM.sha)body.sha=SM.sha;
        const r=await BCBR.api(`/repos/${BCBR.REPO}/contents/${SM_ARQ}`,{method:'PUT',body:JSON.stringify(body)});
        SM.sha=r.content.sha;SM.erro='';smGuardaCache();return;
      }catch(e){
        if(e.status===409||e.status===422){try{const f=await BCBR.api(`/repos/${BCBR.REPO}/contents/${SM_ARQ}`);SM.d=JSON.parse(smDec(f.content));SM.sha=f.sha}catch(e2){}continue}
        SM.erro='Não salvou no GitHub ('+e.message+'). Confira a internet; a mudança fica neste aparelho.';smRender();return;
      }
    }
  };
  SM.fila=SM.fila.then(tarefa);
}

// ---------- questões do banco por dia ----------
function smQ(dia){let n=0,ok=0;log.forEach(l=>{if(dKey(l.t)===dia){n++;if(l.ok)ok++}});return{n,ok}}
const smMeta=t=>{if((t.area||'estudo')!=='estudo')return 0;const m=String(t.texto).match(/(\d+)\s*quest/i);return m?+m[1]:0};
function smAuto(){   // marca sozinho "30 questões" quando o banco chega à meta do dia
  if(!SM.d)return;const hj=smHoje(),marcar=[];
  SM.d.tarefas.forEach(t=>{const m=smMeta(t);if(!m||t.feito||t.dia>hj||SM.auto.has(t.id))return;if(smQ(t.dia).n>=m){SM.auto.add(t.id);marcar.push(t.id)}});
  if(marcar.length)smMudar(d=>d.tarefas.forEach(t=>{if(marcar.includes(t.id)&&!t.feito){t.feito=true;t.auto=true;t.feitoEm=new Date().toISOString()}}),'questões do dia (automático)');
}
function smFracos(){   // últimos 14 dias, temas com 3+ respostas e menos de 70% de acerto
  const ini=Date.now()-14*DAY,M={};
  log.forEach(l=>{if(l.t<ini)return;const q=QID[l.q];if(!q||!q._x)return;(q._x.t||[]).forEach(t=>{const x=M[t]??={t,n:0,ok:0};x.n++;if(l.ok)x.ok++})});
  return Object.values(M).filter(x=>x.n>=3&&x.ok/x.n<0.7).sort((a,b)=>a.ok/a.n-b.ok/b.n||b.n-a.n).slice(0,6);
}
function smTreinar(i){const x=SM.fr[i];if(x)iniciar(questoesTema(x.t),'estudo')}

// ---------- ações ----------
const smTar=id=>SM.d&&SM.d.tarefas.find(t=>t.id===id);
const smGrupo=t=>t.grupo?SM.d.tarefas.filter(x=>x.grupo===t.grupo):[t];
function smAbre(dia){SM.abertos.has(dia)?SM.abertos.delete(dia):SM.abertos.add(dia);try{localStorage.setItem('sm_abertos',JSON.stringify([...SM.abertos]))}catch(e){}render()}
function smCheck(id,v){smMudar(d=>{const t=d.tarefas.find(x=>x.id===id);if(t){t.feito=v;t.feitoEm=v?new Date().toISOString():null;if(!v)delete t.auto}},v?'feito':'desmarcado');if(!v)SM.auto.add(id)}
function smEdita(id){
  if(SM.ed&&SM.ed.id===id){SM.ed=null;render();return}
  const t=smTar(id);if(!t)return;SM.ed={id,esc:'todos',dias:new Set(smGrupo(t).map(x=>x.dia).filter(x=>x!=='proxima')),conf:false};render();
  const i=document.getElementById('sm_ed_txt');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length)}
}
function smChip(set,id){if(id==='*'){const ds=SM.d.dias.map(d=>d.id);if(ds.every(x=>set.has(x)))set.clear();else ds.forEach(x=>set.add(x))}else set.has(id)?set.delete(id):set.add(id);render()}
function smEdChip(id){SM.ed&&smChip(SM.ed.dias,id)}
function smEdEsc(v){if(SM.ed){SM.ed.esc=v;render()}}
function smEdConf(v){if(SM.ed){SM.ed.conf=v;render()}}
function smSalvar(){
  const t=smTar(SM.ed&&SM.ed.id);if(!t)return;
  const texto=document.getElementById('sm_ed_txt').value.trim(),area=document.getElementById('sm_ed_area').value;if(!texto)return;
  const g=smGrupo(t),ligado=g.length>1;
  if(ligado&&SM.ed.esc==='este'){const id=t.id;SM.ed=null;smMudar(d=>{const x=d.tarefas.find(y=>y.id===id);if(x){x.texto=texto;x.area=area}},'editou item');return}
  const dias=[...SM.ed.dias];if(!dias.length&&t.dia!=='proxima'){toast('Escolha pelo menos um dia (ou use Excluir).');return}
  const gid=t.grupo||(dias.length>1?'g'+smId():null),tem=new Set(g.map(x=>x.dia)),fora=g.filter(x=>x.dia!=='proxima'&&!SM.ed.dias.has(x.dia)).map(x=>x.id),ids=g.map(x=>x.id);
  const novos=dias.filter(dia=>!tem.has(dia)).map(dia=>({id:smId(),dia,texto,area,feito:false,ordem:100+SM.d.tarefas.filter(x=>x.dia===dia).length,...(gid?{grupo:gid}:{})}));
  SM.ed=null;
  smMudar(d=>{d.tarefas=d.tarefas.filter(x=>!fora.includes(x.id));d.tarefas.forEach(x=>{if(ids.includes(x.id)){x.texto=texto;x.area=area;if(gid)x.grupo=gid}});
    novos.forEach(n=>{if(!d.tarefas.some(x=>x.id===n.id))d.tarefas.push({...n})})},'editou item');
}
function smExcluir(){
  const t=smTar(SM.ed&&SM.ed.id);if(!t)return;const ids=(SM.ed.conf==='todos'?smGrupo(t):[t]).map(x=>x.id);SM.ed=null;
  smMudar(d=>{d.tarefas=d.tarefas.filter(x=>!ids.includes(x.id))},'excluiu item');
}
function smAdiar(id){   // passa para o próximo dia da semana (no último dia: "Próxima semana", que a revisão de domingo encaixa)
  const t=smTar(id);if(!t)return;const ds=SM.d.dias.map(d=>d.id),base=t.dia==='proxima'?null:(t.dia<smHoje()?smHoje():t.dia);
  const alvo=base?(ds.find(x=>x>base)||'proxima'):null;if(!alvo)return;SM.ed=null;
  smMudar(d=>{const x=d.tarefas.find(y=>y.id===id);if(!x||x.dia===alvo)return;
    if(x.grupo&&alvo!=='proxima'&&d.tarefas.some(y=>y.id!==id&&y.grupo===x.grupo&&y.dia===alvo)){d.tarefas=d.tarefas.filter(y=>y.id!==id);return}
    x.dia=alvo;x.feito=false;x.adiado=(x.adiado||0)+1;x.ordem=200+d.tarefas.filter(y=>y.dia===alvo).length;if(alvo==='proxima')delete x.grupo},'adiou item');
  toast(alvo==='proxima'?'Foi para a próxima semana':'Passou para '+smRot(alvo));
}
function smAddDias(dia){if(SM.add[dia])delete SM.add[dia];else SM.add[dia]=new Set([dia]);render()}
function smAddChip(dia,id){SM.add[dia]&&smChip(SM.add[dia],id)}
function smAdd(dia){
  const inp=document.getElementById('sm_add_'+dia),v=(inp&&inp.value||'').trim();if(!v)return;
  const area=document.getElementById('sm_area_'+dia).value,alvo=SM.add[dia]&&SM.add[dia].size?[...SM.add[dia]]:[dia],gid=alvo.length>1?'g'+smId():null;
  const novos=alvo.map(x=>({id:smId(),dia:x,texto:v,area,feito:false,ordem:100+SM.d.tarefas.filter(y=>y.dia===x).length,...(gid?{grupo:gid}:{})}));
  delete SM.add[dia];delete SM.dr['sm_add_'+dia];
  smMudar(d=>novos.forEach(n=>{if(!d.tarefas.some(x=>x.id===n.id))d.tarefas.push({...n})}),'novo item');
}
function smNota(){
  const i=document.getElementById('sm_nota'),v=(i&&i.value||'').trim();if(!v)return;
  const n={id:smId(),texto:v,em:new Date().toISOString(),...(document.getElementById('sm_fraco').checked?{fraco:true}:{})};delete SM.dr.sm_nota;
  smMudar(d=>{d.notas=d.notas||[];if(!d.notas.some(x=>x.id===n.id))d.notas.push(n)},'anotação');
}
function smNotaFraco(id){smMudar(d=>{const n=(d.notas||[]).find(x=>x.id===id);if(n){if(n.fraco)delete n.fraco;else n.fraco=true}},'tema fraco')}
function smNotaDel(id){smMudar(d=>{d.notas=(d.notas||[]).filter(x=>x.id!==id)},'apagou anotação')}
function smProva(v){if(!v)return;cfg.prova=v;persist('_est');render()}
async function smPassada(){
  SM.passada=!SM.passada;render();if(!SM.passada||SM.hist!==undefined)return;
  try{const l=await BCBR.api(`/repos/${BCBR.REPO}/contents/semana/historico`);const ant=l.filter(f=>/^\d{4}-\d\d-\d\d\.json$/.test(f.name)&&f.name.slice(0,10)<((SM.d&&SM.d.inicio)||'9')).sort((a,b)=>b.name.localeCompare(a.name))[0];
    SM.hist=ant?JSON.parse(await BCBR.raw(ant.sha)):null}catch(e){SM.hist=null}
  render();
}

// ---------- telas ----------
const smVal=(id,pad)=>esc(SM.dr[id]??pad??'');
function smChips(set,mk){return `<div class="sm-chips">${SM.d.dias.map(d=>`<button type="button" class="sm-chip" aria-pressed="${set.has(d.id)}" onclick="${mk(d.id)}">${smRot(d.id)}</button>`).join('')}<button type="button" class="sm-chip" aria-pressed="${SM.d.dias.every(d=>set.has(d.id))}" onclick="${mk('*')}">Todos</button></div>`}
function smEditor(t){
  const g=smGrupo(t),lig=g.length>1,todos=!lig||SM.ed.esc==='todos',prox=t.dia==='proxima',ultimo=!prox&&!SM.d.dias.some(d=>d.id>(t.dia<smHoje()?smHoje():t.dia));
  return `<div class="sm-ed">
   <div class="row"><input id="sm_ed_txt" value="${esc(t.texto)}" style="flex:1 1 200px;min-width:0" onkeydown="if(event.key==='Enter')smSalvar();if(event.key==='Escape'){SM.ed=null;render()}" aria-label="Texto">
    <select id="sm_ed_area" aria-label="Tipo"><option value="estudo" ${(t.area||'estudo')==='estudo'?'selected':''}>Estudo</option><option value="ferramenta" ${t.area==='ferramenta'?'selected':''}>Ferramenta</option></select></div>
   ${lig?`<div class="row"><span class="sm-lbl">Aplicar em</span><div class="sm-seg"><button type="button" aria-pressed="${SM.ed.esc==='este'}" onclick="smEdEsc('este')">Só neste dia</button><button type="button" aria-pressed="${SM.ed.esc==='todos'}" onclick="smEdEsc('todos')">Todos os ${g.length} dias</button></div></div>`:''}
   ${todos&&!prox?`<span class="sm-lbl">Dias</span>${smChips(SM.ed.dias,x=>`smEdChip('${x}')`)}`:''}
   ${SM.ed.conf?`<div class="row"><span class="sm-conf">${SM.ed.conf==='todos'?`Excluir dos ${g.length} dias?`:'Excluir este item?'}</span><span style="flex:1"></span><button class="b s sm-ghost" onclick="smEdConf(false)">Não</button><button class="b s sm-del" onclick="smExcluir()">Excluir</button></div>`
   :`<div class="row"><button class="b s sm-ghost" onclick="smAdiar('${t.id}')" ${prox?'disabled':''}>${ultimo?'Passar para a próxima semana':'Passar para o dia seguinte'}</button><button class="b s sm-danger" onclick="smEdConf('este')">${lig?'Excluir só deste dia':'Excluir'}</button>${lig?`<button class="b s sm-danger" onclick="smEdConf('todos')">De todos</button>`:''}<span style="flex:1"></span><button class="b s sm-ghost" onclick="SM.ed=null;render()">Cancelar</button><button class="b s" onclick="smSalvar()">Salvar</button></div>`}
  </div>`;
}
function smItem(t){
  const g=t.grupo?SM.d.tarefas.filter(x=>x.grupo===t.grupo):[t],ed=SM.ed&&SM.ed.id===t.id,m=smMeta(t),q=m&&t.dia!=='proxima'?smQ(t.dia):null;
  return `<div class="sm-row ${t.feito?'ok':''}"><label class="sm-it"><input type="checkbox" ${t.feito?'checked':''} onchange="smCheck('${t.id}',this.checked)"><span class="sm-tx">${esc(t.texto)}${g.length>1?` <span class="sm-tag">${g.filter(x=>x.feito).length}/${g.length} dias</span>`:''}${q&&q.n?` <span class="sm-tag ${q.n>=m?'g':''}">banco ${q.n}/${m}</span>`:''}${t.auto?' <span class="sm-tag g">automático</span>':''}${t.adiado?` <span class="sm-tag">adiado</span>`:''}</span></label>
   <button class="sm-edb" onclick="smEdita('${t.id}')" aria-label="Editar" aria-expanded="${!!ed}">✎</button></div>${ed?smEditor(t):''}`;
}
function smGrupos(its){return [['estudo','Estudo'],['ferramenta','Ferramenta']].map(([a,n])=>{const l=its.filter(t=>(t.area||'estudo')===a);return l.length?`<div class="sm-grp sm-${a}"><span class="sm-lbl">${n}</span>${l.map(smItem).join('')}</div>`:''}).join('')}
function smDia(d){
  const hj=smHoje(),its=SM.d.tarefas.filter(t=>t.dia===d.id).sort((a,b)=>(a.ordem??0)-(b.ordem??0)),ok=its.filter(t=>t.feito).length,q=smQ(d.id);
  const ab=SM.abertos.has(d.id)||d.id===hj,add=SM.add[d.id];
  return `<div class="card sm-dia ${d.id===hj?'hoje':''} ${d.id<hj?'passou':''}">
   <button class="sm-head" onclick="smAbre('${d.id}')" aria-expanded="${ab}"><span class="sm-dn">${smRot(d.id)}</span>${d.id===hj?'<span class="sm-pill">Hoje</span>':''}<span class="sm-ag">${esc(d.agenda||'')}</span>
    ${q.n?`<span class="sm-q" title="Questões feitas no banco">${q.n} q · ${pct(q.ok,q.n)}%</span>`:''}<span class="sm-ct ${its.length&&ok===its.length?'g':''}">${ok}/${its.length}</span></button>
   ${ab||d.id===hj?`<div class="sm-body">${smGrupos(its)}
    <div class="sm-add"><div class="row"><input id="sm_add_${d.id}" placeholder="Adicionar item" value="${smVal('sm_add_'+d.id)}" oninput="SM.dr[this.id]=this.value" onkeydown="if(event.key==='Enter')smAdd('${d.id}')" style="flex:1;min-width:0">
     <select id="sm_area_${d.id}" aria-label="Tipo"><option value="estudo">Estudo</option><option value="ferramenta">Ferramenta</option></select>
     <button class="b s sm-ghost" aria-pressed="${!!add}" onclick="smAddDias('${d.id}')">+ dias</button><button class="b s" onclick="smAdd('${d.id}')">+</button></div>
     ${add?smChips(add,x=>`smAddChip('${d.id}','${x}')`):''}</div></div>`:''}
  </div>`;
}
function smProvaCard(){
  const dd=diasProva();
  if(dd==null)return `<div class="card"><span class="kick">Prova</span><div class="row"><span class="mut">Data da prova:</span><input type="date" onchange="smProva(this.value)"></div></div>`;
  const r=_restantesFM(),m=metaDia(),hq=smQ(smHoje()).n;
  return `<div class="card sm-prova"><div class="sm-big"><b>${dd}</b><span>dias até a prova</span></div>
   <div class="sm-pv"><p><b>${r}</b> questões fáceis e médias ainda não vistas${m?` · meta <b>${m}/dia</b>`:''} · hoje <b>${hq}</b>${m?barra(pct(hq,m),hq>=m?'g':''):''}</p>
   <p class="mut">Prova em <input type="date" value="${esc(cfg.prova)}" onchange="smProva(this.value)" aria-label="Data da prova" class="sm-date"> · a meta reserva os últimos ${PARAM.revisao_final_dias??14} dias para rever erros.</p></div></div>`;
}
function smFracosCard(){
  SM.fr=smFracos();const man=(SM.d.notas||[]).filter(n=>n.fraco);
  if(!SM.fr.length&&!man.length)return '';
  return `<div class="card"><span class="kick">Temas fracos</span>
   ${SM.fr.length?`<p class="mut">Últimos 14 dias no banco (3+ respostas, menos de 70%).</p><div class="sm-fr">${SM.fr.map((x,i)=>`<div class="sm-frl"><span>${esc(x.t)}</span><span class="sm-q">${x.ok}/${x.n}</span><button class="b s" onclick="smTreinar(${i})">Treinar</button></div>`).join('')}</div>`:''}
   ${man.length?`<p class="mut">Que você marcou nas anotações:</p><ul class="sm-notas">${man.map(n=>`<li>${esc(n.texto)}</li>`).join('')}</ul>`:''}</div>`;
}
function smPassadaCard(){
  const ini=SM.d.inicio||(SM.d.dias[0]&&SM.d.dias[0].id);if(!ini)return'';
  let corpo='';
  if(SM.passada){
    const h=SM.hist,dias=h&&h.dias&&h.dias.length?h.dias.map(d=>d.id):Array.from({length:7},(_,i)=>{const x=smDt(ini);x.setDate(x.getDate()-7+i);return dKey(+x)});
    const qs=dias.map(id=>({id,...smQ(id)})),tn=qs.reduce((a,x)=>a+x.n,0),to=qs.reduce((a,x)=>a+x.ok,0),mx=Math.max(1,...qs.map(x=>x.n));
    const ts=h?h.tarefas||[]:[],f=ts.filter(t=>t.feito).length,fer=ts.filter(t=>t.area==='ferramenta'),nao=ts.filter(t=>!t.feito);
    corpo=`<div class="sm-body">
     <p><b>${tn}</b> questões · <b>${pct(to,tn)}%</b> de acerto${h?` · itens <b>${f}/${ts.length}</b> · ferramenta ${fer.filter(t=>t.feito).length}/${fer.length}`:''}</p>
     <div class="sm-bars">${qs.map(x=>`<div><i style="height:${Math.round(x.n/mx*100)}%" title="${x.n} questões"></i><span>${smRot(x.id).split(' ')[0]}</span><small>${x.n}</small></div>`).join('')}</div>
     ${SM.hist===undefined?'<p class="mut">Carregando…</p>':!h?'<p class="mut">O plano da semana passada ainda não está no histórico; os números acima vêm do banco.</p>':nao.length?`<p class="mut">Não feitos:</p><ul class="sm-notas">${nao.slice(0,8).map(t=>`<li>${esc(t.texto)} <span class="sm-tag">${smRot(t.dia)}</span></li>`).join('')}</ul>`:'<p class="mut">Tudo feito.</p>'}
    </div>`;
  }
  return `<div class="card sm-dia"><button class="sm-head" onclick="smPassada()" aria-expanded="${SM.passada}"><span class="sm-dn">Semana passada</span><span class="sm-ag"></span><span class="sm-ct">${SM.passada?'−':'+'}</span></button>${corpo}</div>`;
}
function vSemana(){
  if(!SM.ok)return `<div class="card"><p class="mut">Carregando a semana…</p></div>`;
  if(!SM.d)return `${smProvaCard()}<div class="card"><span class="kick">Semana</span><p class="mut">Nenhuma semana planejada ainda. A revisão de domingo às 20h monta a semana aqui.</p></div>`;
  setTimeout(smAuto,0);
  const ts=SM.d.tarefas.filter(t=>t.dia!=='proxima'),f=ts.filter(t=>t.feito).length,prox=SM.d.tarefas.filter(t=>t.dia==='proxima'),hj=smHoje(),ult=SM.d.dias.length?SM.d.dias[SM.d.dias.length-1].id:'';
  return `<div class="sm">
   <div class="card"><span class="kick">${esc(SM.d.subtitulo||'Plano da semana')}</span><h2 style="margin:0">${esc(SM.d.titulo||'Minha Semana')}</h2>
    <div class="row" style="flex-wrap:nowrap"><div style="flex:1">${barra(pct(f,ts.length))}</div><span class="sm-ct">${f}/${ts.length}</span></div>
    ${SM.d.regras?`<p class="mut" style="margin:0">${esc(SM.d.regras)}</p>`:''}
    ${hj>ult&&ult?'<p class="mut" style="margin:0">Esta semana acabou. A revisão de domingo monta a próxima aqui.</p>':''}
    ${SM.erro?`<p class="sm-err">${esc(SM.erro)}</p>`:''}</div>
   ${smProvaCard()}
   ${SM.d.dias.map(smDia).join('')}
   ${prox.length?`<div class="card"><span class="kick">Para a próxima semana</span><p class="mut">A revisão de domingo encaixa estes itens.</p>${prox.map(smItem).join('')}</div>`:''}
   ${smFracosCard()}
   <div class="card"><span class="kick">Anotações da semana</span><p class="mut">Temas que errou, ideias, o que travou. A revisão de domingo lê tudo.</p>
    <div class="row"><input id="sm_nota" placeholder="Ex.: errei 4 de contraste iodado" value="${smVal('sm_nota')}" oninput="SM.dr[this.id]=this.value" onkeydown="if(event.key==='Enter')smNota()" style="flex:1;min-width:0"><button class="b s" onclick="smNota()">Anotar</button></div>
    <label class="check"><input type="checkbox" id="sm_fraco"> marcar como tema fraco</label>
    <ul class="sm-notas">${(SM.d.notas||[]).slice().sort((a,b)=>(b.em||'').localeCompare(a.em||'')).map(n=>`<li><time>${smRot((n.em||'').slice(0,10)||hj)}</time><span style="flex:1;min-width:0">${esc(n.texto)}</span><button class="sm-tagb ${n.fraco?'on':''}" onclick="smNotaFraco('${n.id}')">tema fraco</button><button class="sm-edb" onclick="smNotaDel('${n.id}')" aria-label="Apagar">×</button></li>`).join('')}</ul></div>
   ${smPassadaCard()}
  </div>`;
}
// cartão na aba Hoje: itens de hoje com check, sem sair da tela
function smCardHoje(){
  if(!SM.d)return'';setTimeout(smAuto,0);const hj=smHoje(),its=SM.d.tarefas.filter(t=>t.dia===hj).sort((a,b)=>(a.ordem??0)-(b.ordem??0));if(!its.length)return'';
  return `<div class="card"><div class="row" style="justify-content:space-between"><span class="kick">Hoje na semana · ${its.filter(t=>t.feito).length}/${its.length}</span><button class="b s sm-ghost" onclick="go('semana')">Ver semana</button></div>
   ${its.map(t=>{const m=smMeta(t),q=m?smQ(hj):null;return `<label class="sm-it ${t.feito?'ok':''}"><input type="checkbox" ${t.feito?'checked':''} onchange="smCheck('${t.id}',this.checked)"><span class="sm-tx">${esc(t.texto)}${q?` <span class="sm-tag ${q.n>=m?'g':''}">banco ${q.n}/${m}</span>`:''}</span></label>`}).join('')}</div>`;
}
smPuxar();
setInterval(()=>document.visibilityState==='visible'&&smPuxar(),90000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){smPuxar();smAuto()}});
