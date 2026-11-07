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
    <div class="qa-dica">“- ” faz lista com bolinhas · clique fora ou Ctrl+Enter salva · Esc cancela${n?'':' (o rascunho fica guardado)'}</div></div>`;
  f.addEventListener('pointerdown',e=>{if(e.target===f){e.preventDefault();ntSalvarPainel()}});   // 1.37.0: clicar fora salva (Esc/Cancelar descartam)
  f.querySelector('#nt_texto').addEventListener('beforeinput',ntLista_tecla);   // beforeinput: vale também no teclado do celular
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
  if(!titulo&&!texto.trim()){ntFechaPainel(true);return}   // nota nova vazia: só fecha
  ntCriar(titulo,texto.trim());
}
// 1.37.0 (pedido do Artur, 06/11/2026): lista com bolinhas no texto da nota.
// "- " no começo da linha vira "• "; Enter numa linha "• x" continua a lista; Enter numa linha só "• " encerra a lista.
function ntListaEdita(v,ini,fim,tecla){
  if(ini!==fim)return null;
  const NL=String.fromCharCode(10),l0=v.lastIndexOf(NL,ini-1)+1,antes=v.slice(l0,ini);
  if(tecla===' '){const m=/^(\s*)-$/.exec(antes);if(!m)return null;return {de:l0+m[1].length,ate:ini,txt:'• ',cur:l0+m[1].length+2}}
  if(tecla==='Enter'){const fl=v.indexOf(NL,ini),linha=v.slice(l0,fl<0?v.length:fl),m=/^(\s*)• ?(.*)$/.exec(linha);if(!m)return null;
    if(!m[2].trim())return {de:l0,ate:fl<0?v.length:fl,txt:'',cur:l0};   // bolinha vazia: encerra a lista
    const t=NL+m[1]+'• ';return {de:ini,ate:ini,txt:t,cur:ini+t.length}}
  return null;
}
function ntLista_tecla(e){
  const tecla=e.inputType==='insertText'&&e.data===' '?' ':e.inputType==='insertLineBreak'||e.inputType==='insertParagraph'?'Enter':null;if(!tecla)return;
  const t=e.target,r=ntListaEdita(t.value,t.selectionStart,t.selectionEnd,tecla);if(!r)return;
  e.preventDefault();t.setSelectionRange(r.de,r.ate);
  const n0=t.value.length-(r.ate-r.de)+r.txt.length;let ok=false;
  try{ok=r.de===r.ate&&!r.txt?true:document.execCommand(r.txt?'insertText':'delete',false,r.txt)}catch(x){}   // mantém o Ctrl+Z
  if(!ok||t.value.length!==n0)t.setRangeText(r.txt,r.de,r.ate,'end');
  t.setSelectionRange(r.cur,r.cur);t.dispatchEvent(new Event('input',{bubbles:true}));
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

// 1.34.0: colunas independentes (sem buraco quando uma nota recolhe): a nota i vai para a coluna i%n e cada coluna empilha só as suas.
const ntNCol=()=>{try{return matchMedia('(max-width:700px)').matches?1:2}catch(e){return 2}};
function ntDistribui(ids,n){const c=Array.from({length:n},()=>[]);ids.forEach((id,i)=>c[i%n].push(id));return c}
function ntGrade(){
  const l=ntLista();if(!l.length)return '<p class="mut">Nenhuma nota encontrada.</p>';
  const m=new Map(l.map(n=>[n.id,n]));
  return ntDistribui(l.map(n=>n.id),ntNCol()).map(c=>`<div class="nt-col">${c.map(id=>ntCartao(m.get(id))).join('')}</div>`).join('');
}
function ntCartao(n){const f=NT.fechadas?.has(n.id);return `<article class="nt-nota${f?' fechada':''}" data-nota="${esc(n.id)}">
  <div class="nt-topo"><span class="nt-alca" title="Arrastar para mudar a ordem" aria-hidden="true">⠿</span>
    <button type="button" class="nt-tg" aria-expanded="${!f}" onclick="ntTg('${esc(n.id)}')"><span class="nt-seta">▸</span><b>${esc(n.titulo||'')||'<span class="mut">Sem título</span>'}</b></button>
    <span class="nt-acoes"><button class="sm-tagb" aria-label="Fixar nota" aria-pressed="${!!n.fixa}" onclick="ntFixar('${esc(n.id)}')">${n.fixa?'● Fixada':'○ Fixar'}</button><button class="sm-tagb" aria-label="Editar nota" onclick="ntAbre('${esc(n.id)}')">Editar</button></span></div>
  <div class="nt-corpo" title="Clique para editar" onclick="if(!getSelection().toString())ntAbre('${esc(n.id)}')"><div class="nt-txt">${esc(n.texto||'')||'<span class="mut">Sem texto</span>'}</div>
  <small class="mut">${esc((n.em||n.atualizado||'').slice(0,10))}</small></div></article>`}
function ntBuscar(valor){NT.busca=valor;document.getElementById('nt_grade').innerHTML=ntGrade()}
try{matchMedia('(max-width:700px)').addEventListener('change',()=>ntReordenar())}catch(e){}
function ntReordenar(){if(tela==='notas'&&!NTD){const g=document.getElementById('nt_grade');if(g)g.innerHTML=ntGrade()}}
function vNotas(){
  if(!SM.d)return '<div class="card"><p class="mut">As notas ainda não estão disponíveis neste aparelho. Tente novamente com conexão.</p></div>';
  return `<div class="nt"><h2>Notas</h2>${SM.erro?'<p class="sm-err">Alterações salvas neste aparelho; sincronização pendente.</p>':''}
    <input type="search" aria-label="Buscar notas" placeholder="Buscar notas" value="${esc(NT.busca)}" oninput="ntBuscar(this.value)"><div id="nt_grade" class="nt-grade">${ntGrade()}</div></div>`;
}
if(SM.d){ntAplica(SM.d,ntPendentes());smGuardaCache()}
window.addEventListener('online',()=>{ntSync().then(()=>smPuxar())});
window.addEventListener('storage',e=>{if(e.key?.startsWith(NT_PREFIX)){if(SM.d)ntAplica(SM.d,ntPendentes());smRender()}});

// Arrasto fluido (mouse e toque), estilo Notion/Trello (1.34.0): segurar a alça ⠿ (toque) ou o título (mouse, após 5 px) e arrastar.
// Um "fantasma" com sombra segue o ponteiro, o lugar vazio mostra onde vai cair e as outras notas deslizam (FLIP).
// Soltar grava a ordem que está na tela; Esc ou cancelamento do sistema restauram. Funciona em 1 e 2 colunas.
let NTD=null,NTP=null;
// Nova ordem ao soltar `id` sobre `alvo`: ele assume a posição do alvo (antes dele se vinha de baixo, depois se vinha de cima).
function ntRealoca(ids,id,alvo){
  const j=ids.indexOf(alvo);if(j<0||!ids.includes(id)||id===alvo)return ids;
  const r=ids.filter(x=>x!==id);r.splice(j,0,id);return r;
}
// Ordem de leitura (esquerda→direita, linha a linha) a partir das colunas: inverso de ntDistribui.
function ntLeitura(cols){const r=[],m=Math.max(0,...cols.map(c=>c.length));for(let i=0;i<m;i++)for(const c of cols)if(i<c.length)r.push(c[i]);return r}
function ntdFlip(g,muda){
  const els=[...g.querySelectorAll('.nt-nota')],antes=new Map(els.map(e=>[e,e.getBoundingClientRect()]));muda();
  for(const e of els){const a=antes.get(e),b=e.getBoundingClientRect(),dx=a.left-b.left,dy=a.top-b.top;if(!dx&&!dy)continue;
    e.style.transition='none';e.style.transform=`translate(${dx}px,${dy}px)`;e.getBoundingClientRect();
    e.style.transition='transform .18s cubic-bezier(.2,.8,.2,1)';e.style.transform='';}
}
// Reencaixa os mesmos nós nas colunas conforme `ids` (os nós são movidos, não recriados, para a animação funcionar).
function ntdEncaixa(grade,ids){
  const cols=[...grade.querySelectorAll('.nt-col')],nos=new Map([...grade.querySelectorAll('.nt-nota')].map(e=>[e.dataset.nota,e]));
  ntDistribui(ids,cols.length).forEach((c,k)=>c.forEach((id,i)=>{const no=nos.get(id);if(cols[k].children[i]!==no)cols[k].insertBefore(no,cols[k].children[i]||null)}));
}
function ntdMove(){
  const d=NTD;if(!d)return;d.g.style.transform=`translate(${d.cx-d.dx}px,${d.cy-d.dy}px)`;
  if(performance.now()-d.t<140)return;   // deixa a animação anterior terminar: evita vaivém
  const el=document.elementFromPoint(d.cx,d.cy);let alvo=el?.closest?.('.nt-nota[data-nota]');
  if(!alvo){   // abaixo da última nota de uma coluna: assume o fim dela
    const col=el?.closest?.('.nt-col'),ns=col?[...col.querySelectorAll('.nt-nota')].filter(x=>x!==d.a):[],u=ns[ns.length-1];
    if(u&&d.cy>u.getBoundingClientRect().bottom)alvo=u;
  }
  if(!alvo||alvo===d.a)return;
  const novo=ntRealoca(d.ids,d.a.dataset.nota,alvo.dataset.nota);if(novo.join()===d.ids.join())return;
  d.ids=novo;d.t=performance.now();ntdFlip(d.grade,()=>ntdEncaixa(d.grade,novo));
}
function ntdIni(a,cx,cy,pid,h){
  const b=a.getBoundingClientRect(),grade=a.closest('.nt-grade');if(!grade)return;
  const g=a.cloneNode(true);g.classList.add('nt-fantasma');g.style.cssText=`width:${b.width}px;height:${b.height}px`;document.body.appendChild(g);
  const ids=ntLeitura([...grade.querySelectorAll('.nt-col')].map(c=>[...c.querySelectorAll('.nt-nota')].map(x=>x.dataset.nota)));
  NTD={a,g,grade,pid,cx,cy,dx:cx-b.left,dy:cy-b.top,ids,inicio:[...ids],t:0};
  a.classList.add('nt-lugar');document.body.classList.add('nt-on');
  try{getSelection().removeAllRanges()}catch(_){}
  try{(h||a).setPointerCapture(pid)}catch(_){}
  if(navigator.vibrate)try{navigator.vibrate(15)}catch(_){}
  // Rolagem automática perto das bordas, mais rápida quanto mais perto.
  NTD.auto=setInterval(()=>{const d=NTD;if(!d)return;const z=90,v=d.cy<z?-(z-d.cy)/z:d.cy>innerHeight-z?(d.cy-(innerHeight-z))/z:0;
    if(!v)return;scrollBy(0,Math.round(Math.max(-1,Math.min(1,v))*18));ntdMove()},16);
  ntdMove();
}
function ntdFim(cancela){
  const d=NTD;if(!d)return;NTD=null;clearInterval(d.auto);d.g.remove();d.a.classList.remove('nt-lugar');document.body.classList.remove('nt-on');
  if(cancela){ntReordenar();return}
  if(d.ids.join()!==d.inicio.join())ntOrdem(d.ids);
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
  const h=e.target.closest?.('.nt-alca'),topo=!h&&e.pointerType==='mouse'&&!e.target.closest?.('.nt-acoes')?e.target.closest?.('.nt-topo'):null;
  const a=(h||topo)?.closest('.nt-nota[data-nota]');if(!a)return;
  if(h){e.preventDefault();ntdIni(a,e.clientX,e.clientY,e.pointerId,h)}
  else NTP={a,x:e.clientX,y:e.clientY,pid:e.pointerId};   // mouse no título: só vira arrasto depois de mover 5 px (clique continua alternando)
},true);
document.addEventListener('pointermove',e=>{
  const p=NTP;if(p&&e.pointerId===p.pid&&!NTD&&Math.hypot(e.clientX-p.x,e.clientY-p.y)>5){NTP=null;NTD_CLIQUE=true;ntdIni(p.a,e.clientX,e.clientY,p.pid,p.a.querySelector('.nt-alca'))}
  const d=NTD;if(!d||e.pointerId!==d.pid)return;e.preventDefault();d.cx=e.clientX;d.cy=e.clientY;ntdMove();
},{passive:false});
let NTD_CLIQUE=false;
document.addEventListener('pointerup',e=>{
  NTP=null;if(NTD&&e.pointerId===NTD.pid)ntdFim(false);
  if(NTD_CLIQUE){NTD_CLIQUE=false;   // o clique que sucede um arrasto iniciado no título não deve alternar a nota
    const f=ev=>{ev.stopPropagation();ev.preventDefault()};document.addEventListener('click',f,true);setTimeout(()=>document.removeEventListener('click',f,true),60)}
});
document.addEventListener('pointercancel',e=>{NTP=null;NTD_CLIQUE=false;if(NTD&&e.pointerId===NTD.pid)ntdFim(true)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&NTD){e.preventDefault();ntdFim(true)}});
document.addEventListener('touchmove',e=>{if(NTD)e.preventDefault()},{passive:false});
