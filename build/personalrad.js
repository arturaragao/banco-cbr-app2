// Metadados PersonalRad: nunca entram nas tags/classificação do app.
function prLinhas(q){return Object.values(q.curso?.secoes||{}).flat().filter(v=>typeof v==='string')}
function prStats(q){
  const s={...(q.pr_stats||{})},texto=prLinhas(q).join('\n');
  const m=texto.match(/Acerto dos alunos:\s*([\d.,]+)%\s*\((\d+) respostas(?:, (\d+) alunos)?/i);
  if(m){s.acerto??=Number(m[1].replace(',','.'));s.respostas??=+m[2];if(m[3])s.respondentes??=+m[3]}
  s.alternativas={...(s.alternativas||{})};
  for(const [l,t] of Object.entries(q.alts||{})){
    const p=t.match(/·\s*(?:✓\s*)?([\d.,]+)%\s*$/);
    if(p&&!s.alternativas[l])s.alternativas[l]={percentual:Number(p[1].replace(',','.'))};
  }
  for(const linha of prLinhas(q).filter(l=>/^Alternativas marcadas:/i.test(l.trim())))
    for(const p of linha.matchAll(/\b([A-E])\s*(?:✓\s*)?([\d.,]+)%/g))
      if(!s.alternativas[p[1]])s.alternativas[p[1]]={percentual:Number(p[2].replace(',','.'))};
  return s;
}
function prDadosBloco(q){
  const s=prStats(q),linhas=[];
  if(acertoPR(q)!=null)linhas.push(`Acerto dos alunos: ${acertoPR(q).toLocaleString('pt-BR')}%`);
  if(s.respostas!=null)linhas.push(`Respostas: ${s.respostas}`);
  if(s.respondentes!=null)linhas.push(`Alunos: ${s.respondentes}`);
  const alts=Object.entries(s.alternativas||{}).filter(([,v])=>Number.isFinite(v.percentual)).map(([l,v])=>`${l}: ${v.percentual.toLocaleString('pt-BR')}%${v.respostas!=null?' ('+v.respostas+' respostas)':''}`);
  if(alts.length)linhas.push('Alternativas marcadas: '+alts.join(' · '));
  const tempos=Object.entries(s.tempos||{}).filter(([,v])=>Number.isFinite(v)).map(([k,v])=>`${k}: ${v.toLocaleString('pt-BR')} ${k==='amostra'?'respostas':'s'}`);
  if(tempos.length)linhas.push('Tempo: '+tempos.join(' · '));
  else linhas.push(...prLinhas(q).filter(l=>/^Tempo:/i.test(l.trim())));
  return linhas.length?`<div class="ponto md pr-dados"><div class="kick">Dados do site</div>${linhas.map(l=>`<p>${esc(l)}</p>`).join('')}</div>`:'';
}
function prAviso(q){return q.pr_qualidade?.needsReview===true||q.pr_qualidade?.reportsOpen>0}
function prAvisoBloco(q){return prAviso(q)?'<small class="pr-aviso">⚠ possível erro na questão</small>':''}
function prProvaBloco(q){
  const p=q.pr_prova||{},nomes=[...(p.test||[]),...(p.year||[])];
  return nomes.length?`<small class="mut pr-prova">${esc(nomes.join(' · '))}</small>`:'';
}
function prAlternativa(q,l,fb){
  const p=prStats(q).alternativas?.[l]?.percentual;
  return fb&&typeof p==='number'&&Number.isFinite(p)&&p>=0&&p<=100?` <small class="pr-percentual">· ${l===q.gab?'✓ ':''}${p.toLocaleString('pt-BR',{maximumFractionDigits:2})}%</small>`:'';
}
function prNorm(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
function prContagens(dados){
  const contagens={};
  function guardar(tipo,nome,n){
    const k=prNorm(nome);
    if(tipo==='theme'&&k&&typeof n==='number'&&Number.isFinite(n)&&n>0)contagens[k]=Math.max(contagens[k]||0,n);
  }
  for(const t of dados?.termos||[])guardar(t.type,t.nome,t.questoes);
  function visitar(no){
    if(!no||typeof no!=='object')return;
    if(!Array.isArray(no))guardar(no.type,no.label||no.nome||no.name,no.subtreeQuestionsActiveCount??no.questionsActiveCount);
    for(const v of Object.values(no))if(v&&typeof v==='object')visitar(v);
  }
  visitar(dados?.arvores);
  return contagens;
}
let _prInc=null;
function prPesoTema(q){
  const dados=globalThis.TAXONOMIA_PR;
  if(!dados)return 1;
  if(!_prInc||_prInc.dados!==dados||_prInc.qs!==Q||_prInc.n!==Q.length){
    const contagens=prContagens(dados),nomes=new Set(Q.map(x=>prNorm(x.cl?.[0])).filter(k=>contagens[k]));
    const valores=[...nomes].map(k=>contagens[k]),media=valores.reduce((a,b)=>a+b,0)/(valores.length||1);
    _prInc={dados,qs:Q,n:Q.length,contagens,media};
  }
  const n=_prInc.contagens[prNorm(q.cl?.[0])];
  return n&&_prInc.media?Math.min(1.25,Math.max(.8,Math.pow(n/_prInc.media,.25))):1;
}
function pesoPR(q){
  // Multiplicadores suaves e cumulativos; nunca excluem uma questão.
  const prova=(q.pr_prova?.test||[]).some(t=>/\b(cbr|t[ií]tulo|prova|seriada)\b/i.test(t)&&!/simulad|treino/i.test(t));
  return (prAviso(q)?.6:1)*(prova?1.1:1)*prPesoTema(q);
}
