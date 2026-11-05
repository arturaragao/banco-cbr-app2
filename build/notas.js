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
function ntRascunho(){
  try{return JSON.parse(localStorage.getItem('bcbr_nota_rascunho')||'{}')}catch(e){return {}}
}
function ntRascSalva(){if(NT.ed)return;try{localStorage.setItem('bcbr_nota_rascunho',JSON.stringify({titulo:document.getElementById('nt_titulo').value,texto:document.getElementById('nt_texto').value}))}catch(e){}}
function ntEditar(id,campo,valor){
  if(!['titulo','texto'].includes(campo))return;
  const n=SM.d?.notas?.find(n=>n.id===id);if(n)ntMudar({id,[campo]:valor,atualizado:new Date().toISOString()});
}
function ntFixar(id){const n=SM.d?.notas?.find(n=>n.id===id);if(n){ntMudar({id,fixa:!n.fixa,atualizado:new Date().toISOString()});render()}}
function ntApagar(id){if(confirm('Apagar esta nota?')){ntMudar({id},true);ntFechaPainel(true);render()}}
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
// ===== 1.33.0 (pedido do Artur, 05/11/2026): toggle por nota, painel flutuante para criar/editar, arrasto fluido =====
// Toggle: abre/fecha o texto da nota; estado guardado neste aparelho (padrão: aberta).
NT.fechadas=(()=>{try{return new Set(JSON.parse(localStorage.getItem('bcbr_nt_fechadas')||'[]'))}catch(e){return new Set()}})();
function ntTg(id){
  NT.fechadas.has(id)?NT.fechadas.delete(id):NT.fechadas.add(id);
  try{localStorage.setItem('bcbr_nt_fechadas',JSON.stringify([...NT.fechadas]))}catch(e){}
  const a=document.querySelector(`.nt-nota[data-nota="${CSS.escape(id)}"]`);
  if(a){const f=NT.fechadas.has(id);a.classList.toggle('fechada',f);a.querySelector('.nt-tg')?.setAttribute('aria-expanded',String(!f))}else ntReordenar();
}
// Painel flutuante: NT.ed = id da nota em edição (null = nota nova, que usa o rascunho).
function ntAbre(id=null){
  ntFechaPainel(true);NT.ed=id;
  const n=id?SM.d?.notas?.find(x=>x.id===id):null;if(id&&!n)return;
  const r=n||ntRascunho(),f=document.createElement('div');f.id='nt_painel';f.className='qa-fundo nt-fundo';
  f.innerHTML=`<div class="qa-caixa nt-caixa" role="dialog" aria-modal="true" aria-label="${n?'Editar nota':'Nova nota'}">
    <div class="row"><b>${n?'Editar nota':'Nova nota'}</b><span style="flex:1"></span>${n?`<button type="button" class="qa-chip" onclick="ntApagar('${esc(n.id)}')">Excluir</button>`:''}<button type="button" class="qa-chip" onclick="ntFechaPainel()">Cancelar</button><button type="button" class="b" onclick="ntSalvarPainel()">Salvar</button></div>
    <input id="nt_titulo" class="qa-in" aria-label="Título" placeholder="Título (opcional)" value="${esc(r.titulo||'')}" oninput="ntRascSalva()">
    <textarea id="nt_texto" class="qa-in" aria-label="Texto da nota" placeholder="Anote uma ideia…" rows="8" oninput="ntRascSalva()">${esc(r.texto||'')}</textarea>
    <div class="qa-dica">Ctrl+Enter salva · Esc fecha${n?'':' · o rascunho fica guardado'}</div></div>`;
  f.addEventListener('pointerdown',e=>{if(e.target===f)ntFechaPainel()});
  document.body.appendChild(f);
  const t=document.getElementById(n?'nt_texto':'nt_titulo');try{t.focus();if(n)t.setSelectionRange(t.value.length,t.value.length)}catch(e){}
}
function ntFechaPainel(silencio){const f=document.getElementById('nt_painel');if(!f)return;if(!silencio)ntRascSalva();f.remove();NT.ed=null}
function ntSalvarPainel(){
  const titulo=document.getElementById('nt_titulo')?.value.trim()??'',texto=document.getElementById('nt_texto')?.value??'';
  if(NT.ed){
    const n=SM.d?.notas?.find(x=>x.id===NT.ed);
    if(n&&(n.titulo!==titulo||n.texto!==texto))ntMudar({id:n.id,titulo,texto,atualizado:new Date().toISOString()});
    ntFechaPainel(true);ntReordenar();return;
  }
  ntCriar(titulo,texto.trim());
}
function ntCriar(titulo,texto){
  if(titulo===undefined){titulo=document.getElementById('nt_titulo').value.trim();texto=document.getElementById('nt_texto').value.trim()}
  if(!titulo&&!texto)return;
  const em=new Date().toISOString(),ordem=Math.min(0,...ntOrdenadas().map(ntChave))-1;   // nova nota entra no topo
  if(ntMudar({id:smId(),titulo,texto,em,atualizado:em,ordem})){try{localStorage.removeItem('bcbr_nota_rascunho')}catch(e){}ntFechaPainel(true);render()}
}
window.addEventListener('keydown',e=>{
  if(!document.getElementById('nt_painel'))return;
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();ntFechaPainel()}
  else if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();e.stopImmediatePropagation();ntSalvarPainel()}
  else if(e.key==='Tab'||e.altKey)e.stopImmediatePropagation();   // não troca de aba com o painel aberto
},true);

function ntGrade(){return ntLista().map(n=>{const f=NT.fechadas?.has(n.id);return `<article class="nt-nota${f?' fechada':''}" data-nota="${esc(n.id)}">
  <div class="nt-topo"><span class="nt-alca" title="Arrastar para mudar a ordem" aria-hidden="true">⠿</span>
    <button type="button" class="nt-tg" aria-expanded="${!f}" onclick="ntTg('${esc(n.id)}')"><span class="nt-seta">▸</span><b>${esc(n.titulo||'')||'<span class="mut">Sem título</span>'}</b></button>
    <span class="nt-acoes"><button class="sm-tagb" aria-label="Fixar nota" aria-pressed="${!!n.fixa}" onclick="ntFixar('${esc(n.id)}')">${n.fixa?'● Fixada':'○ Fixar'}</button><button class="sm-tagb" aria-label="Editar nota" onclick="ntAbre('${esc(n.id)}')">Editar</button></span></div>
  <div class="nt-corpo" title="Clique para editar" onclick="if(!getSelection().toString())ntAbre('${esc(n.id)}')"><div class="nt-txt">${esc(n.texto||'')||'<span class="mut">Sem texto</span>'}</div>
  <small class="mut">${esc((n.em||n.atualizado||'').slice(0,10))}</small></div></article>`}).join('')||'<p class="mut">Nenhuma nota encontrada.</p>'}
function ntBuscar(valor){NT.busca=valor;document.getElementById('nt_grade').innerHTML=ntGrade()}
function ntReordenar(){if(tela==='notas'&&!NTD){const g=document.getElementById('nt_grade');if(g)g.innerHTML=ntGrade()}}
function vNotas(){
  if(!SM.d)return '<div class="card"><p class="mut">As notas ainda não estão disponíveis neste aparelho. Tente novamente com conexão.</p></div>';
  return `<div class="nt"><h2>Notas</h2>${SM.erro?'<p class="sm-err">Alterações salvas neste aparelho; sincronização pendente.</p>':''}
    <input type="search" aria-label="Buscar notas" placeholder="Buscar notas" value="${esc(NT.busca)}" oninput="ntBuscar(this.value)"><div id="nt_grade" class="nt-grade">${ntGrade()}</div></div>`;
}
if(SM.d){ntAplica(SM.d,ntPendentes());smGuardaCache()}
window.addEventListener('online',()=>{ntSync().then(()=>smPuxar())});
window.addEventListener('storage',e=>{if(e.key?.startsWith(NT_PREFIX)){if(SM.d)ntAplica(SM.d,ntPendentes());smRender()}});

// Arrasto fluido pela alça ⠿ (mouse e toque): um "fantasma" segue o dedo e as outras notas
// abrem espaço em tempo real, com animação (FLIP). Soltar grava a ordem que está na tela.
let NTD=null;
function ntdFlip(g,muda){
  const els=[...g.querySelectorAll('.nt-nota')],antes=new Map(els.map(e=>[e,e.getBoundingClientRect()]));muda();
  for(const e of els){const a=antes.get(e),b=e.getBoundingClientRect(),dx=a.left-b.left,dy=a.top-b.top;if(!dx&&!dy)continue;
    e.style.transition='none';e.style.transform=`translate(${dx}px,${dy}px)`;e.getBoundingClientRect();
    e.style.transition='transform .18s cubic-bezier(.2,.8,.2,1)';e.style.transform='';}
}
function ntdMove(){
  const d=NTD;if(!d)return;d.g.style.transform=`translate(${d.cx-d.dx}px,${d.cy-d.dy}px)`;
  const el=document.elementFromPoint(d.cx,d.cy),alvo=el?.closest?.('.nt-nota[data-nota]');
  if(!alvo||alvo===d.a||alvo.style.transform)return;   // ignora a nota que ainda está animando
  const b=alvo.getBoundingClientRect(),l=[...d.grade.children],ia=l.indexOf(d.a),ib=l.indexOf(alvo);
  // Mesma linha (2 colunas): decide pelo meio horizontal; senão, pelo meio vertical.
  const mesmaLinha=Math.abs(d.a.getBoundingClientRect().top-b.top)<8;
  const depois=mesmaLinha?d.cx>b.left+b.width/2:d.cy>b.top+b.height/2;
  const ref=depois?alvo.nextSibling:alvo;if(ref===d.a||(depois?ib+1:ib)===ia)return;
  ntdFlip(d.grade,()=>d.grade.insertBefore(d.a,ref));
}
function ntdFim(cancela){
  const d=NTD;if(!d)return;NTD=null;clearInterval(d.auto);d.g.remove();d.a.classList.remove('nt-lugar');document.body.classList.remove('nt-on');
  if(cancela){ntReordenar();return}
  const vis=[...d.grade.querySelectorAll('.nt-nota[data-nota]')].map(e=>e.dataset.nota);
  if(vis.join()!==d.inicio.join())ntOrdem(vis);
}
// Grava a nova ordem: as notas visíveis (busca) assumem as posições que já ocupavam na lista completa.
function ntOrdem(vis){
  const l=ntOrdenadas(),pos=l.map((n,i)=>vis.includes(n.id)?i:-1).filter(i=>i>=0),mapa=new Map(l.map(n=>[n.id,n]));
  const nova=[...l];vis.forEach((id,k)=>{nova[pos[k]]=mapa.get(id)});
  const agora=new Date().toISOString();let mudou=false;
  nova.forEach((x,i)=>{const o=(i+1)*10;if(x&&x.ordem!==o){ntMudar({id:x.id,ordem:o,atualizado:agora});mudou=true}});
  ntReordenar();return mudou;
}
function ntMover(id,ref,antes){
  if(!id||!ref||id===ref)return false;
  const l=ntOrdenadas().map(n=>n.id);if(!l.includes(id)||!l.includes(ref))return false;
  const nova=l.filter(x=>x!==id);nova.splice(nova.indexOf(ref)+(antes?0:1),0,id);return ntOrdem(nova);
}
document.addEventListener('pointerdown',e=>{
  if(NTD||tela!=='notas'||(e.pointerType==='mouse'&&e.button!==0))return;
  const h=e.target.closest?.('.nt-alca'),a=h&&h.closest('.nt-nota[data-nota]');if(!a)return;
  e.preventDefault();const b=a.getBoundingClientRect(),grade=a.parentElement;
  const g=a.cloneNode(true);g.classList.add('nt-fantasma');g.style.cssText=`width:${b.width}px;height:${b.height}px`;document.body.appendChild(g);
  NTD={a,g,grade,pid:e.pointerId,cx:e.clientX,cy:e.clientY,dx:e.clientX-b.left,dy:e.clientY-b.top,inicio:[...grade.querySelectorAll('.nt-nota[data-nota]')].map(x=>x.dataset.nota)};
  a.classList.add('nt-lugar');document.body.classList.add('nt-on');try{h.setPointerCapture(e.pointerId)}catch(_){}
  if(navigator.vibrate)try{navigator.vibrate(15)}catch(_){}
  NTD.auto=setInterval(()=>{const d=NTD;if(!d)return;if(d.cy<80)scrollBy(0,-12);else if(d.cy>innerHeight-80)scrollBy(0,12);else return;ntdMove()},16);
  ntdMove();
},true);
document.addEventListener('pointermove',e=>{const d=NTD;if(!d||e.pointerId!==d.pid)return;e.preventDefault();d.cx=e.clientX;d.cy=e.clientY;ntdMove()},{passive:false});
document.addEventListener('pointerup',e=>{if(NTD&&e.pointerId===NTD.pid)ntdFim(false)});
document.addEventListener('pointercancel',e=>{if(NTD&&e.pointerId===NTD.pid)ntdFim(true)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&NTD)ntdFim(true)});
document.addEventListener('touchmove',e=>{if(NTD)e.preventDefault()},{passive:false});
