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
  const em=new Date().toISOString(),ordem=Math.min(0,...ntOrdenadas().map(ntChave))-1;   // nova nota entra no topo
  if(ntMudar({id:smId(),titulo,texto,em,atualizado:em,ordem})){localStorage.removeItem('bcbr_nota_rascunho');render()}
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
// Ordem manual (pedido do Artur, 05/11/2026): editar não muda a posição; arrastar pela alça reordena.
// Notas antigas sem `ordem` ficam pela data de criação (mais nova em cima).
const ntChave=n=>Number.isFinite(n.ordem)?n.ordem:-(Date.parse(n.em||n.atualizado||'')||0);
function ntOrdenadas(){
  return [...(SM.d?.notas||[])].sort((a,b)=>Number(!!b.fixa)-Number(!!a.fixa)||ntChave(a)-ntChave(b)||String(a.id).localeCompare(String(b.id)));
}
function ntLista(){
  const q=NT.busca.toLocaleLowerCase('pt-BR');
  return ntOrdenadas().filter(n=>(String(n.titulo||'')+' '+String(n.texto||'')).toLocaleLowerCase('pt-BR').includes(q));
}
function ntMover(id,ref,antes){
  if(!id||!ref||id===ref)return false;
  const l=ntOrdenadas(),n=l.find(x=>x.id===id);if(!n||!l.some(x=>x.id===ref))return false;
  const nova=l.filter(x=>x.id!==id);nova.splice(nova.findIndex(x=>x.id===ref)+(antes?0:1),0,n);
  const agora=new Date().toISOString();let mudou=false;
  nova.forEach((x,i)=>{const o=(i+1)*10;if(x.ordem!==o){ntMudar({id:x.id,ordem:o,atualizado:agora});mudou=true}});
  if(mudou)ntReordenar();return mudou;
}
function ntGrade(){return ntLista().map(n=>`<article class="nt-nota" data-nota="${esc(n.id)}" onfocusout="setTimeout(ntReordenar,0)">
  <div class="row"><span class="nt-alca" title="Arrastar para mudar a ordem" aria-hidden="true">⠿</span><span class="nt-acoes"><button class="sm-tagb" aria-label="Fixar nota" aria-pressed="${!!n.fixa}" onclick="ntFixar('${esc(n.id)}')">${n.fixa?'● Fixada':'○ Fixar'}</button><button class="sm-tagb" aria-label="Apagar nota" onclick="ntApagar('${esc(n.id)}')">Apagar</button></span></div>
  <input aria-label="Título da nota" placeholder="Sem título" value="${esc(n.titulo||'')}" oninput="ntEditar('${esc(n.id)}','titulo',this.value)">
  <textarea aria-label="Texto da nota" rows="2" oninput="ntAltura(this);ntEditar('${esc(n.id)}','texto',this.value)">${esc(n.texto||'')}</textarea>
  <small class="mut">${esc((n.atualizado||n.em||'').slice(0,10))}</small></article>`).join('')||'<p class="mut">Nenhuma nota encontrada.</p>'}
// Texto inteiro visível: a caixa cresce com o conteúdo (field-sizing no CSS; aqui o reserva para navegadores sem ele).
function ntAltura(el){if(!el||globalThis.CSS?.supports?.('field-sizing','content'))return;el.style.height='auto';el.style.height=el.scrollHeight+2+'px'}
function ntAjusta(){if(typeof document!=='undefined')document.querySelectorAll?.('.nt textarea').forEach(ntAltura)}
function ntBuscar(valor){NT.busca=valor;document.getElementById('nt_grade').innerHTML=ntGrade();ntAjusta()}
function ntReordenar(){if(tela==='notas'&&!document.activeElement?.closest?.('.nt-nota')){const g=document.getElementById('nt_grade');if(g){g.innerHTML=ntGrade();ntAjusta()}}}
function vNotas(){
  if(!SM.d)return '<div class="card"><p class="mut">As notas ainda não estão disponíveis neste aparelho. Tente novamente com conexão.</p></div>';
  const r=ntRascunho();setTimeout(ntAjusta,0);
  return `<div class="nt"><h2>Notas</h2>${SM.erro?'<p class="sm-err">Alterações salvas neste aparelho; sincronização pendente.</p>':''}
    <form class="nt-criar" onsubmit="event.preventDefault();ntCriar()"><input id="nt_titulo" aria-label="Título opcional" placeholder="Título (opcional)" value="${esc(r.titulo||'')}" oninput="ntRascSalva()"><textarea id="nt_texto" aria-label="Nova nota" placeholder="Anote uma ideia…" rows="3" oninput="ntRascSalva()">${esc(r.texto||'')}</textarea><button class="b" type="submit">Criar nota</button></form>
    <input type="search" aria-label="Buscar notas" placeholder="Buscar notas" value="${esc(NT.busca)}" oninput="ntBuscar(this.value)"><div id="nt_grade" class="nt-grade">${ntGrade()}</div></div>`;
}
if(SM.d){ntAplica(SM.d,ntPendentes());smGuardaCache()}
window.addEventListener('online',()=>{ntSync().then(()=>smPuxar())});
window.addEventListener('storage',e=>{if(e.key?.startsWith(NT_PREFIX)){if(SM.d)ntAplica(SM.d,ntPendentes());smRender()}});

// Arrastar nota pela alça ⠿ (mouse e toque): solta antes/depois da nota sob o dedo.
let NTD=null;
function ntdAlvo(x,y){
  const el=document.elementFromPoint(x,y),a=el?.closest?.('.nt-nota[data-nota]');if(!a||a.dataset.nota===NTD.id)return null;
  const b=a.getBoundingClientRect();return {a,antes:y<b.top+b.height/2};
}
function ntdLimpa(){document.querySelectorAll('.nt-antes,.nt-depois,.nt-arrastando').forEach(e=>e.classList.remove('nt-antes','nt-depois','nt-arrastando'));document.body.classList.remove('nt-on')}
function ntdFim(cancela){
  const d=NTD;if(!d)return;NTD=null;clearInterval(d.auto);ntdLimpa();
  if(!cancela&&d.alvo)ntMover(d.id,d.alvo.a.dataset.nota,d.alvo.antes);
}
document.addEventListener('pointerdown',e=>{
  if(NTD||tela!=='notas'||(e.pointerType==='mouse'&&e.button!==0))return;
  const h=e.target.closest?.('.nt-alca'),a=h&&h.closest('.nt-nota[data-nota]');if(!a)return;
  e.preventDefault();NTD={id:a.dataset.nota,pid:e.pointerId,cy:e.clientY,alvo:null};
  a.classList.add('nt-arrastando');document.body.classList.add('nt-on');try{h.setPointerCapture(e.pointerId)}catch(_){}
  NTD.auto=setInterval(()=>{if(!NTD)return;if(NTD.cy<70)scrollBy(0,-14);else if(NTD.cy>innerHeight-70)scrollBy(0,14)},16);
},true);
document.addEventListener('pointermove',e=>{
  const d=NTD;if(!d||e.pointerId!==d.pid)return;e.preventDefault();d.cy=e.clientY;
  const alvo=ntdAlvo(e.clientX,e.clientY);document.querySelectorAll('.nt-antes,.nt-depois').forEach(x=>x.classList.remove('nt-antes','nt-depois'));
  d.alvo=alvo;if(alvo)alvo.a.classList.add(alvo.antes?'nt-antes':'nt-depois');
},{passive:false});
document.addEventListener('pointerup',e=>{if(NTD&&e.pointerId===NTD.pid)ntdFim(false)});
document.addEventListener('pointercancel',e=>{if(NTD&&e.pointerId===NTD.pid)ntdFim(true)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&NTD)ntdFim(true)});
