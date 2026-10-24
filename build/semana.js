// ===== ABA SEMANA = CALENDÁRIO DO MÊS (pedido do Artur, 21/10/2026) =====
// Dados: semana/plano.json no repo privado banco-cbr-app (mesma chave do app). Formato v2:
//  {v:2, regras, subtitulo, dias:{"AAAA-MM-DD":{agenda,tipo?,meta?}}, tarefas:[{id,dia,texto,area,sub?,feito,feitoEm,ordem,grupo?,auto?,adiado?}], notas:[...], tipos?:[{id,nome,subs?:[]}]}
// dia:'sem' = tarefa sem data (célula "Sem data" acima do calendário; fora da meta, das bolinhas e do "ficou para trás"). 'proxima' = adiada para a semana nova.
// tipos (criados pela tela): padrão Estudo, Ferramenta, Tarefas (subtema Casamento) quando faltar.
// tipo: "estudo" | "sobreaviso" | "descanso". Sem tipo: plantão BR = estudo (até sáb/dom/feriado); sáb/dom/feriado sem BR = descanso; resto (inclusive HSI em dia útil) = estudo. "sobreaviso" só se escolhido no dia.
// Dia também tem tema?, foco?, noite? (BR|HSI|''; sem = pela agenda), feriado? (sem = lista fixa). estagios:{"AAAA-MM":"RM MSK"} = estágio do mês.
// Meta de questões automática só nos dias de estudo (plantão na Ecomax conta como estudo). Descanso e sobreaviso: sem cor, sem meta.
// A revisão de domingo (tarefa agendada do Claude) preenche a agenda das próximas semanas pelo Google Agenda e põe os itens da semana nova.
const SM={d:null,sha:null,ok:false,erro:'',ed:null,add:{},dr:{},ab:new Set(),sel:null,sem:null,mes:null,plan:false,semAdd:null,conf:null,fila:Promise.resolve(),auto:new Set(),fr:[]};
const SM_ARQ='semana/plano.json',SM_VELHO='semana/atual.json';
try{const c=JSON.parse(localStorage.getItem('sm_cache2')||'null');if(c&&c.d&&c.d.v===2){SM.d=c.d;SM.sha=c.sha;SM.ok=true}}catch(e){}
const smDec=s=>decodeURIComponent(escape(atob(String(s).replace(/\n/g,''))));
const smId=()=>'x'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const smHoje=()=>dKey(Date.now());
const smDOW=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const smMES=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const smDt=iso=>{const[y,m,d]=iso.split('-').map(Number);return new Date(y,m-1,d,12)};
const smMais=(iso,n)=>{const x=smDt(iso);x.setDate(x.getDate()+n);return dKey(+x)};
const smRot=iso=>{if(iso==='proxima')return'Sem dia';if(iso==='sem')return'Sem data';const x=smDt(iso);return smDOW[x.getDay()]+' '+x.getDate()};
const smRotL=iso=>{const x=smDt(iso);return smDOW[x.getDay()]+' '+x.getDate()+'/'+String(x.getMonth()+1).padStart(2,'0')};
const smSeg=iso=>smMais(iso,-smDt(iso).getDay());        // início da semana = DOMINGO (1.17.0)
const smSemana=iso=>{const s=smSeg(iso);return Array.from({length:7},(_,i)=>smMais(s,i))};
const smNumSem=iso=>{const x=smDt(smMais(smSeg(iso),4)),a=new Date(x.getFullYear(),0,1,12);return 1+Math.floor(Math.round((x-a)/DAY)/7)};   // semana ISO (pela quinta-feira)
function smGuardaCache(){try{localStorage.setItem('sm_cache2',JSON.stringify({sha:SM.sha,d:SM.d}))}catch(e){}}

// ---------- leitura / gravação ----------
function smConverte(v){   // semana/atual.json (v1) -> plano v2
  const dias={};(v.dias||[]).forEach(x=>{dias[x.id]={agenda:x.agenda||''}});
  return {v:2,regras:v.regras||'',subtitulo:v.subtitulo||'',dias,tarefas:v.tarefas||[],notas:v.notas||[]};
}
async function smPuxar(){
  try{
    const f=await BCBR.api(`/repos/${BCBR.REPO}/contents/${SM_ARQ}`);
    SM.ok=true;SM.erro='';
    if(f.sha!==SM.sha){SM.d=JSON.parse(smDec(f.content));SM.sha=f.sha;smGuardaCache();smAuto();smRender()}
  }catch(e){
    SM.ok=true;
    if(e.status===404){
      try{const f=await BCBR.api(`/repos/${BCBR.REPO}/contents/${SM_VELHO}`);SM.d=smConverte(JSON.parse(smDec(f.content)))}catch(e2){SM.d={v:2,dias:{},tarefas:[],notas:[]}}
      SM.sha=null;smMudar(()=>{},'calendário do mês (primeira vez)');
    }else SM.erro='Sem conexão com o GitHub agora; mostrando a última cópia do aparelho.';
    smRender();
  }
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

// ---------- tipo do dia, meta e questões ----------
const smDia=iso=>(SM.d&&SM.d.dias&&SM.d.dias[iso])||{};
function smTipo(iso){
  const x=smDia(iso);if(x.tipo)return x.tipo;
  if(smNoite(iso)==='BR')return'estudo';   // plantão BR: estudo, até em fim de semana/feriado
  const w=smDt(iso).getDay();return w===0||w===6||smFeriado(iso)?'descanso':'estudo';   // HSI em dia útil = estudo normal
}
const smProvaIso=()=>cfg.prova||null;
const smRetaIni=()=>{const p=smProvaIso();return p?smMais(p,-(+(PARAM.revisao_final_dias??14))):null};
// dias de estudo de hoje (se hoje for de estudo) até a véspera da reta final — usado pela meta (banco.js › metaDia)
function smDiasEstudoRestantes(){
  const fim=smRetaIni();if(!fim)return null;let n=0;
  for(let x=smHoje();x<fim&&n<400;x=smMais(x,1))if(smTipo(x)==='estudo')n++;
  return n;
}
function smMetaDe(iso){
  if(smTipo(iso)!=='estudo')return 0;
  const hj=smHoje(),r=smRetaIni(),p=smProvaIso();
  if(p&&iso>=p)return 0;
  if(iso<hj)return smDia(iso).meta??cfg.diario;
  if(r&&iso>=r)return cfg.diario;
  if(iso===hj)return metaHoje();   // = tamanho da Revisão do dia (uma meta só em todo o app)
  return metaDia()||cfg.diario;
}
function smQ(dia){let n=0,ok=0;log.forEach(l=>{if(dKey(l.t)===dia){n++;if(l.ok)ok++}});return{n,ok}}
const smMeta=t=>{if((t.area||'estudo')!=='estudo'||t.dia==='sem')return 0;const s=String(t.texto),m=s.match(/(\d+)\s*quest/i);return m?+m[1]:/quest/i.test(s)&&t.dia!=='proxima'?smMetaDe(t.dia):0};
function smAuto(){   // marca sozinho "N questões" quando o banco chega à meta do dia; grava a meta de hoje 1x
  if(!SM.d)return;const hj=smHoje(),marcar=[];
  SM.d.tarefas.forEach(t=>{const m=smMeta(t);if(!m||t.feito||t.dia>hj||SM.auto.has(t.id))return;if(smQ(t.dia).n>=m){SM.auto.add(t.id);marcar.push(t.id)}});
  const feitoEm=new Date().toISOString();
  if(marcar.length)smMudar(d=>d.tarefas.forEach(t=>{if(marcar.includes(t.id)&&!t.feito){t.feito=true;t.auto=true;t.feitoEm=feitoEm}}),'questões do dia (automático)');
  if(smTipo(hj)==='estudo'&&!SM.auto.has('meta'+hj)){const m=metaHoje();if(m){SM.auto.add('meta'+hj);if(smDia(hj).meta!==m)smMudar(d=>{d.dias[hj]=d.dias[hj]||{};d.dias[hj].meta=m},'meta do dia')}}
}
function smCor(iso){
  const hj=smHoje();if(iso>hj||smTipo(iso)!=='estudo')return'';
  const m=smMetaDe(iso),n=smQ(iso).n;if(!m)return'';
  if(n>=m)return'c3';if(iso===hj)return'';
  return n===0?'c0':n<m*.6?'c1':'c2';
}
function smRitmo(){   // últimos 5 dias de estudo antes de hoje
  let x=smMais(smHoje(),-1),k=0,f=0,m=0;
  for(let i=0;i<40&&k<5;i++,x=smMais(x,-1))if(smTipo(x)==='estudo'){k++;f+=smQ(x).n;m+=smMetaDe(x)}
  return m?Math.round(f/m*100):null;
}
function smFracos(){   // últimos 14 dias, temas com 3+ respostas e menos de 70% de acerto
  const ini=Date.now()-14*DAY,M={};
  log.forEach(l=>{if(l.t<ini)return;const q=QID[l.q];if(!q||!q._x)return;(q._x.t||[]).forEach(t=>{const x=M[t]??={t,n:0,ok:0};x.n++;if(l.ok)x.ok++})});
  return Object.values(M).filter(x=>x.n>=3&&x.ok/x.n<0.7).sort((a,b)=>a.ok/a.n-b.ok/b.n||b.n-a.n).slice(0,6);
}
function smTreinar(i){const x=SM.fr[i];if(x)iniciar(questoesTema(x.t),'estudo')}
const smAgCurta=a=>/sobreaviso|hsi/i.test(a||'')?'S':/plant|ecomax 7|ecomax.*18/i.test(a||'')?'P':'';

// ---------- lista de prioridades (memoria/PRIORIDADES.md) → item "ferramenta" automático de cada dia (pedido do Artur, 21/10/2026) ----------
// Lê direto do repo memoria (se a chave do app tiver acesso de leitura a ele); senão usa a cópia semana/prioridades.md deste repo.
// Dia que está na tabela "Semana" da lista: usa a coluna Ferramenta (— = nada). Depois da tabela: projeto nº 1 da fila + próximo passo,
// nos dias de plantão BR (no máximo 2 por semana, regra do orçamento de ferramentas). Marcar feito grava dias[d].ferrOk.
const SMP={txt:null,sha:null,fonte:'',aberto:false};
try{const c=JSON.parse(localStorage.getItem('sm_pri')||'null');if(c){SMP.txt=c.txt;SMP.sha=c.sha;SMP.fonte=c.fonte}}catch(e){}
async function smPriPuxar(){
  for(const [repo,arq,fonte] of [['arturaragao/memoria','PRIORIDADES.md','memoria'],[BCBR.REPO,'semana/prioridades.md','copia']]){
    try{const f=await BCBR.api(`/repos/${repo}/contents/${arq}`);
      if(f.sha!==SMP.sha||SMP.fonte!==fonte){SMP.txt=smDec(f.content);SMP.sha=f.sha;SMP.fonte=fonte;SMP._p=null;try{localStorage.setItem('sm_pri',JSON.stringify({txt:SMP.txt,sha:SMP.sha,fonte}))}catch(e){}smRender()}
      return}catch(e){}
  }
}
const smLimpaMd=s=>String(s||'').replace(/\*\*/g,'').replace(/`/g,'').trim();
function smPriParse(){
  if(SMP._p)return SMP._p;const P={dias:{},fim:null,proj:'',passo:''};if(!SMP.txt)return P;
  const L=SMP.txt.split('\n'),cel=r=>r.trim().replace(/^\||\|$/g,'').split('|').map(x=>x.trim());
  const fi=L.findIndex(l=>/^##\s*Fila/i.test(l));
  if(fi>=0)for(let i=fi+1;i<L.length&&!/^##\s/.test(L[i]);i++){const c=cel(L[i]);if(c[0]==='1'){P.proj=smLimpaMd(c[1]).replace(/\s*\(.*?\)\s*/g,' ').trim();const ps=smLimpaMd(c[3]),k=ps.search(/Próximo:/i);let t=k>=0?ps.slice(k+9).trim():ps;if(t.length>110)t=t.slice(0,107).replace(/\s+\S*$/,'')+'…';P.passo=t;break}}
  const si=L.findIndex(l=>/^##\s*Semana\s+\d+/i.test(l));
  if(si>=0){const m=L[si].match(/(\d{1,2})\s*[–-]\s*(\d{1,2})\/(\d{1,2})/);
    if(m){const hj=smHoje(),y=+hj.slice(0,4),mf=+m[3],di=+m[1],df=+m[2],mi=di>df?mf-1:mf;
      const ini=dKey(+new Date(y,mi-1,di,12));P.fim=dKey(+new Date(y,mf-1,df,12));
      for(let i=si+1;i<L.length&&!/^##\s/.test(L[i]);i++){const c=cel(L[i]),dm=smLimpaMd(c[0]).match(/(\d{1,2})/);if(!dm||c.length<4)continue;
        const n=+dm[1],iso=dKey(+new Date(y,(n<di?mf:mi)-1,n,12));if(iso<ini||iso>P.fim)continue;const t=smLimpaMd(c[3]);P.dias[iso]=t&&t!=='—'&&t!=='-'&&!/^revisão semanal/i.test(t)?t:''}}}
  return SMP._p=P;
}
function smPriItem(iso){
  if(!SMP.txt||iso<smHoje())return null;const P=smPriParse();let t=null;
  if(P.fim&&iso<=P.fim){t=P.dias[iso]||null}
  else if(P.proj&&smNoite(iso)==='BR'){const br=smSemana(iso).filter(x=>smNoite(x)==='BR'&&(!P.fim||x>P.fim));if(br.indexOf(iso)>-1&&br.indexOf(iso)<2)t=P.proj+(P.passo?': '+P.passo:'')}
  if(!t)return null;
  return {id:'pf'+iso,dia:iso,texto:t,area:'ferramenta',feito:!!smDia(iso).ferrOk,feitoEm:SM_FEITAS_PRI[iso]||(iso+'T00:00:00'),pri:true,ordem:900};
}
function smPriCheck(iso,v){if(v)SM_FEITAS_PRI[iso]=new Date().toISOString();else delete SM_FEITAS_PRI[iso];try{localStorage.setItem('sm_feitas_pri',JSON.stringify(SM_FEITAS_PRI))}catch(e){}smMudar(d=>{const x=d.dias[iso]=d.dias[iso]||{};if(v)x.ferrOk=true;else delete x.ferrOk},v?'ferramenta feita':'ferramenta desmarcada')}
function smPriHtml(){   // markdown simples da lista (títulos, tabelas, listas)
  const s=String(SMP.txt||'').replace(/^---[\s\S]*?\n---\n/,'');
  return s.replace(/`/g,'').replace(/\[\[([^\]]+)\]\]/g,'$1').split('\n').map(l=>/^#{1,4}\s/.test(l)?'**'+l.replace(/^#+\s*/,'')+'**':l.replace(/^>\s?/,'')).join('\n');
}
function smPriCard(){
  const url='https://github.com/arturaragao/memoria/blob/main/PRIORIDADES.md';
  return `<div class="card sm-pri"><div class="row" style="justify-content:space-between;align-items:center"><button class="b s ${SMP.aberto?'':'sm-ghost'}" onclick="SMP.aberto=!SMP.aberto;render()">📋 Lista de prioridades</button><a class="mut" href="${url}" target="_blank" rel="noopener" style="font-size:.8rem">abrir no GitHub ↗</a></div>
   ${SMP.aberto?(SMP.txt?`<div class="sm-prit">${md(smPriHtml())}</div><p class="mut" style="font-size:.75rem;margin:6px 0 0">${SMP.fonte==='memoria'?'Direto do GitHub (memoria/PRIORIDADES.md), atualiza sozinho.':'Cópia no banco-cbr-app (atualizada pelo Claude a cada sessão de ferramenta e na revisão de domingo).'}</p>`:'<p class="mut">Carregando a lista…</p>'):''}</div>`;
}

// ---------- tipos e subtemas (Estudo, Ferramenta, Tarefas + os que o Artur criar pela tela) ----------
const SM_TIPOS0=[{id:'estudo',nome:'Estudo'},{id:'ferramenta',nome:'Ferramenta'},{id:'tarefas',nome:'Tarefas',subs:['Casamento']}];
const smTipos=()=>(SM.d&&Array.isArray(SM.d.tipos)&&SM.d.tipos.length?SM.d.tipos:SM_TIPOS0);
const smTipoDe=id=>smTipos().find(x=>x.id===id)||SM_TIPOS0.find(x=>x.id===id)||{id,nome:id?id[0].toUpperCase()+id.slice(1):'Estudo'};
const smTipoIco=id=>({estudo:'📚',ferramenta:'🛠️',tarefas:'✅'})[id]||'📌';
const smSlug=n=>String(n).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'tipo';
function smTiposGarante(d){if(!Array.isArray(d.tipos)||!d.tipos.length)d.tipos=JSON.parse(JSON.stringify(SM_TIPOS0));return d.tipos}
function smTipoNovo(nome){   // cria o tipo (se não existir) e devolve o id
  nome=String(nome||'').trim();if(!nome)return null;const ex=smTipos().find(x=>x.nome.toLowerCase()===nome.toLowerCase()),id=ex?ex.id:smSlug(nome);
  if(!ex)smMudar(d=>{const l=smTiposGarante(d);if(!l.some(x=>x.id===id))l.push({id,nome})},'novo tipo');return id;
}
function smSubNovo(tipo,nome){
  nome=String(nome||'').trim();if(!nome)return;
  smMudar(d=>{const t=smTiposGarante(d).find(x=>x.id===tipo);if(!t)return;t.subs=t.subs||[];if(!t.subs.some(x=>x.toLowerCase()===nome.toLowerCase()))t.subs.push(nome)},'novo subtema');
}
// <option> de todos os tipos (e "Tipo › subtema"); valor "tipo" ou "tipo|subtema"
function smOpcoes(sel){return smTipos().map(t=>`<option value="${esc(t.id)}" ${sel===t.id?'selected':''}>${esc(t.nome)}</option>`+(t.subs||[]).map(s=>`<option value="${esc(t.id+'|'+s)}" ${sel===t.id+'|'+s?'selected':''}>${esc(t.nome)} › ${esc(s)}</option>`).join('')).join('')}
const smParseTS=v=>{const i=String(v||'estudo').indexOf('|');return i<0?{area:v||'estudo',sub:''}:{area:v.slice(0,i),sub:v.slice(i+1)}};
// agrupa por tipo (na ordem dos tipos) e subtema; tipos/subtemas antigos que sumiram da lista ainda aparecem
function smAgrupa(its){
  const ord=smTipos().map(t=>t.id);its.forEach(t=>{const a=t.area||'estudo';if(!ord.includes(a))ord.push(a)});const out=[];
  ord.forEach(a=>{const l=its.filter(t=>(t.area||'estudo')===a);if(!l.length)return;const subs=smTipoDe(a).subs||[];
    const ks=['',...subs];l.forEach(t=>{if(t.sub&&!ks.includes(t.sub))ks.push(t.sub)});
    ks.forEach(k=>{const m=l.filter(t=>(t.sub||'')===k).sort((a,b)=>Number(!!b.urg)-Number(!!a.urg));if(m.length)out.push({a,sub:k,l:m})})});
  return out;
}

// ---------- ações ----------
const smTar=id=>SM.d&&SM.d.tarefas.find(t=>t.id===id);
const smGrupo=t=>t.grupo?SM.d.tarefas.filter(x=>x.grupo===t.grupo):[t];
const smItensDe=dia=>{const l=SM.d.tarefas.filter(t=>t.dia===dia),p=dia!=='proxima'&&dia!=='sem'&&smPriItem(dia);if(p)l.push(p);return l.sort((a,b)=>(a.ordem??0)-(b.ordem??0))};
function smSel(iso){SM.sel=SM.sel===iso?null:iso;SM.ed=null;render()}
function smSem(seg){SM.sem=SM.sem===seg?null:seg;SM.semAdd=null;SM.conf=null;render()}
function smMesVai(k){const[y,m]=(SM.mes||smHoje().slice(0,7)).split('-').map(Number),x=new Date(y,m-1+k,1,12);SM.mes=dKey(+x).slice(0,7);render()}
// O prazo usa feitoEm, inclusive para itens concluídos automaticamente ou em outro aparelho.
const SM_FEITAS={},SM_FEITAS_PRI={};
try{Object.assign(SM_FEITAS,JSON.parse(localStorage.getItem('sm_feitas')||'{}'))}catch(e){}
try{Object.assign(SM_FEITAS_PRI,JSON.parse(localStorage.getItem('sm_feitas_pri')||'{}'))}catch(e){}
let smFeitasTimer,smFeitasPrazo=Infinity;
const smFeitaHoje=t=>!!t.feito&&!!t.feitoEm&&dKey(+new Date(t.feitoEm))===smHoje();
function smVisiveis(dia){
  const its=smItensDe(dia),agora=Date.now();
  const prazos=its.filter(t=>t.feito).map(t=>+new Date(t.feitoEm)+5000-agora).filter(n=>n>0);
  const prazo=agora+Math.min(...prazos)+20;
  if(prazo<smFeitasPrazo){clearTimeout(smFeitasTimer);smFeitasPrazo=prazo;smFeitasTimer=setTimeout(()=>{smFeitasTimer=null;smFeitasPrazo=Infinity;smRender()},prazo-agora)}
  return its.filter(t=>!t.feito||+new Date(t.feitoEm)+5000>agora||(SM_FEITAS[dia]&&smFeitaHoje(t)));
}
function smFeitasBotao(dia){const n=smItensDe(dia).filter(smFeitaHoje).length;return `<button class="sm-tagb" aria-label="Mostrar ou esconder concluídas hoje" aria-pressed="${!!SM_FEITAS[dia]}" onclick="smFeitasAlterna('${dia}')">✓ ${n}</button>`}
function smFeitasAlterna(dia){SM_FEITAS[dia]=!SM_FEITAS[dia];try{localStorage.setItem('sm_feitas',JSON.stringify(SM_FEITAS))}catch(e){}render()}
function smCheck(id,v){const feitoEm=v?new Date().toISOString():null;smMudar(d=>{const t=d.tarefas.find(x=>x.id===id);if(t){t.feito=v;t.feitoEm=feitoEm;if(!v)delete t.auto}},v?'feito':'desmarcado');if(!v)SM.auto.add(id)}
function smUrgente(id){const t=smTar(id);if(!t)return;const urg=!t.urg;smMudar(d=>{const x=d.tarefas.find(y=>y.id===id);if(x){if(urg)x.urg=true;else delete x.urg}},'urgência do item')}
function smEdita(id){
  if(SM.ed&&SM.ed.id===id){smEdFecha();return}
  const t=smTar(id);if(!t)return;SM.ed={id,esc:'todos',dias:new Set(smGrupo(t).map(x=>x.dia).filter(x=>x!=='proxima'&&x!=='sem')),conf:false};render();
  const i=document.getElementById('sm_ed_txt');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length)}
}
function smChip(set,id,dias){if(id==='*'){if(dias.every(x=>set.has(x)))dias.forEach(x=>set.delete(x));else dias.forEach(x=>set.add(x))}else set.has(id)?set.delete(id):set.add(id);render()}
function smEdChip(id){const t=SM.ed&&smTar(SM.ed.id);t&&smChip(SM.ed.dias,id,smSemana(t.dia==='proxima'||t.dia==='sem'?smHoje():t.dia))}
function smEdEsc(v){if(SM.ed){SM.ed.esc=v;render()}}
function smEdConf(v){if(SM.ed){SM.ed.conf=v;render()}}
function smSalvar(id,textoDireto){
  if(id){const texto=String(textoDireto||'').trim(),t=smTar(id);if(t&&texto&&texto!==t.texto)smMudar(d=>{const x=d.tarefas.find(y=>y.id===id);if(x)x.texto=texto},'editou texto');return}
  const t=smTar(SM.ed&&SM.ed.id);if(!t)return;
  const texto=document.getElementById('sm_ed_txt').value.trim(),{area,sub}=smParseTS(document.getElementById('sm_ed_area').value);if(!texto)return;
  const urg=document.getElementById('sm_ed_urg').getAttribute('aria-pressed')==='true';
  const dtEl=document.getElementById('sm_ed_det'),det=dtEl?dtEl.value.trim():(t.det||'');const dEl=document.getElementById('sm_ed_dia'),nd=dEl?(dEl.value||(/^\d{4}-/.test(t.dia)?'sem':t.dia)):t.dia,mudouDia=!!dEl&&nd!==t.dia;
  const g=smGrupo(t),ligado=g.length>1;
  const aplica=(x,sd)=>{x.texto=texto;x.area=area;if(urg)x.urg=true;else delete x.urg;if(det)x.det=det;else delete x.det;if(sub)x.sub=sub;else delete x.sub;if(sd){x.dia=nd;delete x.grupo;x.ordem=100+SM.d.tarefas.filter(y=>y.dia===nd).length}};
  if((ligado&&SM.ed.esc==='este')||t.dia==='sem'||(!ligado&&mudouDia)){const id=t.id,sd=mudouDia;smRascEdLimpa();SM.ed=null;smMudar(d=>{const x=d.tarefas.find(y=>y.id===id);if(x)aplica(x,sd)},'editou item');return}
  const semana=new Set(smSemana(t.dia==='proxima'?smHoje():t.dia)),dias=[...SM.ed.dias].filter(x=>semana.has(x));
  if(!dias.length&&t.dia!=='proxima'&&g.every(x=>semana.has(x.dia))){toast('Escolha pelo menos um dia (ou use Excluir).');return}
  const gid=t.grupo||(dias.length>1?'g'+smId():null),tem=new Set(g.map(x=>x.dia)),ids=g.map(x=>x.id);
  const fora=g.filter(x=>semana.has(x.dia)&&!SM.ed.dias.has(x.dia)).map(x=>x.id);   // só mexe nos dias desta semana
  const novos=dias.filter(dia=>!tem.has(dia)).map(dia=>({id:smId(),dia,texto,area,...(urg?{urg:true}:{}),...(sub?{sub}:{}),...(det?{det}:{}),feito:false,ordem:100+smItensDe(dia).length,...(gid?{grupo:gid}:{})}));
  smRascEdLimpa();SM.ed=null;
  smMudar(d=>{d.tarefas=d.tarefas.filter(x=>!fora.includes(x.id));d.tarefas.forEach(x=>{if(ids.includes(x.id)){aplica(x,false);if(gid)x.grupo=gid}});
    novos.forEach(n=>{if(!d.tarefas.some(x=>x.id===n.id))d.tarefas.push({...n})})},'editou item');
}
function smExcluir(){
  const t=smTar(SM.ed&&SM.ed.id);if(!t)return;const ids=(SM.ed.conf==='todos'?smGrupo(t):[t]).map(x=>x.id);smRascEdLimpa();SM.ed=null;
  smMudar(d=>{d.tarefas=d.tarefas.filter(x=>!ids.includes(x.id))},'excluiu item');
}
function smProxEstudo(base){let x=smMais(base,1);for(let i=0;i<60;i++,x=smMais(x,1))if(smTipo(x)==='estudo')return x;return'proxima'}
function smAdiar(id){   // passa para o próximo dia de estudo (pula descanso e sobreaviso)
  const t=smTar(id);if(!t)return;const base=t.dia==='proxima'||t.dia==='sem'||t.dia<smHoje()?smMais(smHoje(),-1):t.dia,alvo=smProxEstudo(base);smRascEdLimpa();SM.ed=null;
  smMudar(d=>{const x=d.tarefas.find(y=>y.id===id);if(!x||x.dia===alvo)return;
    if(x.grupo&&d.tarefas.some(y=>y.id!==id&&y.grupo===x.grupo&&y.dia===alvo)){d.tarefas=d.tarefas.filter(y=>y.id!==id);return}
    x.dia=alvo;x.feito=false;x.adiado=(x.adiado||0)+1;x.ordem=200+d.tarefas.filter(y=>y.dia===alvo).length},'adiou item');
  toast(alvo==='proxima'?'Ficou sem dia':'Passou para '+smRotL(alvo));
}
function smNovos(dias,texto,area,sub,det){const gid=dias.length>1?'g'+smId():null;det=String(det||'').trim();return dias.map(x=>({id:smId(),dia:x,texto,area,...(sub?{sub}:{}),...(det?{det}:{}),feito:false,ordem:100+smItensDe(x).length,...(gid?{grupo:gid}:{})}))}
function smPoe(novos,msg){smMudar(d=>novos.forEach(n=>{if(!d.tarefas.some(x=>x.id===n.id))d.tarefas.push({...n})}),msg)}
function smAddDias(dia){if(SM.add[dia])delete SM.add[dia];else SM.add[dia]=new Set([dia]);render()}
function smAddChip(dia,id){SM.add[dia]&&smChip(SM.add[dia],id,smSemana(dia))}
function smAdd(dia){
  const inp=document.getElementById('sm_add_'+dia),v=(inp&&inp.value||'').trim();if(!v)return;
  const ts=smParseTS(document.getElementById('sm_area_'+dia).value),alvo=SM.add[dia]&&SM.add[dia].size?[...SM.add[dia]]:[dia];
  const dt=document.getElementById('sm_det_'+dia),det=dt?dt.value:'';delete SM.add[dia];delete SM.dr['sm_add_'+dia];delete SM.dr['sm_det_'+dia];if(SM.addDet)delete SM.addDet[dia];smPoe(smNovos(alvo,v,ts.area,ts.sub,det),'novo item');
}
function smAgenda(iso,v){v=String(v||'').trim();smMudar(d=>{d.dias[iso]=d.dias[iso]||{};d.dias[iso].agenda=v},'agenda do dia')}
function smTipoMuda(iso,v){smMudar(d=>{d.dias[iso]=d.dias[iso]||{};if(v==='auto')delete d.dias[iso].tipo;else d.dias[iso].tipo=v;delete d.dias[iso].meta},'tipo do dia')}
// semana inteira
function smSemAdd(seg){SM.semAdd=SM.semAdd?null:new Set(smSemana(seg).filter(x=>x>=smHoje()&&smTipo(x)==='estudo'));render()}
function smSemChip(seg,id){SM.semAdd&&smChip(SM.semAdd,id,smSemana(seg))}
function smSemPor(seg){
  const i=document.getElementById('sm_sem_txt'),v=(i&&i.value||'').trim();if(!v||!SM.semAdd||!SM.semAdd.size){toast('Escreva o item e escolha os dias.');return}
  const ts=smParseTS(document.getElementById('sm_sem_area').value),dias=[...SM.semAdd].sort();SM.semAdd=null;delete SM.dr.sm_sem_txt;smPoe(smNovos(dias,v,ts.area,ts.sub),'item na semana');
}
function smSemCopia(seg){
  const its=smSemana(seg).flatMap(smItensDe);if(!its.length){toast('Semana sem itens.');return}
  const mapa={},novos=its.map(t=>{const g=t.grupo?(mapa[t.grupo]??='g'+smId()):null;return{id:smId(),dia:smMais(t.dia,7),texto:t.texto,area:t.area||'estudo',...(t.urg?{urg:true}:{}),...(t.sub?{sub:t.sub}:{}),...(t.det?{det:t.det}:{}),feito:false,ordem:t.ordem??0,...(g?{grupo:g}:{})}});
  smPoe(novos,'copiou a semana');toast(`${novos.length} itens copiados para a semana de ${smRotL(smMais(seg,7))}`);
}
function smSemLimpa(seg){
  const ds=new Set(smSemana(seg)),n=SM.d.tarefas.filter(t=>ds.has(t.dia)&&!t.feito).length;SM.conf=null;
  smMudar(d=>{d.tarefas=d.tarefas.filter(t=>!(ds.has(t.dia)&&!t.feito))},'limpou a semana');toast(n+' itens não feitos apagados');
}
// mês inteiro
function smMesDias(rep,ate,esc){
  const hj=smHoje(),[y,m]=(SM.mes||hj.slice(0,7)).split('-').map(Number),ini=dKey(+new Date(y,m-1,1,12));
  let fim=ate==='prova'&&smProvaIso()?smMais(smProvaIso(),-1):dKey(+new Date(y,m,0,12));const out=[];
  for(let x=ini>hj?ini:hj;x<=fim&&out.length<120;x=smMais(x,1)){
    const w=smDt(x).getDay(),t=smTipo(x);
    if(rep==='estudo'?t==='estudo':rep==='uteis'?w>0&&w<6:rep==='sqs'?[1,3,5].includes(w):rep==='todos'?true:esc&&esc.has(x))out.push(x);
  }
  return out;
}
function smMesPor(){
  const v=(document.getElementById('sm_mes_txt').value||'').trim(),ts=smParseTS(document.getElementById('sm_mes_area').value),rep=document.getElementById('sm_mes_rep').value,ate=document.getElementById('sm_mes_ate').value;
  if(!v){toast('Escreva o item.');return}
  const dias=smMesDias(rep,ate,SM.mesEsc);if(!dias.length){toast('Nenhum dia nesse período.');return}
  delete SM.dr.sm_mes_txt;smPoe(smNovos(dias,v,ts.area,ts.sub),'item no mês');toast(`Item posto em ${dias.length} dias`);
}
function smMesRep(v){SM.mesRep=v;if(v==='escolher'&&!SM.mesEsc)SM.mesEsc=new Set();render()}
function smMesChip(x){SM.mesEsc.has(x)?SM.mesEsc.delete(x):SM.mesEsc.add(x);render()}
function smMesLimpa(){
  const hj=smHoje(),mes=SM.mes||hj.slice(0,7),n=SM.d.tarefas.filter(t=>t.dia.startsWith(mes)&&t.dia>=hj&&!t.feito).length;SM.conf=null;
  smMudar(d=>{d.tarefas=d.tarefas.filter(t=>!(t.dia.startsWith(mes)&&t.dia>=hj&&!t.feito))},'limpou o mês');toast(n+' itens não feitos apagados (de hoje em diante)');
}
function smNota(){
  const i=document.getElementById('sm_nota'),v=(i&&i.value||'').trim();if(!v)return;
  const n={id:smId(),texto:v,em:new Date().toISOString(),...(document.getElementById('sm_fraco').checked?{fraco:true}:{})};delete SM.dr.sm_nota;
  smMudar(d=>{d.notas=d.notas||[];if(!d.notas.some(x=>x.id===n.id))d.notas.push(n)},'anotação');
}
function smNotaFraco(id){smMudar(d=>{const n=(d.notas||[]).find(x=>x.id===id);if(n){if(n.fraco)delete n.fraco;else n.fraco=true}},'tema fraco')}
function smNotaDel(id){smMudar(d=>{d.notas=(d.notas||[]).filter(x=>x.id!==id)},'apagou anotação')}
function smProva(v){if(!v)return;cfg.prova=v;persist('_est');render()}

// ---------- telas ----------
const smVal=(id,pad)=>esc(SM.dr[id]??pad??'');
const smTipoNome={estudo:'Estudo',sobreaviso:'Sobreaviso',descanso:'Descanso'};
function smChips(set,mk,dias){return `<div class="sm-chips">${dias.map(x=>`<button type="button" class="sm-chip ${smTipo(x)!=='estudo'?'fraco':''}" aria-pressed="${set.has(x)}" onclick="${mk(x)}">${smRot(x)}</button>`).join('')}<button type="button" class="sm-chip" aria-pressed="${dias.every(x=>set.has(x))}" onclick="${mk('*')}">Todos</button></div>`}
// rascunho da edição de tarefa (localStorage a cada tecla; some ao salvar/cancelar/excluir)
const SM_RASC_ED='bcbr_rasc_edicao';
const smRascEd=id=>{try{const r=JSON.parse(localStorage.getItem(SM_RASC_ED)||'null');return r&&r.id===id?r:null}catch(e){return null}};
function smRascEdSalva(id){
  const g=k=>document.getElementById(k),a=g('sm_ed_txt');if(!a)return;
  try{localStorage.setItem(SM_RASC_ED,JSON.stringify({id,texto:a.value,det:g('sm_ed_det')?g('sm_ed_det').value:undefined,area:g('sm_ed_area').value,urg:g('sm_ed_urg').getAttribute('aria-pressed')==='true',dia:g('sm_ed_dia')?g('sm_ed_dia').value:undefined}))}catch(e){}
}
const smRascEdLimpa=()=>{try{localStorage.removeItem(SM_RASC_ED)}catch(e){}};
function smEdFecha(){smRascEdLimpa();SM.ed=null;render()}
function smEditor(t){
  const rd=smRascEd(t.id)||{};
  const g=smGrupo(t),lig=g.length>1,todos=!lig||SM.ed.esc==='todos',prox=t.dia==='proxima'||t.dia==='sem',sem=smSemana(prox?smHoje():t.dia),outras=g.filter(x=>!sem.includes(x.dia)).length;
  return `<div class="sm-ed">
   <div class="row"><input id="sm_ed_txt" value="${esc(rd.texto??t.texto)}" style="flex:1 1 200px;min-width:0" oninput="smRascEdSalva('${t.id}')" onkeydown="if(event.key==='Enter')smSalvar();if(event.key==='Escape')smEdFecha()" aria-label="Texto">
     <select id="sm_ed_area" aria-label="Tipo" onchange="smRascEdSalva('${t.id}')">${smOpcoes(rd.area??(t.sub?(t.area||'estudo')+'|'+t.sub:(t.area||'estudo')))}</select><button type="button" id="sm_ed_urg" class="sm-tagb" aria-label="Urgente" aria-pressed="${rd.urg??!!t.urg}" onclick="this.setAttribute('aria-pressed',this.getAttribute('aria-pressed')!=='true');smRascEdSalva('${t.id}')">! urgente</button></div>
   <textarea id="sm_ed_det" class="sm-detin" rows="3" placeholder="Detalhes (opcional): aparecem ao abrir a tarefa (▸)" aria-label="Detalhes" oninput="smRascEdSalva('${t.id}')">${esc(rd.det??t.det??'')}</textarea>
   ${!lig||SM.ed.esc==='este'?`<div class="row"><span class="sm-lbl">Data</span><input type="date" id="sm_ed_dia" class="sm-date" value="${rd.dia!=null?rd.dia:/^\d{4}-/.test(t.dia)?t.dia:''}" aria-label="Data" onchange="smRascEdSalva('${t.id}')"><button type="button" class="sm-tagb" onclick="document.getElementById('sm_ed_dia').value='';smRascEdSalva('${t.id}')">sem data</button>${t.dia==='proxima'?'<span class="mut">(hoje: sem dia, semana nova)</span>':''}</div>`:''}
   ${lig?`<div class="row"><span class="sm-lbl">Aplicar em</span><div class="sm-seg"><button type="button" aria-pressed="${SM.ed.esc==='este'}" onclick="smEdEsc('este')">Só neste dia</button><button type="button" aria-pressed="${SM.ed.esc==='todos'}" onclick="smEdEsc('todos')">Todos os ${g.length} dias</button></div></div>`:''}
   ${todos&&!prox?`<span class="sm-lbl">Dias desta semana${outras?` <span class="mut">(+${outras} em outras semanas, ficam como estão)</span>`:''}</span>${smChips(SM.ed.dias,x=>`smEdChip('${x}')`,sem)}`:''}
   ${SM.ed.conf?`<div class="row"><span class="sm-conf">${SM.ed.conf==='todos'?`Excluir dos ${g.length} dias?`:'Excluir este item?'}</span><span style="flex:1"></span><button class="b s sm-ghost" onclick="smEdConf(false)">Não</button><button class="b s sm-del" onclick="smExcluir()">Excluir</button></div>`
   :`<div class="row"><button class="b s sm-ghost" onclick="smAdiar('${t.id}')">Passar para o próximo dia de estudo</button><button class="b s sm-danger" onclick="smEdConf('este')">${lig?'Excluir só deste dia':'Excluir'}</button>${lig?`<button class="b s sm-danger" onclick="smEdConf('todos')">De todos</button>`:''}<span style="flex:1"></span><button class="b s sm-ghost" onclick="smEdFecha()">Cancelar</button><button class="b s" onclick="smSalvar()">Salvar</button></div>`}
  </div>`;
}
function smTextoTecla(e,el){
  if(e.isComposing)return;
  if(e.key==='Enter'&&(!el.classList.contains('sm-det')||e.ctrlKey)){e.preventDefault();el.blur()}
  else if(e.key==='Escape'){e.preventDefault();el.dataset.cancela='1';el.blur()}
}
// Texto e detalhes da tarefa só viram editáveis no CLIQUE (não no toque/botão do mouse): editável o tempo todo atrapalhava
// o segurar e arrastar (1.16.0). Depois do clique: cursor onde tocou; Enter/clicar fora salva, Esc desfaz.
function smEditavel(ev,el,texto){
  if(el.isContentEditable||(ev.target.closest&&ev.target.closest('a')))return;
  el.dataset.original=texto;el.textContent=texto;el.classList.add('ed');el.setAttribute('contenteditable','plaintext-only');el.focus();
  try{let r=null;const x=ev.clientX,y=ev.clientY;
    if(document.caretPositionFromPoint){const p=document.caretPositionFromPoint(x,y);if(p&&el.contains(p.offsetNode)){r=document.createRange();r.setStart(p.offsetNode,p.offset)}}
    else if(document.caretRangeFromPoint){r=document.caretRangeFromPoint(x,y);if(r&&!el.contains(r.startContainer))r=null}
    if(!r){r=document.createRange();r.selectNodeContents(el);r.collapse(false)}
    r.collapse(true);const sel=getSelection();sel.removeAllRanges();sel.addRange(r)}catch(e){}
}
function smTxtIni(ev,el,id){const t=smTar(id);if(t)smEditavel(ev,el,t.texto)}
function smTxtFim(el,id){
  el.removeAttribute('contenteditable');el.classList.remove('ed');
  const v=el.textContent.trim(),cancela=el.dataset.cancela==='1';delete el.dataset.cancela;
  if(!cancela&&v&&v!==el.dataset.original)smSalvar(id,v);else el.textContent=el.dataset.original;
}
function smDetIni(ev,el,id){const t=smTar(id);if(t)smEditavel(ev,el,t.det||'')}
function smDetFim(el,id){
  el.removeAttribute('contenteditable');el.classList.remove('ed');
  const v=el.innerText.replace(/\s+$/,'').trim(),cancela=el.dataset.cancela==='1';delete el.dataset.cancela;
  if(cancela||v===el.dataset.original){render();return}
  smMudar(d=>{const x=d.tarefas.find(y=>y.id===id);if(x){if(v)x.det=v;else delete x.det}},'editou detalhes');
}
function smTexto(t){return `<span class="sm-texto" role="textbox" aria-label="Texto da tarefa (clique para editar)" spellcheck="true" onclick="smTxtIni(event,this,'${t.id}')" onkeydown="smTextoTecla(event,this)" onblur="smTxtFim(this,'${t.id}')">${esc(t.texto)}</span>`}
function smItem(t){
  const g=t.grupo?SM.d.tarefas.filter(x=>x.grupo===t.grupo):[t],ed=SM.ed&&SM.ed.id===t.id,m=smMeta(t),q=m&&t.dia!=='proxima'&&t.dia!=='sem'?smQ(t.dia):null;
  if(t.pri)return `<div class="sm-row ${t.feito?'ok':''}"><div class="sm-it"><input type="checkbox" aria-label="Concluir prioridade" ${t.feito?'checked':''} onchange="smPriCheck('${t.dia}',this.checked)"><span class="sm-tx">${esc(t.texto)} <span class="sm-tag" title="Vem da lista de prioridades (muda sozinho quando a lista muda)">prioridades</span></span></div></div>`;
  const ab=t.det&&SM.ab.has(t.id),tg=t.det?`<button class="sm-tg" onclick="smTg('${t.id}')" aria-expanded="${!!ab}" aria-label="Detalhes">${ab?'▾':'▸'}</button>`:'';
  return `<div class="sm-row ${t.feito?'ok':''} ${t.det?'tem-det':''} ${t.urg?'sm-urg t-'+smCorTipo(t.area):''}" data-tid="${t.id}"><div class="sm-it"><input type="checkbox" aria-label="Concluir tarefa" ${t.feito?'checked':''} onchange="smCheck('${t.id}',this.checked)">${tg}<span class="sm-tx">${smTexto(t)}${g.length>1?` <span class="sm-tag">${g.filter(x=>x.feito).length}/${g.length} dias</span>`:''}${q&&q.n?` <span class="sm-tag ${q.n>=m?'g':''}">banco ${q.n}/${m}</span>`:''}${t.auto?' <span class="sm-tag g">automático</span>':''}</span></div>
   <button class="sm-edb" onclick="smEdita('${t.id}')" aria-label="Editar" aria-expanded="${!!ed}">✎</button></div>${ab?`<div class="sm-det" role="textbox" aria-label="Detalhes da tarefa (clique para editar)" onclick="smDetIni(event,this,'${t.id}')" onkeydown="smTextoTecla(event,this)" onblur="smDetFim(this,'${t.id}')">${md(t.det)}</div>`:''}${ed?smEditor(t):''}`;
}
function smGrupos(its){
  const g=smAgrupa(its);if(!g.length)return'';
  return `<div class="sm-gs">${g.map(x=>`<div class="sm-grp sm-${esc(x.a)}"><span class="sm-lbl">${esc(smTipoDe(x.a).nome)}${x.sub?` <i>› ${esc(x.sub)}</i>`:''}</span>${x.l.map(smItem).join('')}</div>`).join('')}</div>`;
}
function smAddDet(dia){SM.addDet=SM.addDet||{};SM.addDet[dia]=!SM.addDet[dia];render();const i=document.getElementById(SM.addDet[dia]?'sm_det_'+dia:'sm_add_'+dia);i&&i.focus()}
function smTg(id){SM.ab.has(id)?SM.ab.delete(id):SM.ab.add(id);render()}
function smAddLinha(dia){
  const add=SM.add[dia],dt=SM.addDet&&SM.addDet[dia];
  return `<div class="sm-add sm-c1"><div class="row"><input id="sm_add_${dia}" placeholder="Adicionar item" value="${smVal('sm_add_'+dia)}" oninput="SM.dr[this.id]=this.value" onkeydown="if(event.key==='Enter')smAdd('${dia}')" style="flex:1;min-width:0">
     <select id="sm_area_${dia}" aria-label="Tipo">${smOpcoes(dia==='sem'?'tarefas':undefined)}</select>
     <button class="b s sm-ghost" aria-pressed="${!!dt}" onclick="smAddDet('${dia}')" title="Detalhes (texto que aparece ao abrir a tarefa)">≡</button>${dia==='sem'?'':`<button class="b s sm-ghost" aria-pressed="${!!add}" onclick="smAddDias('${dia}')">+ dias</button>`}<button class="b s" onclick="smAdd('${dia}')">+</button></div>
     ${dt?`<textarea id="sm_det_${dia}" class="sm-detin" rows="3" placeholder="Detalhes (opcional): aparecem ao abrir a tarefa (▸)" oninput="SM.dr[this.id]=this.value">${smVal('sm_det_'+dia)}</textarea>`:''}
     ${add?smChips(add,x=>`smAddChip('${dia}','${x}')`,smSemana(dia)):''}</div>`;
}
function smTipoSeg(iso){const x=smDia(iso),t=smTipo(iso);
  return `<div class="sm-seg">${['estudo','sobreaviso','descanso'].map(k=>`<button type="button" aria-pressed="${t===k}" onclick="smTipoMuda('${iso}','${k}')">${smTipoNome[k]}</button>`).join('')}</div>${x.tipo?`<button class="sm-tagb" onclick="smTipoMuda('${iso}','auto')" title="Volta ao automático (fim de semana = descanso, HSI = sobreaviso)">automático</button>`:''}`}
// cartão de hoje, grande
function smHojeGrande(){
  const hj=smHoje(),x=smDt(hj),ag=smDia(hj).agenda||'',tp=smTipo(hj),its=smVisiveis(hj);
  return `<div class="card sm-hoje sm-hoje1" data-drop="${hj}"><div class="sm-hl">
    <div class="sm-hh"><span class="kick">Hoje${tp!=='estudo'?` · ${smTipoNome[tp].toLowerCase()}`:''}</span>${smFeitasBotao(hj)}
     <h2>${['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'][x.getDay()]}, ${x.getDate()} de ${smMES[x.getMonth()]}</h2>
     <div class="sm-ags">${smNt(smNoite(hj))}${smEvs(hj)}${smEstagio(hj.slice(0,7))?`<span class="sm-agc">${esc(smEstagio(hj.slice(0,7)))}</span>`:''}${smFeriado(hj)?`<span class="sm-fe">${esc(smFeriado(hj))}</span>`:''}${smAgResto(ag)?`<span class="sm-agc">${esc(smAgResto(ag))}</span>`:''}${smDia(hj).tema?`<span class="sm-htm">${esc(smDia(hj).tema)}</span>`:''}${smDia(hj).foco?`<span class="sm-fo">+ ${esc(smDia(hj).foco)}</span>`:''}<button class="sm-tagb" onclick="smSel('${hj}')">editar dia</button></div></div>
    ${smGrupos(its)}${smAddLinha(hj)}</div>
  </div>`;
}
// célula "Sem data" (tarefas com dia:'sem'), acima do calendário; marcável, editável e navegável pelo teclado como as de hoje
function smSemData(){
  const its=smVisiveis('sem');
  return `<div class="card sm-sd" data-drop="sem"><div class="sm-hh"><span class="kick">Tarefas${its.length?` · ${its.filter(t=>t.feito).length}/${its.length}`:''}</span>${smFeitasBotao('sem')}</div>
   ${smGrupos(its)}${smAddLinha('sem')}</div>`;
}
function smPainelDia(iso){
  const x=smDia(iso),its=smItensDe(iso),q=smQ(iso),m=smMetaDe(iso);
  return `<div class="sm-pan" data-drop="${iso}"><div class="row" style="justify-content:space-between"><b>${smRotL(iso)}</b><span class="mut">${q.n} questões${m?` · meta ${m}`:''}</span><button class="sm-edb" onclick="smSel(null)" aria-label="Fechar">×</button></div>
   <div class="row"><input placeholder="Agenda do dia (ex.: Plantão Ecomax 18–0h)" value="${esc(x.agenda||'')}" onchange="smAgenda('${iso}',this.value)" style="flex:1 1 220px;min-width:0" aria-label="Agenda do dia">${smTipoSeg(iso)}</div>
   <div class="row sm-campos"><input placeholder="Tema do dia (ex.: RM Joelho)" value="${esc(x.tema||'')}" onchange="smCampo('${iso}','tema',this.value)" aria-label="Tema do dia"><input placeholder="Foco específico (ex.: USG tireoide TI-RADS)" value="${esc(x.foco||'')}" onchange="smCampo('${iso}','foco',this.value)" aria-label="Foco do dia"><input placeholder="Feriado" value="${esc(smFeriado(iso))}" onchange="smCampo('${iso}','feriado',this.value)" aria-label="Feriado"></div>
   <div class="row"><span class="sm-lbl">Noite</span><div class="sm-seg">${[['BR','BR plantão'],['HSI','HSI sobreaviso'],['','Nada']].map(([k,n])=>`<button type="button" aria-pressed="${smNoite(iso)===k}" onclick="smCampo('${iso}','noite','${k}')">${n}</button>`).join('')}</div>${x.noite!=null?`<button class="sm-tagb" onclick="smCampo('${iso}','noite','auto')" title="Volta a seguir a agenda">pela agenda</button>`:''}</div>
   ${smEvEditor(iso)}
   ${smGrupos(its)||'<p class="mut" style="margin:0">Nenhum item neste dia.</p>'}${smAddLinha(iso)}</div>`;
}
function smPainelSemana(seg){
  const ds=smSemana(seg),hj=smHoje(),meta=ds.reduce((a,x)=>a+smMetaDe(x),0),feitas=ds.reduce((a,x)=>a+smQ(x).n,0),add=SM.semAdd;
  return `<div class="sm-pan"><div class="row"><b>Semana ${smNumSem(seg)} · ${smDt(ds[0]).getDate()}–${smDt(ds[6]).getDate()}/${String(smDt(ds[6]).getMonth()+1).padStart(2,'0')}</b><span class="mut">meta ${meta} questões · feitas ${feitas}</span><span style="flex:1"></span>
    <button class="b s sm-ghost" aria-pressed="${!!add}" onclick="smSemAdd('${seg}')">+ item na semana</button><button class="b s sm-ghost" onclick="smSemCopia('${seg}')">Copiar para a próxima</button>
    ${SM.conf==='sem'?`<span class="sm-conf">Apagar os não feitos?</span><button class="b s sm-ghost" onclick="SM.conf=null;render()">Não</button><button class="b s sm-del" onclick="smSemLimpa('${seg}')">Apagar</button>`:`<button class="b s sm-danger" onclick="SM.conf='sem';render()">Limpar semana</button>`}<button class="sm-edb" onclick="smSem(null)" aria-label="Fechar">×</button></div>
   ${add?`<div class="sm-add"><div class="row"><input id="sm_sem_txt" placeholder="Item para vários dias da semana" value="${smVal('sm_sem_txt')}" oninput="SM.dr[this.id]=this.value" onkeydown="if(event.key==='Enter')smSemPor('${seg}')" style="flex:1;min-width:0"><select id="sm_sem_area" aria-label="Tipo">${smOpcoes()}</select><button class="b s" onclick="smSemPor('${seg}')">Adicionar</button></div>${smChips(add,x=>`smSemChip('${seg}','${x}')`,ds)}</div>`:''}
   <div class="sm-wcs">${ds.map(x=>{const t=smTipo(x),its=smItensDe(x),q=smQ(x);return `<div class="sm-wc ${x===hj?'hoje':''} ${t!=='estudo'?'off':''}" data-drop="${x}"><button class="sm-wch" onclick="smSel('${x}')"><b>${smRot(x)}</b><small>${esc(smDia(x).agenda||smTipoNome[t])}</small>${q.n?`<small>${q.n} q</small>`:''}</button>${its.map(smItem).join('')}<button class="sm-wadd" onclick="smSel('${x}')">+ item</button></div>`}).join('')}</div></div>`;
}
function smPainelMes(){
  const rep=SM.mesRep||'estudo',mes=SM.mes||smHoje().slice(0,7);
  const escolher=rep==='escolher'?`<div class="sm-chips">${smMesDias('todos','mes').map(x=>`<button type="button" class="sm-chip ${smTipo(x)!=='estudo'?'fraco':''}" aria-pressed="${SM.mesEsc.has(x)}" onclick="smMesChip('${x}')">${smRot(x)}</button>`).join('')}</div>`:'';
  return `<div class="sm-pan"><div class="row"><b>Planejar ${smMES[+mes.slice(5)-1]}</b><span class="mut">vale de hoje em diante</span><span style="flex:1"></span><button class="sm-edb" onclick="SM.plan=false;render()" aria-label="Fechar">×</button></div>
   <div class="sm-add"><div class="row"><input id="sm_mes_txt" placeholder="Ex.: Questões do dia · 1 tema de tórax" value="${smVal('sm_mes_txt')}" oninput="SM.dr[this.id]=this.value" style="flex:1 1 220px;min-width:0"><select id="sm_mes_area" aria-label="Tipo">${smOpcoes()}</select></div>
    <div class="row"><select id="sm_mes_rep" onchange="smMesRep(this.value)" aria-label="Repetir">${[['estudo','Dias de estudo (sem descanso e sobreaviso)'],['uteis','Seg a sex'],['sqs','Seg, qua e sex'],['todos','Todo dia'],['escolher','Escolher os dias']].map(([k,n])=>`<option value="${k}" ${rep===k?'selected':''}>${n}</option>`).join('')}</select>
     <select id="sm_mes_ate" aria-label="Até"><option value="mes">até o fim do mês</option>${smProvaIso()?'<option value="prova">até a prova</option>':''}</select><button class="b s" onclick="smMesPor()">Adicionar</button></div>${escolher}
    <p class="mut" style="margin:0">Dica: um item “Questões do dia” (sem número) usa a meta automática de cada dia e marca sozinho.</p></div>
   <div class="row">${SM.conf==='mes'?`<span class="sm-conf">Apagar os itens não feitos do mês (de hoje em diante)?</span><button class="b s sm-ghost" onclick="SM.conf=null;render()">Não</button><button class="b s sm-del" onclick="smMesLimpa()">Apagar</button>`:`<button class="b s sm-danger" onclick="SM.conf='mes';render()">Limpar itens não feitos do mês</button>`}</div></div>`;
}
// ---------- estágio do mês, noite (BR/HSI), feriados, tema do dia (pedido do Artur, 21/10/2026) ----------
const smEstagio=mes=>(SM.d&&SM.d.estagios&&SM.d.estagios[mes])||'';
function smEstagioEdita(mes){
  const v=prompt('Estágio de '+smMES[+mes.slice(5)-1]+' (ex.: RM MSK, USG):',smEstagio(mes));if(v==null)return;
  smMudar(d=>{d.estagios=d.estagios||{};if(v.trim())d.estagios[mes]=v.trim();else delete d.estagios[mes]},'estágio do mês');
}
function smNoite(iso){   // BR = plantão Ecomax · HSI = sobreaviso HSI · '' = nada
  const x=smDia(iso);if(x.noite!=null)return x.noite;const a=x.agenda||'';
  return /sobreaviso|hsi/i.test(a)?'HSI':/plant|\bBR\b/i.test(a)?'BR':'';
}
function smPascoa(y){const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m+114)/31),dd=(h+l-7*m+114)%31+1;return dKey(+new Date(y,mo-1,dd,12))}
const SM_FER={'01-01':'Confraternização','04-21':'Tiradentes','05-01':'Dia do Trabalho','09-02':'Aniversário de Blumenau','09-07':'Independência','10-12':'N. Sra. Aparecida','11-02':'Finados','11-15':'Proclamação da República','11-20':'Consciência Negra','12-25':'Natal'};
function smFeriadoAuto(iso){
  if(SM_FER[iso.slice(5)])return SM_FER[iso.slice(5)];
  const p=smPascoa(+iso.slice(0,4));
  return iso===smMais(p,-48)||iso===smMais(p,-47)?'Carnaval':iso===smMais(p,-2)?'Sexta-feira Santa':iso===smMais(p,60)?'Corpus Christi':'';
}
const smFeriado=iso=>{const x=smDia(iso);return x.feriado!=null?x.feriado:smFeriadoAuto(iso)};
function smAgResto(a){   // o que sobra da agenda depois de tirar Ecomax do dia, plantão e sobreaviso (já aparecem como estágio/BR/HSI)
  return String(a||'').split(/\s*[·+]\s*/).filter(p=>p&&!/^ecomax( dia)?( ?\(.*\))?$/i.test(p)&&!/^(br|hsi)$/i.test(p)&&!/plant|sobreaviso/i.test(p)).join(' · ');
}
function smCampo(iso,k,v){
  v=String(v??'').trim();
  smMudar(d=>{const x=d.dias[iso]=d.dias[iso]||{};
    if(k==='feriado'){if(v===smFeriadoAuto(iso))delete x.feriado;else x.feriado=v}
    else if(k==='noite'){if(v==='auto')delete x.noite;else x.noite=v;delete x.meta}
    else if(v)x[k]=v;else delete x[k]},k==='tema'?'tema do dia':k==='foco'?'foco do dia':k==='feriado'?'feriado':'noite do dia');
}
const smNt=nt=>nt?`<span class="sm-nt ${nt.toLowerCase()}">${nt}</span>`:'';
function smSelo(x,longo){   // questões feitas/meta: só a letra colorida
  const hj=smHoje(),t=smTipo(x),q=smQ(x),mt=smMetaDe(x),c=smCor(x);
  if(x<=hj)return t==='estudo'&&mt?`<span class="q ${c}">${q.n}<small>/${mt}</small></span>`:q.n?`<span class="q">${q.n}</span>`:'';
  return t==='estudo'&&mt?`<span class="q fut">${longo?mt+' questões':'meta '+mt}</span>`:'';
}
const smCorTipo=a=>(a||'estudo')==='estudo'?'e':a==='ferramenta'?'f':'t';   // bolinha: azul estudo, amarelo ferramenta, verde tarefas (e outros tipos)
const smDots=x=>{const its=smItensDe(x),hj=smHoje();return its.length?`<span class="dots">${its.map(i=>`<i class="t-${smCorTipo(i.area)} ${i.feito?'ok':x<hj?'late':''}"></i>`).join('')}</span>`:''};
function smCalCab(mes,y,m){
  const hj=smHoje(),est=smEstagio(mes),vis=SM.vis||'mes',sem=vis==='semana',seg=SM.semana||smSeg(hj);
  const titulo=sem?`${smRotL(seg)} – ${smRotL(smMais(seg,6))}`:`${smMES[m-1][0].toUpperCase()+smMES[m-1].slice(1)} ${y}`;
  return `<div class="sm-calh"><button class="b s sm-ghost" onclick="smCalVai(-1)" aria-label="${sem?'Semana anterior':'Mês anterior'}">‹</button><h3>${titulo}</h3><button class="sm-est ${est?'':'vazio'}" onclick="smEstagioEdita('${mes}')" title="Estágio do mês (toque para mudar)">${est?esc(est):'+ estágio'}</button><button class="b s sm-ghost" onclick="smCalVai(1)" aria-label="${sem?'Próxima semana':'Próximo mês'}">›</button>${(sem?seg!==smSeg(hj):mes!==hj.slice(0,7))?`<button class="b s sm-ghost" onclick="SM.mes=null;SM.semana=null;render()">Hoje</button>`:''}<span style="flex:1"></span>
   <div class="sm-seg"><button type="button" aria-pressed="${vis==='mes'}" onclick="smVis('mes')">Mês</button><button type="button" aria-pressed="${sem}" onclick="smVis('semana')">Semana</button><button type="button" aria-pressed="${vis==='lista'}" onclick="smVis('lista')">Lista</button></div>
   ${sem?`<button class="b s sm-ghost" onclick="smSem('${seg}')">editar semana</button>`:''}
   <button class="b s ${SM.plan?'':'sm-ghost'}" onclick="SM.plan=!SM.plan;SM.conf=null;render()">✎ Planejar mês</button></div>`;
}
function smVis(v){SM.vis=v;try{localStorage.setItem('sm_vis',v)}catch(e){}render()}
function smCalVai(k){if(SM.vis!=='semana'){smMesVai(k);return}SM.semana=smMais(SM.semana||smSeg(smHoje()),k*7);render()}
try{SM.vis=localStorage.getItem('sm_vis')||'mes'}catch(e){SM.vis='mes'}
function smCalendario(){
  const hj=smHoje(),sem=SM.vis==='semana',seg=SM.semana||smSeg(hj),mes=sem?seg.slice(0,7):SM.mes||hj.slice(0,7),[y,m]=mes.split('-').map(Number),ini=sem?seg:smSeg(dKey(+new Date(y,m-1,1,12))),fim=sem?smMais(seg,6):dKey(+new Date(y,m,0,12)),p=smProvaIso(),r=smRetaIni();
  const corpo=SM.vis==='lista'?smLista(mes,ini,fim,p,r):smGrade(mes,ini,fim,p,r,sem);
  return `<div class="card sm-cal">${smCalCab(mes,y,m)}${SM.plan?smPainelMes():''}${corpo}
   <p class="mut sm-dica">Toque num dia para editar (tema, foco, noite, feriado, itens) · <button class="sm-tagb" onclick="smSem('${sem?seg:smSeg(hj)}')">editar semana${sem?'':' atual'}</button> · toque no estágio ao lado do mês para mudar. Plantões e sobreavisos vêm do Google Agenda na revisão de domingo.</p>${!sem&&SM.vis!=='lista'&&SM.sem&&(SM.sem<ini||SM.sem>fim)?smPainelSemana(SM.sem):''}</div>`;
}
function smGrade(mes,ini,fim,p,r,sem=false){
  const hj=smHoje();let h='';
  for(let s=ini;s<=fim;s=smMais(s,7)){
    const ds=smSemana(s);
    h+=`<div class="sm-lin">${ds.map(x=>{
      if(!sem&&x.slice(0,7)!==mes)return `<button class="sm-cel fora" data-drop="${x}" onclick="SM.mes='${x.slice(0,7)}';smSel('${x}')"><span class="top"><span class="n">${smDt(x).getDate()}</span></span></button>`;
      const t=smTipo(x),di=smDia(x),fe=smFeriado(x),rs=smAgResto(di.agenda);
      return `<button lang="pt-BR" class="sm-cel ${x===hj?'hoje':''} ${t!=='estudo'?'off':''} ${SM.sel===x?'sel':''} ${fe?'fer':''} ${r&&x>=r&&p&&x<p?'rf':''}" data-drop="${x}" onclick="smSel('${x}')" title="${esc(di.agenda||'')}">
        <span class="top"><span class="n">${smDt(x).getDate()}</span>${smNt(smNoite(x))}${x===p?'<span class="sm-pv2">PROVA</span>':''}</span>
        ${smEvs(x)}${fe?`<span class="sm-fe">${esc(fe)}</span>`:''}${di.tema?`<span class="sm-tm">${esc(di.tema)}</span>`:''}${di.foco?`<span class="sm-fo">+ ${esc(di.foco)}</span>`:''}${rs?`<span class="sm-rs">${esc(rs)}</span>`:''}
        <span class="sm-bt">${smSelo(x)}${smDots(x)}</span></button>`}).join('')}</div>`;
    if(SM.sem===s)h+=smPainelSemana(s);
    if(SM.sel&&ds.includes(SM.sel))h+=smPainelDia(SM.sel);
  }
  return `<div class="sm-grid ${sem?'sm-vsem':''}"><div class="sm-lin cab">${['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d=>`<span>${d}</span>`).join('')}</div>${h}</div>`;
}
function smLista(mes,ini,fim,p,r){
  const hj=smHoje(),esta=smSeg(hj);let h='';
  for(let s=ini;s<=fim;s=smMais(s,7)){
    h+=`<div class="sm-lh"><b>Semana ${smNumSem(s)}${s===esta?' · esta':''}</b><button class="sm-tagb ${SM.sem===s?'on2':''}" onclick="smSem('${s}')">editar semana</button></div>`;
    if(SM.sem===s)h+=smPainelSemana(s);
    smSemana(s).filter(x=>x.slice(0,7)===mes).forEach(x=>{
      const t=smTipo(x),di=smDia(x),fe=smFeriado(x),rs=smAgResto(di.agenda),dw=smDt(x).getDay();
      const vazio=!di.tema&&!fe?(t==='sobreaviso'?'<span class="mut">sobreaviso · sem estudo</span>':t==='descanso'?'<span class="mut">descanso</span>':''):'';
      h+=`<button class="sm-li ${x===hj?'hoje':''} ${t!=='estudo'?'off':''} ${SM.sel===x?'sel':''} ${r&&x>=r&&p&&x<p?'rf':''}" data-drop="${x}" onclick="smSel('${x}')">
        <span class="ld"><b class="${fe?'fer':''}">${smDt(x).getDate()}</b><small>${smDOW[dw]}</small></span>
        <span class="lc"><span class="lt">${smNt(smNoite(x))}${x===p?'<span class="sm-pv2">PROVA</span>':''}${fe?`<span class="sm-fe">${esc(fe)}</span>`:''}${smEvs(x)}${di.tema?`<span class="sm-tm">${esc(di.tema)}</span>`:''}${vazio}</span>
        ${di.foco?`<span class="sm-fo">+ ${esc(di.foco)}</span>`:''}${rs?`<span class="sm-rs">${esc(rs)}</span>`:''}
        <span class="lb">${smSelo(x,true)}${smDots(x)}</span></span></button>`;
      if(SM.sel===x)h+=smPainelDia(x);
    });
  }
  return `<div class="sm-lista">${h}</div>`;
}
function smFracosCard(){
  SM.fr=smFracos();const man=(SM.d.notas||[]).filter(n=>n.fraco);
  if(!SM.fr.length&&!man.length)return '';
  return `<div class="card"><span class="kick">Temas fracos</span>
   ${SM.fr.length?`<p class="mut">Últimos 14 dias no banco (3+ respostas, menos de 70%).</p><div class="sm-fr">${SM.fr.map((x,i)=>`<div class="sm-frl"><span>${esc(x.t)}</span><span class="sm-q">${x.ok}/${x.n}</span><button class="b s" onclick="smTreinar(${i})">Treinar</button></div>`).join('')}</div>`:''}
   ${man.length?`<p class="mut">Que você marcou nas anotações:</p><ul class="sm-notas">${man.map(n=>`<li>${esc(n.texto)}</li>`).join('')}</ul>`:''}</div>`;
}
function vSemana(){
  if(!SM.ok)return `<div class="card"><p class="mut">Carregando o calendário…</p></div>`;
  if(!SM.d)return `<div class="card"><p class="mut">Calendário ainda vazio.</p></div>`;
  setTimeout(smAuto,0);const hj=smHoje(),sem=SM.d.tarefas.filter(t=>t.dia==='proxima'),atr=SM.d.tarefas.filter(t=>t.dia!=='proxima'&&t.dia<hj&&t.dia>=smMais(hj,-7)&&!t.feito);
  return `<div class="sm">
   ${SM.erro?`<p class="sm-err">${esc(SM.erro)}</p>`:''}
   ${smSemData()}
   ${smCalendario()}
   ${smHojeGrande()}
   ${atr.length?`<div class="card"><span class="kick" style="color:var(--bad)">Ficou para trás (últimos 7 dias)</span>${atr.map(t=>`<div class="sm-frl"><span>${esc(t.texto)} <span class="sm-tag">${smRot(t.dia)}</span></span><button class="b s sm-ghost" onclick="smAdiar('${t.id}')">Passar para o próximo dia de estudo</button></div>`).join('')}</div>`:''}
   ${sem.length?`<div class="card"><span class="kick">Sem dia</span><p class="mut">A revisão de domingo encaixa estes itens.</p>${sem.map(smItem).join('')}</div>`:''}
   ${smFracosCard()}
   ${smPriCard()}
   <div class="card"><span class="kick">Anotações</span><p class="mut">Temas que errou, ideias, o que travou. A revisão de domingo lê tudo.</p>
    <div class="row"><input id="sm_nota" placeholder="Ex.: errei 4 de contraste iodado" value="${smVal('sm_nota')}" oninput="SM.dr[this.id]=this.value" onkeydown="if(event.key==='Enter')smNota()" style="flex:1;min-width:0"><button class="b s" onclick="smNota()">Anotar</button></div>
    <label class="check"><input type="checkbox" id="sm_fraco"> marcar como tema fraco</label>
    <ul class="sm-notas">${(SM.d.notas||[]).slice().sort((a,b)=>(b.em||'').localeCompare(a.em||'')).slice(0,20).map(n=>`<li><time>${smRot((n.em||'').slice(0,10)||hj)}</time><span style="flex:1;min-width:0">${esc(n.texto)}</span><button class="sm-tagb ${n.fraco?'on':''}" onclick="smNotaFraco('${n.id}')">tema fraco</button><button class="sm-edb" onclick="smNotaDel('${n.id}')" aria-label="Apagar">×</button></li>`).join('')}</ul></div>
  </div>`;
}
// cartão na aba Hoje: itens de hoje com check, sem sair da tela
function smCardHoje(){
  if(!SM.d)return'';setTimeout(smAuto,0);const hj=smHoje(),todos=smItensDe(hj),its=smVisiveis(hj);if(!todos.length)return'';
  return `<div class="card sm-ch"><div class="row" style="justify-content:space-between"><span class="kick">Hoje no calendário · ${todos.filter(t=>t.feito).length}/${todos.length}</span>${smFeitasBotao(hj)}<button class="b s sm-ghost" onclick="go('semana')">Ver calendário</button></div>${smGrupos(its)}</div>`;
}
const smCarga=smPuxar();smPriPuxar();
setInterval(()=>{if(document.visibilityState==='visible'){smPuxar();smPriPuxar()}},90000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){smPuxar();smAuto()}});
// anel da meta de hoje + dias até a prova + ritmo (estavam no cartão de hoje da aba Semana; agora no "Meta até a prova" da aba Hoje)
function smMetaHoje(){
  if(!SM.d)return'';const hj=smHoje(),q=smQ(hj),m=smMetaDe(hj),dd=diasProva(),rit=smRitmo(),r=smRetaIni(),tp=smTipo(hj);
  const p=m?Math.min(100,Math.round(q.n/m*100)):0,cor=m&&q.n>=m?'var(--ok)':'var(--warn)';
  return `<div class="sm-mh"><div class="sm-hm">${m?`<div class="sm-ring" style="background:conic-gradient(${cor} ${p}%,var(--bd) 0)"><div><b>${q.n}</b><span>de ${m}</span></div></div><span class="mut">meta automática de hoje${q.n?` · ${pct(q.ok,q.n)}% de acerto`:''}</span>`
     :`<div class="sm-ring" style="background:var(--bd)"><div><b>${q.n}</b><span>questões</span></div></div><span class="mut">${tp==='descanso'?'dia de descanso — sem meta':'sobreaviso — sem meta hoje'}</span>`}</div>
   <div class="sm-hp">${dd!=null?`<span class="sm-bign">${dd}</span><span class="mut">dias até a prova</span>`:''}${rit!=null?`<span class="mut">ritmo: <b style="color:${rit>=90?'var(--ok)':rit>=60?'var(--warn)':'var(--bad)'}">${rit>=90?'no caminho':rit>=60?'um pouco abaixo':'abaixo'}</b> (${rit}% da meta nos últimos 5 dias de estudo)</span>`:''}<span class="mut">${_restantesFM()} fáceis/médias novas</span>${r?`<span class="mut">reta final (rever erros) a partir de ${smRotL(r)}</span>`:''}</div></div>`;
}

// ===== NOVA TAREFA — Alt+A, botão +, ?acao=tarefa / ?acao=voz (1.17.0: campo único, Enter salva na hora) =====
// Um campo só. Enter (ou Salvar) grava na hora: tipo "Tarefas", sem data, não urgente, a não ser que o texto diga outra coisa
// (interpretarTarefa, build/interpretar.js). Quando / tipo / urgente / detalhes são botões opcionais. O que estiver digitado fica em
// localStorage (QA_RASC) a cada tecla e volta ao reabrir, mesmo depois de recarregar o app; só some ao salvar ou em "Limpar".
const QA_RASC='bcbr_rasc_tarefa';
const QA={on:false,texto:'',det:'',area:'tarefas',quando:'',urg:false,ouvindo:false,rec:null,detAberto:false};
const qaRascLer=()=>{try{return JSON.parse(localStorage.getItem(QA_RASC)||'null')}catch(e){return null}};
function qaRascSalva(extra){
  try{const r={texto:QA.texto,det:QA.det,area:QA.area,quando:QA.quando,urg:!!QA.urg,aberto:QA.on,...(extra||{})};
    if(!r.texto.trim()&&!r.det.trim()&&r.area==='tarefas'&&!r.quando&&!r.urg&&!r.salvar)localStorage.removeItem(QA_RASC);else localStorage.setItem(QA_RASC,JSON.stringify(r))}catch(e){}
}
const qaRascLimpa=()=>{try{localStorage.removeItem(QA_RASC)}catch(e){}};
const qaVozAPI=()=>window.SpeechRecognition||window.webkitSpeechRecognition;
function qaZera(){Object.assign(QA,{texto:'',det:'',area:'tarefas',quando:'',urg:false,detAberto:false})}
function qaAbre(){
  if(QA.on){const i=document.getElementById('qa_in');i&&i.focus();return}
  const r=qaRascLer()||{};
  Object.assign(QA,{on:true,texto:r.texto||'',det:r.det||'',area:r.area||'tarefas',quando:r.quando||'',urg:!!r.urg,ouvindo:false,rec:null,detAberto:!!r.det});
  qaRascSalva();qaDesenha();
}
function qaFechaEl(){if(QA.rec){try{QA.rec.abort()}catch(e){}QA.rec=null}QA.ouvindo=false;QA.on=false;const el=document.getElementById('qa');if(el)el.remove()}
function qaFecha(){qaFechaEl();qaRascSalva()}                       // fechar NÃO apaga o rascunho
function qaLimpa(){qaZera();qaRascLimpa();qaRascSalva();if(QA.on){qaDesenha()}}   // "Limpar": apaga o rascunho de propósito
function qaTxt(v){QA.texto=v;qaRascSalva();qaPinta()}
function qaQuando(v){QA.quando=QA.quando===v?'':v;qaRascSalva();qaPinta()}
function qaUrgente(){QA.urg=!QA.urg;qaRascSalva();qaPinta()}
function qaDetAlterna(){QA.detAberto=!QA.detAberto;const d=document.getElementById('qa_det');if(d){d.hidden=!QA.detAberto;if(QA.detAberto)d.focus()}qaPinta()}
const qaDM=iso=>iso.slice(8)+'/'+iso.slice(5,7);
function qaPrevTxt(){
  const hj=smHoje(),L=interpretarTarefa(QA.texto,hj);if(!L.length)return'';
  const parte=r=>{const p=[];if(r.dia)p.push(r.dia==='sem'?'♾️ sem data':'📅 '+qaDM(r.dia));if(r.hora)p.push(r.hora);if(r.urg)p.push('! urgente');if(r.area&&r.area!=='tarefas')p.push(smTipoIco(r.area)+' '+smTipoDe(r.area).nome);return p.join(' · ')};
  if(L.length===1)return parte(L[0]);
  return L.length+' tarefas: '+L.map(r=>r.texto+(parte(r)?' ('+parte(r)+')':'')).join(' | ');
}
function qaPinta(){   // atualiza só o que mudou (não refaz o campo: não perde foco nem teclado do celular)
  const el=document.getElementById('qa');if(!el)return;
  el.querySelectorAll('[data-q]').forEach(b=>b.setAttribute('aria-pressed',String(QA.quando===b.dataset.q)));
  const dt=document.getElementById('qa_dt');if(dt)dt.value=/^\d{4}-/.test(QA.quando)?QA.quando:'';
  const u=document.getElementById('qa_urg');if(u)u.setAttribute('aria-pressed',String(!!QA.urg));
  const db=document.getElementById('qa_detb');if(db)db.setAttribute('aria-pressed',String(QA.detAberto));
  const pv=document.getElementById('qa_prev');if(pv)pv.textContent=qaPrevTxt();
  const mic=document.getElementById('qa_mic');if(mic){mic.setAttribute('aria-pressed',String(QA.ouvindo));mic.textContent=QA.ouvindo?'⏹ Ouvindo…':'🎤'}
}
// cria a(s) tarefa(s) a partir de um texto livre; pad = escolhas dos botões {quando,area,urg,det}. Devolve as tarefas criadas.
function smCriaDeTexto(bruto,pad){
  pad=pad||{};const hj=smHoje(),novos=[];
  interpretarTarefa(bruto,hj).forEach(r=>{
    const dia=r.dia||(pad.quando==='hoje'?hj:pad.quando||'sem'),ts=r.area?{area:r.area,sub:''}:smParseTS(pad.area||'tarefas');
    const texto=r.hora?r.hora+' '+r.texto:r.texto,urg=r.urg||!!pad.urg;
    smNovos([dia],texto,ts.area,ts.sub,pad.det).forEach(x=>novos.push(urg?{...x,urg:true}:x));
  });
  if(novos.length)smPoe(novos,'novo item');
  return novos;
}
function smResumoNovos(l){const x=l[0];return (l.length>1?l.length+' tarefas':'“'+x.texto+'”')+' · '+(x.dia==='sem'?'sem data':qaDM(x.dia))}
// aviso com "Desfazer" (~3,5 s)
function smDesfazToast(msg,fn){
  let el=document.getElementById('sm_dz');if(el)el.remove();
  el=document.createElement('div');el.id='sm_dz';el.className='sm-dz';
  const sp=document.createElement('span');sp.textContent=msg;const b=document.createElement('button');b.className='b s';b.textContent='Desfazer';
  b.onclick=()=>{clearTimeout(el._t);el.remove();fn()};el.append(sp,b);document.body.appendChild(el);el._t=setTimeout(()=>el.remove(),3500);
}
function qaSalvar(){
  const bruto=QA.texto.trim();if(!bruto){toast('Escreva a tarefa');return}
  const pad={quando:QA.quando,area:QA.area,urg:QA.urg,det:QA.det.trim()};
  if(!SM.d){   // calendário ainda não carregou nem está guardado no aparelho: guarda e grava quando chegar
    qaFechaEl();qaRascSalva({salvar:true,aberto:false});toast('Vai salvar assim que o calendário carregar.');smCarga.then(smRascPend);return}
  const novos=smCriaDeTexto(bruto,pad);if(!novos.length)return;
  qaFechaEl();qaZera();qaRascLimpa();
  const ids=novos.map(x=>x.id);
  smDesfazToast('Salvei: '+smResumoNovos(novos),()=>{
    smMudar(d=>{d.tarefas=d.tarefas.filter(t=>!ids.includes(t.id))},'desfez item');
    try{localStorage.setItem(QA_RASC,JSON.stringify({texto:bruto,det:pad.det,area:pad.area,quando:pad.quando,urg:!!pad.urg,aberto:true}))}catch(e){}
    qaAbre();
  });
}
// rascunho marcado para salvar assim que o calendário carregar (atalho usado antes do app terminar de carregar)
function smRascPend(){
  const r=qaRascLer();if(!r||!r.salvar)return;
  if(!SM.d){toast('Não consegui salvar a tarefa agora. O texto está guardado neste aparelho.');return}
  const bruto=(r.texto||'').trim();qaRascLimpa();if(!bruto)return;
  const novos=smCriaDeTexto(bruto,{quando:r.quando,area:r.area,urg:r.urg,det:(r.det||'').trim()});
  if(novos.length)toast('Salvei: '+smResumoNovos(novos));
}
// ---- voz (Web Speech API; sem ela o botão 🎤 nem aparece) ----
function qaVoz(){
  const API=qaVozAPI();if(!API||!QA.on)return;
  if(QA.ouvindo&&QA.rec){try{QA.rec.stop()}catch(e){}return}
  const rec=new API(),base=QA.texto.trim();let final='';
  rec.lang='pt-BR';rec.interimResults=true;rec.continuous=false;rec.maxAlternatives=1;
  rec.onresult=e=>{let f='',pv='';for(let i=0;i<e.results.length;i++){const r=e.results[i];if(r.isFinal)f+=r[0].transcript;else pv+=r[0].transcript}
    final=f;QA.texto=((base?base+' ':'')+(f+pv)).trim();const c=document.getElementById('qa_in');if(c)c.value=QA.texto;qaRascSalva();qaPinta()};
  rec.onerror=e=>{const c=e.error;if(c==='not-allowed'||c==='service-not-allowed')toast('Permita o microfone para ditar.');else if(c==='no-speech')toast('Não ouvi nada.');else if(c!=='aborted')toast('Não consegui ouvir ('+c+').')};
  rec.onend=()=>{if(QA.rec===rec){QA.rec=null;QA.ouvindo=false;qaPinta();if(final.trim()&&QA.on)qaSalvar()}};
  QA.rec=rec;QA.ouvindo=true;qaPinta();
  try{rec.start()}catch(e){QA.rec=null;QA.ouvindo=false;qaPinta()}
}
function qaDesenha(){
  let el=document.getElementById('qa');
  if(!el){el=document.createElement('div');el.id='qa';el.className='qa-fundo';el.onclick=e=>{if(e.target===el)qaFecha()};document.body.appendChild(el)}
  const tp=QA.area&&smTipos().some(t=>QA.area.split('|')[0]===t.id)?QA.area:smTipos()[0].id;
  el.innerHTML=`<div class="qa-caixa" role="dialog" aria-label="Nova tarefa"><div class="row" style="justify-content:space-between;align-items:center"><b>➕ Nova tarefa</b><span style="flex:1"></span>${qaVozAPI()?`<button type="button" id="qa_mic" class="b s sm-ghost" onclick="qaVoz()" aria-label="Falar a tarefa" aria-pressed="false">🎤</button>`:''}<button class="b s sm-ghost" onclick="qaFecha()" aria-label="Fechar">✕</button></div>
    <input id="qa_in" class="qa-in" placeholder="Ex.: consulta neurologista dia 30/10 11 horas" value="${esc(QA.texto)}" oninput="qaTxt(this.value)" autocomplete="off" enterkeyhint="done" aria-label="Tarefa">
    <div id="qa_prev" class="qa-prev" aria-live="polite"></div>
    <div class="qa-opts"><span class="sm-lbl">Quando</span><button type="button" class="sm-tagb" data-q="sem" onclick="qaQuando('sem')">Sem data</button><button type="button" class="sm-tagb" data-q="hoje" onclick="qaQuando('hoje')">Hoje</button><input type="date" id="qa_dt" class="sm-date" aria-label="Escolher o dia" onchange="QA.quando=this.value;qaRascSalva();qaPinta()"></div>
    <div class="qa-opts"><span class="sm-lbl">Tipo</span><select id="qa_area" aria-label="Tipo" onchange="QA.area=this.value;qaRascSalva()">${smOpcoes(tp)}</select><button type="button" id="qa_urg" class="sm-tagb" onclick="qaUrgente()" title="Alt+U">! urgente</button><button type="button" id="qa_detb" class="sm-tagb" onclick="qaDetAlterna()">≡ detalhes</button></div>
    <textarea id="qa_det" class="qa-in qa-det" rows="2" placeholder="Detalhes (opcional): aparecem ao abrir a tarefa" oninput="QA.det=this.value;qaRascSalva()" ${QA.detAberto?'':'hidden'}>${esc(QA.det)}</textarea>
    <div class="row" style="margin-top:6px"><button class="b" onclick="qaSalvar()">Salvar</button><span style="flex:1"></span><button class="b s sm-ghost" onclick="qaLimpa()">Limpar</button></div>
    <div class="qa-dica"><kbd>Enter</kbd> salva na hora (sem data, tipo Tarefas, a menos que o texto diga) · <kbd>Alt</kbd>+<kbd>U</kbd> urgente · <kbd>Esc</kbd> fecha e guarda o rascunho · ex.: “amanhã 9h”, “dia 30/10”, “urgente”, “estudo …”, “próxima tarefa …”</div></div>`;
  const s=document.getElementById('qa_area');if(s)s.value=tp;
  qaPinta();const i=document.getElementById('qa_in');i.focus();i.setSelectionRange(i.value.length,i.value.length);
}
window.addEventListener('keydown',e=>{
  if(!QA.on){if(e.altKey&&!e.ctrlKey&&(e.code==='Key'+KEY('qa').toUpperCase()||e.code==='Digit'+KEY('qa'))&&(tela==='hoje'||tela==='semana')){e.preventDefault();e.stopImmediatePropagation();qaAbre()}return}
  e.stopImmediatePropagation();const k=e.key,alvo=e.target||{};
  if(k==='Escape'){e.preventDefault();qaFecha();return}
  if(e.altKey&&e.code==='KeyU'){e.preventDefault();qaUrgente();return}
  if(k==='Enter'&&!e.isComposing){
    if(alvo.tagName==='BUTTON')return;                    // Enter num botão = aperta o botão
    if(alvo.id==='qa_det'&&!e.ctrlKey)return;              // nos detalhes, Enter = nova linha (Ctrl+Enter salva)
    e.preventDefault();qaSalvar();
  }
},true);
// botão flutuante "+" (celular e mouse) nas abas Hoje e Semana — chamado a cada render
function qaBotao(){let b=document.getElementById('qa_fab');const ver=tela==='hoje'||tela==='semana';
  if(!b){b=document.createElement('button');b.id='qa_fab';b.className='qa-fab';b.title='Nova tarefa (Alt+A)';b.setAttribute('aria-label','Nova tarefa (Alt+A)');b.textContent='+';b.onclick=qaAbre;document.body.appendChild(b)}
  b.style.display=ver?'':'none'}

// Tab = próxima aba (à direita), Shift+Tab = anterior (à esquerda), em volta. Pedido do Artur, 22/10/2026.
// (Alt+Tab não chega ao navegador: o Windows usa para trocar de janela.) Não age ao digitar num campo,
// com o zoom aberto nem na tela de Nova tarefa (Alt+A). Na questão também troca de aba (pedido do Artur, 22/10/2026).
window.addEventListener('keydown',e=>{
  if(e.key!=='Tab'||e.ctrlKey||e.metaKey||e.altKey)return;
  if(typeof QA!=='undefined'&&QA.on)return;
  const t=e.target;if(/INPUT|SELECT|TEXTAREA/.test(t.tagName)||t.isContentEditable)return;
  const z=document.getElementById('zoom');if(z&&!z.hidden)return;
  const o=tabsOrdenadas().map(x=>x[0]);if(!o.length)return;
  const ativa=tela==='quiz'?'questoes':tela==='fim'?'estudar':tela==='rt'?'hoje':tela==='fcstudy'?'fc':tela;
  let i=o.indexOf(ativa);if(i<0)i=0;
  e.preventDefault();go(o[(i+(e.shiftKey?-1:1)+o.length)%o.length]);
});


// Teclado na aba Semana (pedido do Artur, 22/10/2026): ao abrir, o cartão "Hoje" já vem selecionado;
// ↑/↓ andam pelas tarefas de hoje e, passando da última, pelas da célula "Sem data"; Enter conclui/desmarca, F apaga, Esc solta.
const SMK={on:false,i:-1};
function smkIni(){SMK.on=true;SMK.i=-1}
function smkLista(){return [...smAgrupa(smVisiveis(smHoje())).flatMap(g=>g.l),...smAgrupa(smVisiveis('sem')).flatMap(g=>g.l)]}
function smkPinta(){if(tela!=='semana')return;const c=document.querySelector('#app .sm-hoje1'),d=document.querySelector('#app .sm-sd');if(!c)return;
  const rh=[...c.querySelectorAll('.sm-grp .sm-row')],rs=d?[...d.querySelectorAll('.sm-grp .sm-row')]:[],rows=[...rh,...rs];
  c.classList.toggle('kbsel',SMK.on&&(SMK.i<0||SMK.i<rh.length));if(d)d.classList.toggle('kbsel',SMK.on&&SMK.i>=rh.length);
  rows.forEach((r,i)=>r.classList.toggle('kbsel',SMK.on&&i===SMK.i));
  const r=rows[SMK.i];if(SMK.on&&r)r.scrollIntoView({block:'nearest'})}
window.addEventListener('keydown',e=>{
  if(tela!=='semana'||!SMK.on||e.ctrlKey||e.metaKey||e.altKey)return;
  if(typeof QA!=='undefined'&&QA.on)return;
  const t=e.target;if(t&&(/INPUT|SELECT|TEXTAREA/.test(t.tagName)||t.isContentEditable))return;
  const z=document.getElementById('zoom');if(z&&!z.hidden)return;
  const L=smkLista(),n=L.length,k=e.key;
  if(k==='ArrowDown'||k==='ArrowUp'){if(!n)return;e.preventDefault();SMK.i=k==='ArrowDown'?Math.min(n-1,SMK.i+1):Math.max(0,SMK.i-1);smkPinta();return}
  if(k==='Escape'){SMK.on=false;smkPinta();return}
  const x=L[SMK.i];if(!x)return;
  if(keyIs(e,'smurg')){e.preventDefault();if(!x.pri){smUrgente(x.id);SMK.i=smkLista().findIndex(t=>t.id===x.id);smkPinta()}return}
  if(k==='Enter'){e.preventDefault();if(x.pri)smPriCheck(x.dia,!x.feito);else smCheck(x.id,!x.feito);return}
  if(keyIs(e,'smdel')){e.preventDefault();if(x.pri){toast('Esse item vem da lista de prioridades; não dá para apagar aqui.');return}
    smMudar(d=>{d.tarefas=d.tarefas.filter(y=>y.id!==x.id)},'excluiu item');SMK.i=Math.min(SMK.i,n-2);toast('Item apagado')}
});
// clique fora do cartão de hoje e da célula "Sem data" solta a seleção do teclado
document.addEventListener('pointerdown',e=>{if(tela==='semana'&&SMK.on&&!e.target.closest('.sm-hoje1,.sm-sd')){SMK.on=false;smkPinta()}},true);


// ===== EVENTOS DO DIA (pedido do Artur, 23/10/2026): selos como BR/HSI, largura toda da célula =====
// dias[iso].ev = [{id, t, c}] · c = cor (roxo, azul, laranja, rosa, turquesa, cinza). Criar/apagar no painel do dia.
const SM_EVC=[['roxo','Roxo'],['azul','Azul'],['laranja','Laranja'],['rosa','Rosa'],['turquesa','Turquesa'],['cinza','Cinza']];
const smEvL=iso=>(smDia(iso).ev||[]);
const smEvs=iso=>smEvL(iso).map(v=>`<span class="sm-ev c-${esc(v.c||'roxo')}" title="${esc(v.t)}">${esc(v.t)}</span>`).join('');
function smEvEditor(iso){
  const c=SM.evc||'roxo';
  return `<div class="row sm-evr"><span class="sm-lbl">Eventos</span>${smEvL(iso).map(v=>`<span class="sm-ev c-${esc(v.c||'roxo')} sm-evx">${esc(v.t)}<button onclick="smEvDel('${iso}','${v.id}')" aria-label="Apagar evento">×</button></span>`).join('')}
   <input id="sm_ev_${iso}" placeholder="Novo evento (ex.: Aniversário, Prova USG)" onkeydown="if(event.key==='Enter')smEvAdd('${iso}')" style="flex:1 1 180px;min-width:0" aria-label="Novo evento">
   <span class="sm-evcs">${SM_EVC.map(([k,n])=>`<button type="button" class="sm-evc c-${k}" aria-pressed="${c===k}" title="${n}" aria-label="${n}" onclick="smEvCor('${k}',this)"></button>`).join('')}</span>
   <button class="b s" onclick="smEvAdd('${iso}')">+ evento</button></div>`;
}
function smEvCor(c,b){SM.evc=c;b.parentElement.querySelectorAll('.sm-evc').forEach(x=>x.setAttribute('aria-pressed',String(x===b)))}
function smEvAdd(iso){
  const i=document.getElementById('sm_ev_'+iso),t=(i&&i.value||'').trim();if(!t){toast('Escreva o evento.');return}
  const ev={id:smId(),t,c:SM.evc||'roxo'};
  smMudar(d=>{const x=d.dias[iso]=d.dias[iso]||{};x.ev=x.ev||[];if(!x.ev.some(y=>y.id===ev.id))x.ev.push(ev)},'evento do dia');
}
function smEvDel(iso,id){smMudar(d=>{const x=d.dias[iso];if(x&&x.ev){x.ev=x.ev.filter(y=>y.id!==id);if(!x.ev.length)delete x.ev}},'apagou evento')}

// ===== ARRASTAR TAREFA PARA OUTRO DIA (pedido do Artur, 23/10/2026) =====
// Na aba Semana: mouse inicia ao mover >4 px; toque segura ~120 ms antes de mover e soltar
// num dia do calendário (grade ou lista), no cartão Hoje, na célula Tarefas (sem data) ou numa coluna da semana.
const SMD_HOLD=300;let SMD=null,smdEngole=0;
function smMover(id,dia){
  const t=smTar(id);if(!t||t.dia===dia)return;
  smMudar(d=>{const x=d.tarefas.find(y=>y.id===id);if(!x||x.dia===dia)return;
    if(x.grupo&&d.tarefas.some(y=>y.id!==id&&y.grupo===x.grupo&&y.dia===dia)){d.tarefas=d.tarefas.filter(y=>y.id!==id);return}   // o mesmo item já está nesse dia
    x.dia=dia;x.ordem=100+d.tarefas.filter(y=>y.dia===dia).length},'moveu item');
  toast(dia==='sem'?'Foi para Tarefas (sem data)':dia===smHoje()?'Foi para hoje':'Foi para '+smRotL(dia));
}
function smdAlvo(x,y){const el=document.elementFromPoint(x,y);return el&&el.closest&&el.closest('[data-drop]')}
function smdFim(cancela){
  const d=SMD;if(!d)return;clearTimeout(d.timer);clearInterval(d.auto);SMD=null;
  document.body.classList.remove('smd-on');document.querySelectorAll('.smd-alvo').forEach(e=>e.classList.remove('smd-alvo'));
  if(!d.ativo)return;d.g&&d.g.remove();smdEngole=1;setTimeout(()=>{smdEngole=0},80);
  if(!cancela){const z=smdAlvo(d.cx,d.cy);if(z)smMover(d.id,z.dataset.drop);if(navigator.vibrate)try{navigator.vibrate(12)}catch(e){}}
}
function smdPos(){
  const d=SMD;if(!d||!d.ativo)return;d.g.style.transform=`translate(${d.cx-d.dx}px,${d.cy-d.dy}px)`;
  const z=smdAlvo(d.cx,d.cy);if(z!==d.z){d.z&&d.z.classList.remove('smd-alvo');z&&z.classList.add('smd-alvo');d.z=z}
}
function smdComeca(){
  const d=SMD;if(!d)return;const r=document.querySelector(`.sm-row[data-tid="${d.id}"]`)||d.r,b=r.getBoundingClientRect();d.ativo=true;
  d.g=r.cloneNode(true);d.g.className+=' smd-g';d.g.style.cssText=`width:${b.width}px;left:0;top:0`;d.dx=d.x0-b.left;d.dy=d.y0-b.top;document.body.appendChild(d.g);
  document.body.classList.add('smd-on');try{getSelection().removeAllRanges()}catch(e){}
  if(navigator.vibrate)try{navigator.vibrate(25)}catch(e){}
  smdPos();
  d.auto=setInterval(()=>{const h=innerHeight;if(d.cy<70)scrollBy(0,-16);else if(d.cy>h-70)scrollBy(0,16);else return;smdPos()},16);
}
document.addEventListener('pointerdown',e=>{
  if(SMD||tela!=='semana'||(e.pointerType==='mouse'&&e.button!==0))return;
  const r=e.target.closest&&e.target.closest('.sm-row[data-tid]');if(!r||e.target.closest('button,input,textarea,select')||(e.target.isContentEditable&&e.target===document.activeElement))return;
  SMD={r,id:r.dataset.tid,x0:e.clientX,y0:e.clientY,cx:e.clientX,cy:e.clientY,pid:e.pointerId,mouse:e.pointerType==='mouse',ativo:false};if(!SMD.mouse)SMD.timer=setTimeout(smdComeca,SMD_HOLD);
},true);
document.addEventListener('pointermove',e=>{
  const d=SMD;if(!d||e.pointerId!==d.pid)return;
  if(!d.ativo){const dist=Math.hypot(e.clientX-d.x0,e.clientY-d.y0);if(d.mouse&&dist>4){d.cx=e.clientX;d.cy=e.clientY;smdComeca()}else{if(!d.mouse&&dist>8)smdFim(true);return}}   // toque antes do prazo = rolagem normal
  e.preventDefault();d.cx=e.clientX;d.cy=e.clientY;smdPos();
},{passive:false});
document.addEventListener('pointerup',e=>{if(SMD&&e.pointerId===SMD.pid)smdFim(false)});
document.addEventListener('pointercancel',e=>{if(SMD&&e.pointerId===SMD.pid)smdFim(true)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&SMD)smdFim(true)});
document.addEventListener('touchmove',e=>{if(SMD&&SMD.ativo)e.preventDefault()},{passive:false});
document.addEventListener('selectstart',e=>{if(SMD&&(!e.target.isContentEditable||SMD.ativo))e.preventDefault()});
document.addEventListener('contextmenu',e=>{if(SMD)e.preventDefault()});
document.addEventListener('click',e=>{if(smdEngole){smdEngole=0;e.stopPropagation();e.preventDefault()}},true);

// Atalhos do ícone (?acao=tarefa | voz | ri). Nova tarefa abre NA HORA (usa o calendário guardado no aparelho; não espera o GitHub
// nem as questões); se o calendário nunca foi carregado, o texto fica de rascunho e grava quando chegar. RI do dia espera os dados.
let smSyncResolve;
const smSyncCarga=new Promise(resolve=>{smSyncResolve=resolve});
function smAtalhosInicia(){
  const url=new URL(location.href),acao=url.searchParams.get('acao'),r=qaRascLer();
  if(r&&r.salvar){smCarga.then(smRascPend);if(!['tarefa','voz','ri'].includes(acao))return}   // tarefa digitada antes do app abrir (shim.js)
  if(!['tarefa','voz','ri'].includes(acao)){
    if(r&&r.aberto&&!r.salvar&&(r.texto||'').trim())setTimeout(()=>{if(!QA.on)qaAbre()},0);   // app recarregou/atualizou com a Nova tarefa aberta: reabre
    return;
  }
  url.searchParams.delete('acao');history.replaceState(history.state,'',url.pathname+url.search+url.hash);
  if(acao==='ri'){
    Promise.all([smCarga,smSyncCarga]).then(()=>{
      if(!SM.d){toast('Não foi possível carregar o calendário. Reabra o atalho quando houver conexão.');return}
      iniciaRI();
    });
    return;
  }
  if(r&&r.salvar)return;
  go('semana');qaAbre();
  if(acao==='voz'&&qaVozAPI())qaVoz();
}

// ---- Ponte com o app Android (widgets e notificações; repo banco-cbr-android) ----
// Só age dentro do app Android (window.BCBRNativo). Manda um resumo quando muda, a cada 20 s e ao sair do app.
let smNatUlt='';
function smNativoResumo(){
  if(!SM.d)return null;const hj=smHoje();
  const tp=t=>t.area==='estudo'||t.area==='ferramenta'?t.area:'tarefas';
  const it=t=>({id:String(t.id),texto:t.texto||'',tipo:tp(t),feito:!!t.feito,urg:!!t.urg});
  const lista=d=>smItensDe(d).map(it).sort((a,b)=>(b.urg-a.urg));
  const dias={};for(let i=-7;i<=35;i++){const d=smMais(hj,i),x=smDia(d),m=smMetaDe(d);
    dias[d]={noite:smNoite(d)||'',ev:smEvL(d).map(v=>v.t||''),agenda:x.agenda||'',meta:m||0,feito:smQ(d).n,tipoDia:smTipo(d)};}
  return {geradoEm:new Date().toISOString(),hoje:hj,tarefasHoje:lista(hj),tarefasSem:lista('sem'),dias,mes:hj.slice(0,7)};
}
function smNativo(forca){
  try{if(!window.BCBRNativo)return;const r=smNativoResumo();if(!r)return;
    const s=JSON.stringify({...r,geradoEm:''});if(!forca&&s===smNatUlt)return;smNatUlt=s;window.BCBRNativo.dados(JSON.stringify(r))}catch(e){console.warn('ponte Android',e)}
}
if(window.BCBRNativo){setInterval(()=>smNativo(),20000);document.addEventListener('visibilitychange',()=>{if(document.hidden)smNativo(true)});setTimeout(()=>smNativo(true),4000)}

// ---- Tarefas criadas pela tela nativa do app Android (sem abrir a WebView) — 1.17.0 ----
// BCBRNativo.pendentes() -> JSON [{id, texto, criadoEm, voz}] · cada texto passa por interpretarTarefa · BCBRNativo.confirmar(JSON de ids).
// Ids já importados ficam em localStorage (não duplica se o app nativo reenviar). Tolera a ponte sem esses métodos.
const SM_NAT_IMP='bcbr_nat_importados';
let smNatBusy=false;
function smNativoImporta(){
  try{
    const B=window.BCBRNativo;if(!B||typeof B.pendentes!=='function'||smNatBusy)return;
    if(!SM.d){smCarga.then(()=>{if(SM.d)smNativoImporta()});return}
    let lista=JSON.parse(B.pendentes()||'[]');if(!Array.isArray(lista)||!lista.length)return;
    let jaImp=[];try{jaImp=JSON.parse(localStorage.getItem(SM_NAT_IMP)||'[]')}catch(e){}
    const ids=[];smNatBusy=true;
    lista.forEach(p=>{
      if(!p||p.id==null)return;const id=String(p.id);ids.push(id);if(jaImp.includes(id))return;
      const t=String(p.texto||'').trim();if(t)smCriaDeTexto(t,{});
      jaImp.push(id);
    });
    try{localStorage.setItem(SM_NAT_IMP,JSON.stringify(jaImp.slice(-500)))}catch(e){}
    SM.fila.then(()=>{smNatBusy=false;if(!SM.erro&&ids.length&&typeof B.confirmar==='function'){try{B.confirmar(JSON.stringify(ids))}catch(e){console.warn('confirmar',e)}}});
  }catch(e){smNatBusy=false;console.warn('ponte Android (pendentes)',e)}
}
if(window.BCBRNativo){smNativoImporta();document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')smNativoImporta()})}
