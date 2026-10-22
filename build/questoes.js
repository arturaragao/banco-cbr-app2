// ===== aba Questões (pedido do Artur, 22/10/2026) =====
// Abre o último bloco em andamento (revisão do dia ou estudo salvo) já na próxima questão a fazer;
// no topo da questão, um seletor troca para outro bloco em aberto.
function qChave(){if(!sess||sess.fim)return null;return sess.estId||(sess.modo==='hoje'?'ri':'atual')}
function qBlocos(){
  const L=[];
  try{const ids=riHoje(),h=hoje0(),f=new Set();let u=0;
    log.forEach(l=>{if(l.t>=h&&l.modo==='hoje'&&ids.includes(l.q)){f.add(l.q);u=Math.max(u,l.t)}});
    if(ids.length&&f.size<ids.length)L.push({k:'ri',nome:'Revisão do dia',feitas:f.size,n:ids.length,u})}catch(e){}
  (cfg.ests||[]).forEach(e=>{const ids=e.ids.filter(i=>QID[i]&&QID[i].gab),f=ids.filter(i=>(e.resp||{})[i]).length;
    if(ids.length&&f<ids.length)L.push({k:e.id,nome:'Estudo',feitas:f,n:ids.length,u:e.u||e.t0||0})});
  return L.sort((a,b)=>b.u-a.u);
}
// índice da próxima questão sem resposta, a partir da atual (dá a volta)
function qProxIdx(){const n=sess.ids.length;for(let j=0;j<n;j++){const i=(sess.i+j)%n;if(!sess.resp[sess.ids[i]])return i}return sess.i}
function qCarrega(k){
  if(sess&&!sess.fim&&sess.modo==='estudo')salvaEst();
  if(k==='ri'){iniciaRI();return}
  retomaEst(k);if(!sess||sess.estId!==k)return;
  const nx=qProxIdx();if(nx!==sess.i){sess.i=nx;sess.tq=Date.now();salvaEst();render();scrollTo(0,0)}
}
// chamado por go('questoes'): devolve true quando já levou para a questão
function qAbre(){
  if(sess&&!sess.fim){go('quiz');return true}
  const L=qBlocos();if(!L.length)return false;
  qCarrega(L[0].k);return tela==='quiz';
}
function qTroca(k){if(k)qCarrega(k)}
function vQuestoes(){
  return `<div class="card"><h2>Questões</h2><p class="mut">Nenhum bloco de questões em aberto agora.</p>
  <div class="row"><button class="b" onclick="go('estudar')">Montar um estudo</button><button class="b s" onclick="go('hoje')">Ir para Hoje</button></div></div>`;
}
const qDt=u=>u?' · '+new Date(u).toLocaleString('pt-BR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'';
function qBarra(){
  if(!sess||sess.sim||sess.fim)return'';
  const at=qChave(),L=qBlocos(),outros=L.filter(b=>b.k!==at);if(!outros.length)return'';
  const eu=L.find(b=>b.k===at),nome=eu?`${eu.nome} · ${eu.feitas}/${eu.n}`:'Bloco atual';
  return `<div class="qblocos"><span class="mut">Bloco:</span><select aria-label="Trocar de bloco de questões" onchange="qTroca(this.value);this.blur()"><option value="">${esc(nome)}</option>${outros.map(b=>`<option value="${b.k}">→ ${b.nome} · ${b.feitas}/${b.n}${qDt(b.u)}</option>`).join('')}</select></div>`;
}
function qAtalhos(){
  if(!sess||sess.qEdit)return'';
  const K=n=>`<kbd>${esc(keyLab(n))}</kbd>`,it=(k,t)=>`<span>${k} ${t}</span>`;
  const alts=['a1','a2','a3','a4','a5'].map(K).join('');
  return `<div class="qatalhos" aria-label="Atalhos do teclado">
  ${it('<kbd>←</kbd><kbd>→</kbd>','questão anterior/próxima')}
  ${it('<kbd>↑</kbd><kbd>↓</kbd>','escolhe a alternativa (depois de responder: rola a página)')}
  ${it(alts,'alternativas A–E')}
  ${it(K('cert')+K('duv')+K('chu'),'certeza / dúvida / chute (<kbd>Enter</kbd> = certeza)')}
  ${it(K('cut'),'riscar alternativa')}
  ${it(K('next')+'<kbd>Espaço</kbd>','próxima (depois de responder)')}
  ${it(K('edit'),'editar resposta')}
  ${it(K('ia'),'CCQ e resumo com IA')}
  ${it('<kbd>I</kbd>','seleciona a 1ª imagem › de novo abre › de novo fecha')}
  ${it('<kbd>←</kbd><kbd>→</kbd>','com imagem selecionada: troca a imagem (<kbd>Esc</kbd> solta)')}
  ${it('<kbd>+</kbd><kbd>−</kbd><kbd>0</kbd>','imagem aberta: aumenta / diminui / ajusta')}
  </div>`;
}
function vQuizQ(){const h=vQuiz();if(tela!=='quiz'||!sess||sess.qEdit)return h;return qBarra()+h+qAtalhos()}

// ===== imagens: teclado (I + setas) =====
const GS={id:null,on:false,t:'q'};
function qGalTipo(q){const fb=!!sess.resp[q.id]&&!sess.sim;return galLista(q,'q').length?'q':fb&&galLista(q,'c').length?'c':null}
function qMarcaGal(){const q=tela==='quiz'&&sess&&!sess.fim?cur():null;
  document.querySelectorAll('#app .gal').forEach(el=>el.classList.toggle('gsel',!!q&&GS.on&&GS.id===q.id&&el.id==='gal_'+q.id+'_'+GS.t))}
window.addEventListener('keydown',e=>{
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  const t=e.target;if(t&&(/INPUT|SELECT|TEXTAREA/.test(t.tagName)||t.isContentEditable))return;
  if(typeof capKey!=='undefined'&&capKey)return;
  if(typeof QA!=='undefined'&&QA.on)return;
  const isI=e.key==='i'||e.key==='I',z=document.getElementById('zoom');
  if(z&&!z.hidden){if(isI){e.preventDefault();e.stopImmediatePropagation();zClose()}return}
  if(tela!=='quiz'||!sess||sess.fim||sess.qEdit)return;
  const q=cur();if(!q)return;
  if(GS.id!==q.id){GS.id=q.id;GS.on=false}
  if(isI&&KG.quiz.some(n=>KEY(n).toLowerCase()==='i'))return;   // tecla I já usada num atalho personalizado
  if(isI){const tp=qGalTipo(q);if(!tp)return;e.preventDefault();e.stopImmediatePropagation();
    if(!GS.on){GS.on=true;GS.t=tp;galVai(q.id,tp,0,0);qMarcaGal();
      const el=document.getElementById('gal_'+q.id+'_'+tp);el&&el.scrollIntoView({block:'nearest'})}
    else{const L=galLista(q,GS.t),x=L[gIdx[q.id+'_'+GS.t]||0];if(x)zoom(x.u)}
    return}
  if(!GS.on)return;
  if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();e.stopImmediatePropagation();galVai(q.id,GS.t,e.key==='ArrowRight'?1:-1);qMarcaGal();return}
  if(e.key==='Escape'){GS.on=false;qMarcaGal();return}
  if((e.key==='ArrowUp'||e.key==='ArrowDown')&&!(sess.resp[q.id]&&!sess.sim)){GS.on=false;qMarcaGal()}   // foco volta às alternativas
},true);

// ===== imagens sem piscar: a cada redesenho reaproveita as <img> já carregadas (mesma imagem = mesmo elemento) =====
function qGuarda(root){const v={};root.querySelectorAll('img[data-u]').forEach(im=>{if(im.complete&&im.naturalWidth)(v[im.dataset.u]??=[]).push(im)});return v}
function qReusa(root,v){root.querySelectorAll('img[data-u]').forEach(im=>{const o=(v[im.dataset.u]||[]).shift();if(!o)return;
  [...o.attributes].forEach(a=>{if(a.name!=='src'&&!im.hasAttribute(a.name))o.removeAttribute(a.name)});
  [...im.attributes].forEach(a=>{if(a.name!=='src')o.setAttribute(a.name,a.value)});im.replaceWith(o)})}
function qPinta(html){const app=$('#app'),v=qGuarda(app);app.innerHTML=html;qReusa(app,v);qMarcaGal();qPreCarrega()}
// pré-carrega as imagens da questão atual e das 3 seguintes (ficam prontas na memória)
const qPre=new Map();
function qPreCarrega(){
  if(tela!=='quiz'||!sess||!window.BCBR||!BCBR.imgDireto)return;
  for(let d=0;d<=3;d++){const q=QID[sess.ids[sess.i+d]];if(!q)continue;
    [...(q.imgs||[]),...(q.imgsCom||[])].forEach(u=>{u=String(u);if(!u.startsWith('gh:'))return;const n=u.slice(3);if(qPre.has(n))return;
      qPre.set(n,null);BCBR.imgDireto(n).then(src=>{const im=new Image();im.src=src;qPre.set(n,im);if(im.decode)im.decode().catch(()=>{})}).catch(()=>qPre.delete(n))})}
}
