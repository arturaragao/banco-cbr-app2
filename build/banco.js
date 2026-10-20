// ===== aba Banco (app): igual ao Notion — todas as questões numeradas, em toggle =====
let bq='',bf={a:'',d:'',s:'',c:''},bAbertos=new Set(),bLim=150;
const recente=q=>q.origem==='extensao'&&q.chegou&&Date.now()-Date.parse(q.chegou)<7*864e5;
function comentAlt(q,l){
  const c=q.curso&&q.curso.coment&&q.curso.coment[l],k=q.coment&&q.coment[l];
  if(!c&&!k)return'';
  return `<div class="cmw">${c?`<div class="mut md cm cmc"><span class="src">Curso</span>${md(c)}</div>`:''}${k?`<div class="mut md cm cmk"><span class="src">Claude</span>${md(k)}</div>`:''}</div>`;
}
function cursoBloco(q){
  const c=q.curso;if(!c)return'';
  const sec=Object.entries(c.secoes||{}).filter(([k,v])=>v&&v.length&&!/alternativ/i.test(k));
  if(!c.ponto&&!sec.length)return'';
  return `<div class="ponto md pcurso"><div class="kick">Ponto de ensino · Curso (PersonalRad)</div>${c.ponto?md(c.ponto):''}${sec.map(([k,v])=>`<div class="kick" style="margin-top:8px">${esc(k)}</div>${md(v.join('\n\n'))}`).join('')}</div>`;
}
function bStatus(q,ult){const l=ult[q.id];return l?(l.ok?'<span class="bok">✓</span>':'<span class="bbad">✗</span>'):'<span class="mut">·</span>'}
function bCorpo(q){
  const ult={};log.forEach(l=>ult[l.q]=l);const r=ult[q.id];
  const imgs=[...(q.imgs||[])].filter(imgSrc).map(u=>`<img src="${imgSrc(u)}" onclick="zoom('${u}')" loading="lazy" alt="Imagem da questão">`).join('');
  const imgsC=(q.imgsCom||[]).filter(imgSrc).map(u=>`<img src="${imgSrc(u)}" onclick="zoom('${u}')" loading="lazy" alt="Imagem do comentário">`).join('');
  const alts=Object.entries(q.alts).map(([l,tx])=>`<div class="alt ${l===q.gab?'ok':r&&!r.ok&&r.e===l?'bad':''}"><b>${l})</b><div style="flex:1;min-width:0"><span class="at">${esc(tx)}</span>${comentAlt(q,l)}</div></div>`).join('');
  return `<div class="bc">
    <div class="mut" style="font-size:.82rem">${esc([AREA_BY[q._a].nome,...(q.cl||[])].join(' › '))}${q.classif?'':' · <b>ainda sem classificação</b>'}${q.acerto!=null?' · acerto estimado ~'+q.acerto+'%':''}</div>
    ${q.tags.length?`<div style="margin-top:4px">${q.tags.filter(t=>!isMeta(t)).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div>`:''}
    <div class="enun" style="margin-top:10px">${esc(q.enunciado)}</div><div class="imgs">${imgs}</div>${alts}
    <p style="margin:8px 0"><b>Gabarito: ${q.gab||'—'}</b>${r?` · <span class="mut">sua última resposta: ${r.e||'?'} (${r.ok?'acertou':'errou'}, ${r.conf||''})</span>`:''}</p>
    ${cursoBloco(q)}${pontoDe(q)?`<div class="ponto md"><div class="kick">CCQ · Claude</div>${md(pontoDe(q))}</div>`:''}<div class="imgs">${imgsC}</div>
    <div class="row" style="margin-top:8px">${q.gab?`<button class="b s" onclick="iniciar(['${q.id}'],'banco')">Fazer esta questão</button>`:''}<span class="mut" style="font-size:.8rem">${q.chegou?'chegou em '+new Date(q.chegou).toLocaleDateString('pt-BR'):''}${q.origem==='extensao'?' pela extensão':''}</span></div>
  </div>`;
}
function bTog(id,el){
  if(el.open){if(!bAbertos.has(id)){bAbertos.add(id);el.insertAdjacentHTML('beforeend',bCorpo(QID[id]))}}
  else{bAbertos.delete(id);const c=el.querySelector('.bc');if(c)c.remove()}
}
async function bBaixar(){const el=$('#b_dl');if(el)el.disabled=true;
  const n=await BCBR.baixarTudo((i,t)=>{const e=$('#b_dl');if(e)e.textContent=`Baixando imagens… ${i}/${t}`});
  toast(`${n} imagens guardadas neste aparelho`);const e=$('#b_dl');if(e){e.disabled=false;e.textContent='Baixar imagens para offline'}}
function vBanco(){
  const n=norm(bq),ult={};log.forEach(l=>ult[l.q]=l);
  const L=Q.filter(q=>(!n||norm((q.n??'')+' '+q.enunciado+' '+q.tags.join(' ')+' '+(q.cl||[]).join(' ')).includes(n))
    &&(!bf.a||q._a===bf.a)&&(!bf.d||q.classif&&q._d===bf.d)
    &&(!bf.s||(bf.s==='nao'?!ult[q.id]:bf.s==='ok'?ult[q.id]&&ult[q.id].ok:ult[q.id]&&!ult[q.id].ok))
    &&(!bf.c||(bf.c==='sem'?!q.classif:recente(q))));
  const sg=Q.filter(q=>!q.gab).length,semc=Q.filter(q=>!q.classif).length,nov=Q.filter(recente).length,feitas=Q.filter(q=>ult[q.id]).length;
  const sel=(id,k,ops)=>`<select id="${id}" onchange="bf.${k}=this.value;bLim=150;render()">${ops.map(([v,t])=>`<option value="${v}" ${bf[k]===v?'selected':''}>${t}</option>`).join('')}</select>`;
  const linhas=L.slice(0,bLim).map(q=>`<details class="bq" ${bAbertos.has(q.id)?'open':''} ontoggle="bTog('${q.id}',this)"><summary>
      <span class="bn">${q.n??'—'}</span><span class="bs">${bStatus(q,ult)}</span>
      <span class="bm"><span class="be">${esc(q.enunciado.slice(0,130))}${q.enunciado.length>130?'…':''}</span>
      <span class="bl"><span class="ba">${AREA_BY[q._a].nome}</span>${q.classif?`<span class="dif ${q._d}"><i></i>${DIF[q._d].nome}</span>`:'<span class="tag">sem classificação</span>'}${q.tags.filter(t=>!isMeta(t)).slice(0,4).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}${q.imgs&&q.imgs.length?'<span class="tag">🖼 '+q.imgs.length+'</span>':''}${recente(q)?'<span class="nova">nova</span>':''}${q.gab?'':'<span class="tag">sem gabarito</span>'}</span></span>
    </summary>${bAbertos.has(q.id)?bCorpo(q):''}</details>`).join('');
  return `<div class="card"><h2>Banco (${Q.length} questões)</h2>
  <p class="mut">${feitas} feitas · ${semc} sem classificação · ${sg} sem gabarito (não entram nos estudos) · ${nov} novas nos últimos 7 dias</p>
  <div class="row bfil"><input id="b_q" placeholder="Buscar por número, texto ou tag" value="${esc(bq)}" onchange="bq=this.value;bLim=150;render()" style="flex:1;min-width:180px">
   ${sel('b_a','a',[['','Todas as áreas'],...AREAS.map(a=>[a.id,a.nome]),['sem','Sem área']])}
   ${sel('b_d','d',[['','Todas as dificuldades'],['f','Fácil'],['m','Média'],['d','Difícil']])}
   ${sel('b_s','s',[['','Feitas e não feitas'],['nao','Não feitas'],['ok','Acertei'],['err','Errei']])}
   ${sel('b_c','c',[['','Todas'],['sem','Sem classificação'],['novas','Novas (7 dias)']])}</div>
  <p class="mut">${L.length} questões</p>
  <div class="blist">${linhas}</div>
  ${L.length>bLim?`<p><button class="b s" onclick="bLim+=300;render()">Mostrar mais (${L.length-bLim} restantes)</button> <button class="b s" onclick="bLim=1e9;render()">Mostrar todas</button></p>`:''}
  <div class="row" style="margin-top:14px"><button class="b s" id="b_dl" onclick="bBaixar()">Baixar imagens para offline</button><button class="b s" onclick="BCBR.config()">Chaves deste aparelho</button></div></div>`;
}
