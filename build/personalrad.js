// Metadados PersonalRad: nunca entram nas tags/classificação do app.
function prAviso(q){return q.pr_qualidade?.needsReview===true||q.pr_qualidade?.reportsOpen>0}
function prAvisoBloco(q){return prAviso(q)?'<small class="pr-aviso">⚠ possível erro na questão</small>':''}
function prProvaBloco(q){
  const p=q.pr_prova||{},nomes=[...(p.test||[]),...(p.year||[])];
  return nomes.length?`<small class="mut pr-prova">${esc(nomes.join(' · '))}</small>`:'';
}
function prAlternativa(q,l,fb){
  const p=q.pr_stats?.alternativas?.[l]?.percentual;
  return fb&&typeof p==='number'&&Number.isFinite(p)&&p>=0&&p<=100?` <small class="pr-percentual">${p.toLocaleString('pt-BR',{maximumFractionDigits:2})}%</small>`:'';
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
