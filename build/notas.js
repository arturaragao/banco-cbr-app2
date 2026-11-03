// Notas no mesmo plano das tarefas. Operações pendentes sobrevivem ao modo offline/reload.
const NT={busca:'',timer:null,sync:null};
const NT_PREFIX='bcbr_nota_pendente:';
function ntPendentes(){
  const ops=[];for(let i=0;i<localStorage.length;i++){
    const k=localStorage.key(i);if(!k?.startsWith(NT_PREFIX))continue;
    try{const op=JSON.parse(localStorage.getItem(k));if(op&&op.nota?.id)ops.push({...op,chave:k})}catch(e){}
  }return ops.sort((a,b)=>a.em-b.em||a.chave.localeCompare(b.chave));
}
const ntTemPendentes=()=>ntPendentes().length>0;
const ntCarimbo=n=>Date.parse(n?.atualizado||n?.em||'')||0;
const ntOpCarimbo=op=>ntCarimbo(op.nota)||Number(op.em)||0;
function ntConfirmada(d,op){
  const em=ntOpCarimbo(op),nota=d.notas?.find(n=>n.id===op.nota.id);
  return Date.parse(d.notasApagadas?.[op.nota.id]||'')>=em||!!nota&&(op.apagar?ntCarimbo(nota)>em:ntCarimbo(nota)>=em);
}
function ntAplica(d,ops){
  d.notas=d.notas||[];
  for(const op of ops){const id=op.nota.id,i=d.notas.findIndex(n=>n.id===id),em=ntOpCarimbo(op);
    const atual=i<0?0:ntCarimbo(d.notas[i]),apagada=Date.parse(d.notasApagadas?.[id]||'')||0;
    if(op.apagar){
      if(em<atual||em<apagada)continue;
      (d.notasApagadas=d.notasApagadas||{})[id]=new Date(em).toISOString();
      if(i>=0)d.notas.splice(i,1);
    }else{
      if(em<atual||em<=apagada)continue;
      const nota={...(i<0?{}:d.notas[i]),...op.nota,atualizado:new Date(em).toISOString()};
      if(i<0)d.notas.push(nota);else d.notas[i]=nota;
    }
  }
}
function ntMudar(nota,apagar=false){
  if(!SM.d)return;
  const pendentes=ntPendentes(),anteriores=pendentes.filter(x=>x.nota.id===nota.id);
  const atual=SM.d.notas?.find(n=>n.id===nota.id);
  const em=Math.max(Date.now(),ntCarimbo(atual)+1,(Date.parse(SM.d.notasApagadas?.[nota.id]||'')||0)+1,...pendentes.map(x=>ntOpCarimbo(x)+1));
  // Cada operação leva a nota completa e um carimbo estável, inclusive a exclusão.
  const bases=[...(atual?[atual]:[]),...anteriores.map(x=>x.nota)].sort((a,b)=>ntCarimbo(a)-ntCarimbo(b));
  const acumulada=apagar?{id:nota.id}:Object.assign({},...bases,nota);
  acumulada.atualizado=new Date(em).toISOString();
  const op={nota:acumulada,apagar,em},chave=NT_PREFIX+smId();
  // Só anuncia como salva depois de gravar a operação durável.
  try{localStorage.setItem(chave,JSON.stringify(op))}catch(e){toast('Sem espaço para salvar a nota neste aparelho.');return false}
  for(const anterior of anteriores)localStorage.removeItem(anterior.chave);
  ntAplica(SM.d,[op]);smGuardaCache();clearTimeout(NT.timer);NT.timer=setTimeout(ntSync,700);return true;
}
function ntSync(){
  if(NT.sync)return NT.sync;
  const ops=ntPendentes();if(!ops.length||!SM.d)return Promise.resolve(!ops.length);
  NT.sync=smMudar(d=>ntAplica(d,ops),'notas',salvo=>{
    // Confirma somente operações resolvidas no snapshot aceito pelo servidor.
    for(const op of ops)if(ntConfirmada(salvo,op))localStorage.removeItem(op.chave);
  }).finally(()=>{NT.sync=null;ntReordenar();if(ntTemPendentes()&&!SM.erro){clearTimeout(NT.timer);NT.timer=setTimeout(ntSync,700)}});
  return NT.sync;
}
function ntCriar(){
  const titulo=document.getElementById('nt_titulo').value.trim(),texto=document.getElementById('nt_texto').value.trim();
  if(!titulo&&!texto)return;
  const em=new Date().toISOString();
  if(ntMudar({id:smId(),titulo,texto,em,atualizado:em})){localStorage.removeItem('bcbr_nota_rascunho');render()}
}
function ntRascunho(){
  try{return JSON.parse(localStorage.getItem('bcbr_nota_rascunho')||'{}')}catch(e){return {}}
}
function ntRascSalva(){localStorage.setItem('bcbr_nota_rascunho',JSON.stringify({titulo:document.getElementById('nt_titulo').value,texto:document.getElementById('nt_texto').value}))}
function ntEditar(id,campo,valor){
  if(!['titulo','texto'].includes(campo))return;
  const n=SM.d?.notas?.find(n=>n.id===id);if(n)ntMudar({id,[campo]:valor,atualizado:new Date().toISOString()});
}
function ntFixar(id){const n=SM.d?.notas?.find(n=>n.id===id);if(n){ntMudar({id,fixa:!n.fixa,atualizado:new Date().toISOString()});render()}}
function ntApagar(id){if(confirm('Apagar esta nota?')){ntMudar({id},true);render()}}
function ntLista(){
  const q=NT.busca.toLocaleLowerCase('pt-BR');
  return [...(SM.d?.notas||[])].filter(n=>(String(n.titulo||'')+' '+String(n.texto||'')).toLocaleLowerCase('pt-BR').includes(q))
    .sort((a,b)=>Number(!!b.fixa)-Number(!!a.fixa)||String(b.atualizado||b.em||'').localeCompare(String(a.atualizado||a.em||''))||String(a.id).localeCompare(String(b.id)));
}
function ntGrade(){return ntLista().map(n=>`<article class="nt-nota" data-nota="${esc(n.id)}" onfocusout="setTimeout(ntReordenar,0)">
  <div class="row"><button class="sm-tagb" aria-label="Fixar nota" aria-pressed="${!!n.fixa}" onclick="ntFixar('${esc(n.id)}')">${n.fixa?'● Fixada':'○ Fixar'}</button><button class="sm-tagb" aria-label="Apagar nota" onclick="ntApagar('${esc(n.id)}')">Apagar</button></div>
  <input aria-label="Título da nota" placeholder="Sem título" value="${esc(n.titulo||'')}" oninput="ntEditar('${esc(n.id)}','titulo',this.value)">
  <textarea aria-label="Texto da nota" rows="6" oninput="ntEditar('${esc(n.id)}','texto',this.value)">${esc(n.texto||'')}</textarea>
  <small class="mut">${esc((n.atualizado||n.em||'').slice(0,10))}</small></article>`).join('')||'<p class="mut">Nenhuma nota encontrada.</p>'}
function ntBuscar(valor){NT.busca=valor;document.getElementById('nt_grade').innerHTML=ntGrade()}
function ntReordenar(){if(tela==='notas'&&!document.activeElement?.closest?.('.nt-nota')){const g=document.getElementById('nt_grade');if(g)g.innerHTML=ntGrade()}}
function vNotas(){
  if(!SM.d)return '<div class="card"><p class="mut">As notas ainda não estão disponíveis neste aparelho. Tente novamente com conexão.</p></div>';
  const r=ntRascunho();
  return `<div class="nt"><h2>Notas</h2>${SM.erro?'<p class="sm-err">Alterações salvas neste aparelho; sincronização pendente.</p>':''}
    <form class="nt-criar" onsubmit="event.preventDefault();ntCriar()"><input id="nt_titulo" aria-label="Título opcional" placeholder="Título (opcional)" value="${esc(r.titulo||'')}" oninput="ntRascSalva()"><textarea id="nt_texto" aria-label="Nova nota" placeholder="Anote uma ideia…" rows="3" oninput="ntRascSalva()">${esc(r.texto||'')}</textarea><button class="b" type="submit">Criar nota</button></form>
    <input type="search" aria-label="Buscar notas" placeholder="Buscar notas" value="${esc(NT.busca)}" oninput="ntBuscar(this.value)"><div id="nt_grade" class="nt-grade">${ntGrade()}</div></div>`;
}
if(SM.d){ntAplica(SM.d,ntPendentes());smGuardaCache()}
window.addEventListener('online',()=>{ntSync().then(()=>smPuxar())});
window.addEventListener('storage',e=>{if(e.key?.startsWith(NT_PREFIX)){if(SM.d)ntAplica(SM.d,ntPendentes());smRender()}});
