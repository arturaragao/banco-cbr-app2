// ===== ABA SEMANA = CALENDÁRIO DO MÊS (pedido do Artur, 21/10/2026) =====
// Dados: semana/plano.json no repo privado banco-cbr-app (mesma chave do app). Formato v2:
//  {v:2, regras, subtitulo, dias:{"AAAA-MM-DD":{agenda,tipo?,meta?}}, tarefas:[{id,dia,texto,area,sub?,feito,feitoEm,ordem,grupo?,auto?,adiado?}], notas:[...], tipos?:[{id,nome,subs?:[]}]}
// dia:'sem' = tarefa sem data (célula "Sem data" acima do calendário; fora da meta, das bolinhas e do "ficou para trás"). 'proxima' = adiada para a semana nova.
// tipos (criados pela tela): padrão Estudo, Ferramenta, Tarefas (subtema Casamento) quando faltar.
// tipo: "estudo" | "sobreaviso" | "descanso". Sem tipo: plantão BR = estudo (até sáb/dom/feriado); sáb/dom/feriado sem BR = descanso; resto (inclusive HSI em dia útil) = estudo. "sobreaviso" só se escolhido no dia.
// Dia também tem tema?, foco?, noite? (BR|HSI|''; sem = pela agenda), feriado? (sem = lista fixa). estagios:{"AAAA-MM":"RM MSK"} = estágio do mês.
// Meta de questões automática só nos dias de estudo (plantão na Ecomax conta como estudo). Descanso e sobreaviso: sem cor, sem meta.
// A revisão de domingo (tarefa agendada do Claude) preenche a agenda das próximas semanas pelo Google Agenda e põe os itens da semana nova.
const SM={d:null,sha:null,ok:false,erro:'',ed:null,add:{},dr:{},sel:null,sem:null,mes:null,plan:false,semAdd:null,conf:null,fila:Promise.resolve(),auto:new Set(),fr:[]};
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
const smSeg=iso=>{const x=smDt(iso),k=(x.getDay()+6)%7;return smMais(iso,-k)};        // segunda da semana
const smSemana=iso=>{const s=smSeg(iso);return Array.from({length:7},(_,i)=>smMais(s,i))};
const smNumSem=iso=>{const x=smDt(smMais(smSeg(iso),3)),a=new Date(x.getFullYear(),0,1,12);return 1+Math.floor(Math.round((x-a)/DAY)/7)};   // semana ISO (pela quinta-feira)
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
  if(marcar.length)smMudar(d=>d.tarefas.forEach(t=>{if(marcar.includes(t.id)&&!t.feito){t.feito=true;t.auto=true;t.feitoEm=new Date().toISOString()}}),'questões do dia (automático)');
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
  return {id:'pf'+iso,dia:iso,texto:t,area:'ferramenta',feito:!!smDia(iso).ferrOk,pri:true,ordem:900};
}
function smPriCheck(iso,v){smMudar(d=>{const x=d.dias[iso]=d.dias[iso]||{};if(v)x.ferrOk=true;else delete x.ferrOk},v?'ferramenta feita':'ferramenta desmarcada')}
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
    ks.forEach(k=>{const m=l.filter(t=>(t.sub||'')===k);if(m.length)out.push({a,sub:k,l:m})})});
  return out;
}

// ---------- ações ----------
const smTar=id=>SM.d&&SM.d.tarefas.find(t=>t.id===id);
const smGrupo=t=>t.grupo?SM.d.tarefas.filter(x=>x.grupo===t.grupo):[t];
const smItensDe=dia=>{const l=SM.d.tarefas.filter(t=>t.dia===dia),p=dia!=='proxima'&&dia!=='sem'&&smPriItem(dia);if(p)l.push(p);return l.sort((a,b)=>(a.ordem??0)-(b.ordem??0))};
function smSel(iso){SM.sel=SM.sel===iso?null:iso;SM.ed=null;render()}
function smSem(seg){SM.sem=SM.sem===seg?null:seg;SM.semAdd=null;SM.conf=null;render()}
function smMesVai(k){const[y,m]=(SM.mes||smHoje().slice(0,7)).split('-').map(Number),x=new Date(y,m-1+k,1,12);SM.mes=dKey(+x).slice(0,7);render()}
function smCheck(id,v){smMudar(d=>{const t=d.tarefas.find(x=>x.id===id);if(t){t.feito=v;t.feitoEm=v?new Date().toISOString():null;if(!v)delete t.auto}},v?'feito':'desmarcado');if(!v)SM.auto.add(id)}
function smEdita(id){
  if(SM.ed&&SM.ed.id===id){SM.ed=null;render();return}
  const t=smTar(id);if(!t)return;SM.ed={id,esc:'todos',dias:new Set(smGrupo(t).map(x=>x.dia).filter(x=>x!=='proxima'&&x!=='sem')),conf:false};render();
  const i=document.getElementById('sm_ed_txt');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length)}
}
function smChip(set,id,dias){if(id==='*'){if(dias.every(x=>set.has(x)))dias.forEach(x=>set.delete(x));else dias.forEach(x=>set.add(x))}else set.has(id)?set.delete(id):set.add(id);render()}
function smEdChip(id){const t=SM.ed&&smTar(SM.ed.id);t&&smChip(SM.ed.dias,id,smSemana(t.dia==='proxima'||t.dia==='sem'?smHoje():t.dia))}
function smEdEsc(v){if(SM.ed){SM.ed.esc=v;render()}}
function smEdConf(v){if(SM.ed){SM.ed.conf=v;render()}}
function smSalvar(){
  const t=smTar(SM.ed&&SM.ed.id);if(!t)return;
  const texto=document.getElementById('sm_ed_txt').value.trim(),{area,sub}=smParseTS(document.getElementById('sm_ed_area').value);if(!texto)return;
  const dEl=document.getElementById('sm_ed_dia'),nd=dEl?(dEl.value||(/^\d{4}-/.test(t.dia)?'sem':t.dia)):t.dia,mudouDia=!!dEl&&nd!==t.dia;
  const g=smGrupo(t),ligado=g.length>1;
  const aplica=(x,sd)=>{x.texto=texto;x.area=area;if(sub)x.sub=sub;else delete x.sub;if(sd){x.dia=nd;delete x.grupo;x.ordem=100+SM.d.tarefas.filter(y=>y.dia===nd).length}};
  if((ligado&&SM.ed.esc==='este')||t.dia==='sem'||(!ligado&&mudouDia)){const id=t.id,sd=mudouDia;SM.ed=null;smMudar(d=>{const x=d.tarefas.find(y=>y.id===id);if(x)aplica(x,sd)},'editou item');return}
  const semana=new Set(smSemana(t.dia==='proxima'?smHoje():t.dia)),dias=[...SM.ed.dias].filter(x=>semana.has(x));
  if(!dias.length&&t.dia!=='proxima'&&g.every(x=>semana.has(x.dia))){toast('Escolha pelo menos um dia (ou use Excluir).');return}
  const gid=t.grupo||(dias.length>1?'g'+smId():null),tem=new Set(g.map(x=>x.dia)),ids=g.map(x=>x.id);
  const fora=g.filter(x=>semana.has(x.dia)&&!SM.ed.dias.has(x.dia)).map(x=>x.id);   // só mexe nos dias desta semana
  const novos=dias.filter(dia=>!tem.has(dia)).map(dia=>({id:smId(),dia,texto,area,...(sub?{sub}:{}),feito:false,ordem:100+smItensDe(dia).length,...(gid?{grupo:gid}:{})}));
  SM.ed=null;
  smMudar(d=>{d.tarefas=d.tarefas.filter(x=>!fora.includes(x.id));d.tarefas.forEach(x=>{if(ids.includes(x.id)){x.texto=texto;x.area=area;if(sub)x.sub=sub;else delete x.sub;if(gid)x.grupo=gid}});
    novos.forEach(n=>{if(!d.tarefas.some(x=>x.id===n.id))d.tarefas.push({...n})})},'editou item');
}
function smExcluir(){
  const t=smTar(SM.ed&&SM.ed.id);if(!t)return;const ids=(SM.ed.conf==='todos'?smGrupo(t):[t]).map(x=>x.id);SM.ed=null;
  smMudar(d=>{d.tarefas=d.tarefas.filter(x=>!ids.includes(x.id))},'excluiu item');
}
function smProxEstudo(base){let x=smMais(base,1);for(let i=0;i<60;i++,x=smMais(x,1))if(smTipo(x)==='estudo')return x;return'proxima'}
function smAdiar(id){   // passa para o próximo dia de estudo (pula descanso e sobreaviso)
  const t=smTar(id);if(!t)return;const base=t.dia==='proxima'||t.dia==='sem'||t.dia<smHoje()?smMais(smHoje(),-1):t.dia,alvo=smProxEstudo(base);SM.ed=null;
  smMudar(d=>{const x=d.tarefas.find(y=>y.id===id);if(!x||x.dia===alvo)return;
    if(x.grupo&&d.tarefas.some(y=>y.id!==id&&y.grupo===x.grupo&&y.dia===alvo)){d.tarefas=d.tarefas.filter(y=>y.id!==id);return}
    x.dia=alvo;x.feito=false;x.adiado=(x.adiado||0)+1;x.ordem=200+d.tarefas.filter(y=>y.dia===alvo).length},'adiou item');
  toast(alvo==='proxima'?'Ficou sem dia':'Passou para '+smRotL(alvo));
}
function smNovos(dias,texto,area,sub){const gid=dias.length>1?'g'+smId():null;return dias.map(x=>({id:smId(),dia:x,texto,area,...(sub?{sub}:{}),feito:false,ordem:100+smItensDe(x).length,...(gid?{grupo:gid}:{})}))}
function smPoe(novos,msg){smMudar(d=>novos.forEach(n=>{if(!d.tarefas.some(x=>x.id===n.id))d.tarefas.push({...n})}),msg)}
function smAddDias(dia){if(SM.add[dia])delete SM.add[dia];else SM.add[dia]=new Set([dia]);render()}
function smAddChip(dia,id){SM.add[dia]&&smChip(SM.add[dia],id,smSemana(dia))}
function smAdd(dia){
  const inp=document.getElementById('sm_add_'+dia),v=(inp&&inp.value||'').trim();if(!v)return;
  const ts=smParseTS(document.getElementById('sm_area_'+dia).value),alvo=SM.add[dia]&&SM.add[dia].size?[...SM.add[dia]]:[dia];
  delete SM.add[dia];delete SM.dr['sm_add_'+dia];smPoe(smNovos(alvo,v,ts.area,ts.sub),'novo item');
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
  const mapa={},novos=its.map(t=>{const g=t.grupo?(mapa[t.grupo]??='g'+smId()):null;return{id:smId(),dia:smMais(t.dia,7),texto:t.texto,area:t.area||'estudo',...(t.sub?{sub:t.sub}:{}),feito:false,ordem:t.ordem??0,...(g?{grupo:g}:{})}});
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
function smEditor(t){
  const g=smGrupo(t),lig=g.length>1,todos=!lig||SM.ed.esc==='todos',prox=t.dia==='proxima'||t.dia==='sem',sem=smSemana(prox?smHoje():t.dia),outras=g.filter(x=>!sem.includes(x.dia)).length;
  return `<div class="sm-ed">
   <div class="row"><input id="sm_ed_txt" value="${esc(t.texto)}" style="flex:1 1 200px;min-width:0" onkeydown="if(event.key==='Enter')smSalvar();if(event.key==='Escape'){SM.ed=null;render()}" aria-label="Texto">
    <select id="sm_ed_area" aria-label="Tipo">${smOpcoes(t.sub?(t.area||'estudo')+'|'+t.sub:(t.area||'estudo'))}</select></div>
   ${!lig||SM.ed.esc==='este'?`<div class="row"><span class="sm-lbl">Data</span><input type="date" id="sm_ed_dia" class="sm-date" value="${/^\d{4}-/.test(t.dia)?t.dia:''}" aria-label="Data"><button type="button" class="sm-tagb" onclick="document.getElementById('sm_ed_dia').value=''">sem data</button>${t.dia==='proxima'?'<span class="mut">(hoje: sem dia, semana nova)</span>':''}</div>`:''}
   ${lig?`<div class="row"><span class="sm-lbl">Aplicar em</span><div class="sm-seg"><button type="button" aria-pressed="${SM.ed.esc==='este'}" onclick="smEdEsc('este')">Só neste dia</button><button type="button" aria-pressed="${SM.ed.esc==='todos'}" onclick="smEdEsc('todos')">Todos os ${g.length} dias</button></div></div>`:''}
   ${todos&&!prox?`<span class="sm-lbl">Dias desta semana${outras?` <span class="mut">(+${outras} em outras semanas, ficam como estão)</span>`:''}</span>${smChips(SM.ed.dias,x=>`smEdChip('${x}')`,sem)}`:''}
   ${SM.ed.conf?`<div class="row"><span class="sm-conf">${SM.ed.conf==='todos'?`Excluir dos ${g.length} dias?`:'Excluir este item?'}</span><span style="flex:1"></span><button class="b s sm-ghost" onclick="smEdConf(false)">Não</button><button class="b s sm-del" onclick="smExcluir()">Excluir</button></div>`
   :`<div class="row"><button class="b s sm-ghost" onclick="smAdiar('${t.id}')">Passar para o próximo dia de estudo</button><button class="b s sm-danger" onclick="smEdConf('este')">${lig?'Excluir só deste dia':'Excluir'}</button>${lig?`<button class="b s sm-danger" onclick="smEdConf('todos')">De todos</button>`:''}<span style="flex:1"></span><button class="b s sm-ghost" onclick="SM.ed=null;render()">Cancelar</button><button class="b s" onclick="smSalvar()">Salvar</button></div>`}
  </div>`;
}
function smItem(t){
  const g=t.grupo?SM.d.tarefas.filter(x=>x.grupo===t.grupo):[t],ed=SM.ed&&SM.ed.id===t.id,m=smMeta(t),q=m&&t.dia!=='proxima'&&t.dia!=='sem'?smQ(t.dia):null;
  if(t.pri)return `<div class="sm-row ${t.feito?'ok':''}"><label class="sm-it"><input type="checkbox" ${t.feito?'checked':''} onchange="smPriCheck('${t.dia}',this.checked)"><span class="sm-tx">${esc(t.texto)} <span class="sm-tag" title="Vem da lista de prioridades (muda sozinho quando a lista muda)">prioridades</span></span></label></div>`;
  return `<div class="sm-row ${t.feito?'ok':''}"><label class="sm-it"><input type="checkbox" ${t.feito?'checked':''} onchange="smCheck('${t.id}',this.checked)"><span class="sm-tx">${esc(t.texto)}${g.length>1?` <span class="sm-tag">${g.filter(x=>x.feito).length}/${g.length} dias</span>`:''}${q&&q.n?` <span class="sm-tag ${q.n>=m?'g':''}">banco ${q.n}/${m}</span>`:''}${t.auto?' <span class="sm-tag g">automático</span>':''}${t.adiado?` <span class="sm-tag">adiado</span>`:''}</span></label>
   <button class="sm-edb" onclick="smEdita('${t.id}')" aria-label="Editar" aria-expanded="${!!ed}">✎</button></div>${ed?smEditor(t):''}`;
}
function smGrupos(its){
  const g=smAgrupa(its);if(!g.length)return'';
  return `<div class="sm-gs">${g.map(x=>`<div class="sm-grp sm-${esc(x.a)}"><span class="sm-lbl">${esc(smTipoDe(x.a).nome)}${x.sub?` <i>› ${esc(x.sub)}</i>`:''}</span>${x.l.map(smItem).join('')}</div>`).join('')}</div>`;
}
function smAddLinha(dia){
  const add=SM.add[dia];
  return `<div class="sm-add c1"><div class="row"><input id="sm_add_${dia}" placeholder="Adicionar item" value="${smVal('sm_add_'+dia)}" oninput="SM.dr[this.id]=this.value" onkeydown="if(event.key==='Enter')smAdd('${dia}')" style="flex:1;min-width:0">
     <select id="sm_area_${dia}" aria-label="Tipo">${smOpcoes()}</select>
     ${dia==='sem'?'':`<button class="b s sm-ghost" aria-pressed="${!!add}" onclick="smAddDias('${dia}')">+ dias</button>`}<button class="b s" onclick="smAdd('${dia}')">+</button></div>
     ${add?smChips(add,x=>`smAddChip('${dia}','${x}')`,smSemana(dia)):''}</div>`;
}
function smTipoSeg(iso){const x=smDia(iso),t=smTipo(iso);
  return `<div class="sm-seg">${['estudo','sobreaviso','descanso'].map(k=>`<button type="button" aria-pressed="${t===k}" onclick="smTipoMuda('${iso}','${k}')">${smTipoNome[k]}</button>`).join('')}</div>${x.tipo?`<button class="sm-tagb" onclick="smTipoMuda('${iso}','auto')" title="Volta ao automático (fim de semana = descanso, HSI = sobreaviso)">automático</button>`:''}`}
// cartão de hoje, grande
function smHojeGrande(){
  const hj=smHoje(),x=smDt(hj),ag=smDia(hj).agenda||'',tp=smTipo(hj),its=smItensDe(hj);
  return `<div class="card sm-hoje sm-hoje1"><div class="sm-hl">
    <div class="sm-hh"><span class="kick">Hoje${tp!=='estudo'?` · ${smTipoNome[tp].toLowerCase()}`:''}</span>
     <h2>${['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'][x.getDay()]}, ${x.getDate()} de ${smMES[x.getMonth()]}</h2>
     <div class="sm-ags">${smNt(smNoite(hj))}${smEstagio(hj.slice(0,7))?`<span class="sm-agc">${esc(smEstagio(hj.slice(0,7)))}</span>`:''}${smFeriado(hj)?`<span class="sm-fe">${esc(smFeriado(hj))}</span>`:''}${smAgResto(ag)?`<span class="sm-agc">${esc(smAgResto(ag))}</span>`:''}${smDia(hj).tema?`<span class="sm-htm">${esc(smDia(hj).tema)}</span>`:''}${smDia(hj).foco?`<span class="sm-fo">+ ${esc(smDia(hj).foco)}</span>`:''}<button class="sm-tagb" onclick="smSel('${hj}')">editar dia</button></div></div>
    ${smGrupos(its)}${smAddLinha(hj)}</div>
  </div>`;
}
// célula "Sem data" (tarefas com dia:'sem'), acima do calendário; marcável, editável e navegável pelo teclado como as de hoje
function smSemData(){
  const its=smItensDe('sem');
  return `<div class="card sm-sd"><div class="sm-hh"><span class="kick">Sem data${its.length?` · ${its.filter(t=>t.feito).length}/${its.length}`:''}</span>${its.length?'':'<span class="mut" style="font-size:.85rem">tarefas sem dia marcado ficam aqui</span>'}</div>
   ${smGrupos(its)}${smAddLinha('sem')}</div>`;
}
function smPainelDia(iso){
  const x=smDia(iso),its=smItensDe(iso),q=smQ(iso),m=smMetaDe(iso);
  return `<div class="sm-pan"><div class="row" style="justify-content:space-between"><b>${smRotL(iso)}</b><span class="mut">${q.n} questões${m?` · meta ${m}`:''}</span><button class="sm-edb" onclick="smSel(null)" aria-label="Fechar">×</button></div>
   <div class="row"><input placeholder="Agenda do dia (ex.: Plantão Ecomax 18–0h)" value="${esc(x.agenda||'')}" onchange="smAgenda('${iso}',this.value)" style="flex:1 1 220px;min-width:0" aria-label="Agenda do dia">${smTipoSeg(iso)}</div>
   <div class="row sm-campos"><input placeholder="Tema do dia (ex.: RM Joelho)" value="${esc(x.tema||'')}" onchange="smCampo('${iso}','tema',this.value)" aria-label="Tema do dia"><input placeholder="Foco específico (ex.: USG tireoide TI-RADS)" value="${esc(x.foco||'')}" onchange="smCampo('${iso}','foco',this.value)" aria-label="Foco do dia"><input placeholder="Feriado" value="${esc(smFeriado(iso))}" onchange="smCampo('${iso}','feriado',this.value)" aria-label="Feriado"></div>
   <div class="row"><span class="sm-lbl">Noite</span><div class="sm-seg">${[['BR','BR plantão'],['HSI','HSI sobreaviso'],['','Nada']].map(([k,n])=>`<button type="button" aria-pressed="${smNoite(iso)===k}" onclick="smCampo('${iso}','noite','${k}')">${n}</button>`).join('')}</div>${x.noite!=null?`<button class="sm-tagb" onclick="smCampo('${iso}','noite','auto')" title="Volta a seguir a agenda">pela agenda</button>`:''}</div>
   ${smGrupos(its)||'<p class="mut" style="margin:0">Nenhum item neste dia.</p>'}${smAddLinha(iso)}</div>`;
}
function smPainelSemana(seg){
  const ds=smSemana(seg),hj=smHoje(),meta=ds.reduce((a,x)=>a+smMetaDe(x),0),feitas=ds.reduce((a,x)=>a+smQ(x).n,0),add=SM.semAdd;
  return `<div class="sm-pan sm-wk"><div class="row"><b>Semana ${smNumSem(seg)} · ${smDt(ds[0]).getDate()}–${smDt(ds[6]).getDate()}/${String(smDt(ds[6]).getMonth()+1).padStart(2,'0')}</b><span class="mut">meta ${meta} questões · feitas ${feitas}</span><span style="flex:1"></span>
    <button class="b s sm-ghost" aria-pressed="${!!add}" onclick="smSemAdd('${seg}')">+ item na semana</button><button class="b s sm-ghost" onclick="smSemCopia('${seg}')">Copiar para a próxima</button>
    ${SM.conf==='sem'?`<span class="sm-conf">Apagar os não feitos?</span><button class="b s sm-ghost" onclick="SM.conf=null;render()">Não</button><button class="b s sm-del" onclick="smSemLimpa('${seg}')">Apagar</button>`:`<button class="b s sm-danger" onclick="SM.conf='sem';render()">Limpar semana</button>`}<button class="sm-edb" onclick="smSem(null)" aria-label="Fechar">×</button></div>
   ${add?`<div class="sm-add"><div class="row"><input id="sm_sem_txt" placeholder="Item para vários dias da semana" value="${smVal('sm_sem_txt')}" oninput="SM.dr[this.id]=this.value" onkeydown="if(event.key==='Enter')smSemPor('${seg}')" style="flex:1;min-width:0"><select id="sm_sem_area" aria-label="Tipo">${smOpcoes()}</select><button class="b s" onclick="smSemPor('${seg}')">Adicionar</button></div>${smChips(add,x=>`smSemChip('${seg}','${x}')`,ds)}</div>`:''}
   <div class="sm-wcs">${ds.map(x=>{const t=smTipo(x),its=smItensDe(x),q=smQ(x);return `<div class="sm-wc ${x===hj?'hoje':''} ${t!=='estudo'?'off':''}"><button class="sm-wch" onclick="smSel('${x}')"><b>${smRot(x)}</b><small>${esc(smDia(x).agenda||smTipoNome[t])}</small>${q.n?`<small>${q.n} q</small>`:''}</button>${its.map(smItem).join('')}<button class="sm-wadd" onclick="smSel('${x}')">+ item</button></div>`}).join('')}</div></div>`;
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
const smDots=x=>{const its=smItensDe(x),hj=smHoje();return its.length?`<span class="dots">${its.map(i=>`<i class="${i.feito?'ok':x<hj?'late':''}"></i>`).join('')}</span>`:''};
function smCalCab(mes,y,m){
  const hj=smHoje(),est=smEstagio(mes),vis=SM.vis||'mes';
  return `<div class="sm-calh"><button class="b s sm-ghost" onclick="smMesVai(-1)" aria-label="Mês anterior">‹</button><h3>${smMES[m-1][0].toUpperCase()+smMES[m-1].slice(1)} ${y}</h3><button class="sm-est ${est?'':'vazio'}" onclick="smEstagioEdita('${mes}')" title="Estágio do mês (toque para mudar)">${est?esc(est):'+ estágio'}</button><button class="b s sm-ghost" onclick="smMesVai(1)" aria-label="Próximo mês">›</button>${mes!==hj.slice(0,7)?`<button class="b s sm-ghost" onclick="SM.mes=null;render()">Hoje</button>`:''}<span style="flex:1"></span>
   <div class="sm-seg"><button type="button" aria-pressed="${vis==='mes'}" onclick="smVis('mes')">Mês</button><button type="button" aria-pressed="${vis==='lista'}" onclick="smVis('lista')">Lista</button></div>
   <button class="b s ${SM.plan?'':'sm-ghost'}" onclick="SM.plan=!SM.plan;SM.conf=null;render()">✎ Planejar mês</button></div>`;
}
function smVis(v){SM.vis=v;try{localStorage.setItem('sm_vis',v)}catch(e){}render()}
try{SM.vis=localStorage.getItem('sm_vis')||'mes'}catch(e){SM.vis='mes'}
function smCalendario(){
  const hj=smHoje(),mes=SM.mes||hj.slice(0,7),[y,m]=mes.split('-').map(Number),ini=smSeg(dKey(+new Date(y,m-1,1,12))),fim=dKey(+new Date(y,m,0,12)),p=smProvaIso(),r=smRetaIni();
  const corpo=SM.vis==='lista'?smLista(mes,ini,fim,p,r):smGrade(mes,ini,fim,p,r);
  return `<div class="card sm-cal">${smCalCab(mes,y,m)}${SM.plan?smPainelMes():''}${corpo}
   <p class="mut sm-dica">Toque num dia para editar (tema, foco, noite, feriado, itens) · <b>S${smNumSem(hj)}</b> edita a semana · toque no estágio ao lado do mês para mudar. Plantões e sobreavisos vêm do Google Agenda na revisão de domingo.</p></div>`;
}
function smGrade(mes,ini,fim,p,r){
  const hj=smHoje();let h='';
  for(let s=ini;s<=fim;s=smMais(s,7)){
    const ds=smSemana(s);
    h+=`<div class="sm-lin"><button class="sm-sem ${SM.sem===s?'on':''}" onclick="smSem('${s}')" aria-label="Editar a semana ${smNumSem(s)}"><b>S${smNumSem(s)}</b><small>editar</small></button>${ds.map(x=>{
      if(x.slice(0,7)!==mes)return `<button class="sm-cel fora" onclick="SM.mes='${x.slice(0,7)}';smSel('${x}')"><span class="top"><span class="n">${smDt(x).getDate()}</span></span></button>`;
      const t=smTipo(x),di=smDia(x),fe=smFeriado(x),rs=smAgResto(di.agenda);
      return `<button lang="pt-BR" class="sm-cel ${x===hj?'hoje':''} ${t!=='estudo'?'off':''} ${SM.sel===x?'sel':''} ${fe?'fer':''} ${r&&x>=r&&p&&x<p?'rf':''}" onclick="smSel('${x}')" title="${esc(di.agenda||'')}">
        <span class="top"><span class="n">${smDt(x).getDate()}</span>${smNt(smNoite(x))}${x===p?'<span class="sm-pv2">PROVA</span>':''}</span>
        ${fe?`<span class="sm-fe">${esc(fe)}</span>`:''}${di.tema?`<span class="sm-tm">${esc(di.tema)}</span>`:''}${di.foco?`<span class="sm-fo">+ ${esc(di.foco)}</span>`:''}${rs?`<span class="sm-rs">${esc(rs)}</span>`:''}
        <span class="sm-bt">${smSelo(x)}${smDots(x)}</span></button>`}).join('')}</div>`;
    if(SM.sem===s)h+=smPainelSemana(s);
    if(SM.sel&&ds.includes(SM.sel))h+=smPainelDia(SM.sel);
  }
  return `<div class="sm-grid"><div class="sm-lin cab"><span></span>${['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(d=>`<span>${d}</span>`).join('')}</div>${h}</div>`;
}
function smLista(mes,ini,fim,p,r){
  const hj=smHoje(),esta=smSeg(hj);let h='';
  for(let s=ini;s<=fim;s=smMais(s,7)){
    h+=`<div class="sm-lh"><b>Semana ${smNumSem(s)}${s===esta?' · esta':''}</b><button class="sm-tagb ${SM.sem===s?'on2':''}" onclick="smSem('${s}')">editar semana</button></div>`;
    if(SM.sem===s)h+=smPainelSemana(s);
    smSemana(s).filter(x=>x.slice(0,7)===mes).forEach(x=>{
      const t=smTipo(x),di=smDia(x),fe=smFeriado(x),rs=smAgResto(di.agenda),dw=smDt(x).getDay();
      const vazio=!di.tema&&!fe?(t==='sobreaviso'?'<span class="mut">sobreaviso · sem estudo</span>':t==='descanso'?'<span class="mut">descanso</span>':''):'';
      h+=`<button class="sm-li ${x===hj?'hoje':''} ${t!=='estudo'?'off':''} ${SM.sel===x?'sel':''} ${r&&x>=r&&p&&x<p?'rf':''}" onclick="smSel('${x}')">
        <span class="ld"><b class="${fe?'fer':''}">${smDt(x).getDate()}</b><small>${smDOW[dw]}</small></span>
        <span class="lc"><span class="lt">${smNt(smNoite(x))}${x===p?'<span class="sm-pv2">PROVA</span>':''}${fe?`<span class="sm-fe">${esc(fe)}</span>`:''}${di.tema?`<span class="sm-tm">${esc(di.tema)}</span>`:''}${vazio}</span>
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
  if(!SM.d)return'';setTimeout(smAuto,0);const hj=smHoje(),its=smAgrupa(smItensDe(hj)).flatMap(g=>g.l);if(!its.length)return'';
  const rot=t=>t.area&&t.area!=='estudo'?`<span class="sm-tp">${esc(smTipoDe(t.area).nome)}${t.sub?' › '+esc(t.sub):''}</span> `:'';
  return `<div class="card sm-ch"><div class="row" style="justify-content:space-between"><span class="kick">Hoje no calendário · ${its.filter(t=>t.feito).length}/${its.length}</span><button class="b s sm-ghost" onclick="go('semana')">Ver calendário</button></div>
   <div class="sm-gs">${its.map(t=>{const m=smMeta(t),q=m?smQ(hj):null;return `<label class="sm-it ${t.feito?'ok':''}"><input type="checkbox" ${t.feito?'checked':''} onchange="${t.pri?`smPriCheck('${hj}',this.checked)`:`smCheck('${t.id}',this.checked)`}"><span class="sm-tx">${rot(t)}${esc(t.texto)}${q?` <span class="sm-tag ${q.n>=m?'g':''}">banco ${q.n}/${m}</span>`:''}</span></label>`}).join('')}</div></div>`;
}
smPuxar();smPriPuxar();
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

// ===== ADICIONAR TAREFA RÁPIDO — Alt+A nas abas Hoje e Semana (pedido do Artur, 22/10/2026) =====
// Passos: texto › tipo (↑↓ entre todos os tipos; "+ novo tipo") › [Estudo/Ferramenta: Enter = só hoje · → = escolher dias]
// [Tarefas e tipos com subtema: subtema (↑↓, "sem subtema", "+ novo subtema") › Quando (Hoje / Dia específico / Sem data) › mini calendário]. Esc volta um passo.
const QA={on:false,passo:'texto',texto:'',area:'estudo',sub:'',quando:'',dias:new Set(),cur:0,lista:[],tc:0,sc:0,qc:0,calCur:null};
const qaCurto=a=>{const t=smTipoDe(a);return (a==='estudo'||a==='ferramenta')&&!(t.subs&&t.subs.length)};   // fluxo antigo (dias) x fluxo com subtema/quando
const qaSeq=()=>qaCurto(QA.area)?['texto','tipo','dias']:['texto','tipo','sub','quando',...(QA.quando==='dia'?['data']:[])];
const qaBase=p=>p==='novotipo'?'tipo':p==='novosub'?'sub':p;
const qaTipos=()=>smTipos();
function qaAbre(){
  if(!SM.d){toast('O calendário ainda não carregou. Tente de novo em instantes.');return}
  const hj=smHoje();Object.assign(QA,{on:true,passo:'texto',texto:'',area:'estudo',sub:'',quando:'',tc:0,sc:0,qc:0,dias:new Set([hj]),cur:1,lista:Array.from({length:21},(_,i)=>smMais(hj,i)),calCur:hj});qaDesenha();
}
function qaFecha(){QA.on=false;const el=document.getElementById('qa');if(el)el.remove()}
function qaVai(p){
  if(p!=='texto'&&!QA.texto.trim()){toast('Escreva a tarefa primeiro');return}
  if(p==='tipo'){const i=qaTipos().findIndex(x=>x.id===QA.area);QA.tc=i<0?0:i}
  if(p==='sub'){const t=smTipoDe(QA.area),i=QA.sub?(t.subs||[]).indexOf(QA.sub)+1:0;QA.sc=i<0?0:i}
  if(p==='quando')QA.qc=0;
  QA.passo=p;qaDesenha();
}
function qaVolta(){const p=QA.passo;if(p==='texto')qaFecha();else if(p==='tipo')qaVai('texto');else if(p==='novotipo'||p==='sub'||p==='dias')qaVai('tipo');else if(p==='novosub'||p==='quando')qaVai('sub');else if(p==='data')qaVai('quando')}
function qaAdd(dias){
  const hj=smHoje();dias=(dias&&dias.length?dias:QA.dias.size?[...QA.dias]:[hj]).sort();const t=QA.texto.trim();if(!t)return;
  smPoe(smNovos(dias,t,QA.area,QA.sub),'novo item');qaFecha();
  toast(smTipoDe(QA.area).nome+' adicionada '+(dias[0]==='sem'?'em Sem data':dias.length===1&&dias[0]===hj?'a hoje':dias.length===1?'em '+smRotL(dias[0]):'em '+dias.length+' dias'));
}
function qaMarca(iso){QA.dias.has(iso)?QA.dias.delete(iso):QA.dias.add(iso);qaDesenha()}
function qaEscolheTipo(i){const l=qaTipos();QA.tc=(i+l.length+1)%(l.length+1);if(QA.tc<l.length){const m=l[QA.tc].id;if(m!==QA.area){QA.area=m;QA.sub=''}}qaDesenha()}
function qaTipoOk(){   // Enter/Próximo no passo do tipo
  if(QA.tc>=qaTipos().length){qaVai('novotipo');return}
  if(qaCurto(QA.area)){QA.dias=new Set([smHoje()]);qaAdd();return}
  qaVai('sub');
}
function qaNovoTipo(){const i=document.getElementById('qa_in'),id=smTipoNovo(i&&i.value);if(!id){toast('Escreva o nome do tipo');return}QA.area=id;QA.sub='';qaVai('sub')}
function qaSubOk(i){const t=smTipoDe(QA.area),n=(t.subs||[]).length;QA.sc=i;if(i>n){qaVai('novosub');return}QA.sub=i===0?'':t.subs[i-1];qaVai('quando')}
function qaNovoSub(){const i=document.getElementById('qa_in'),v=(i&&i.value||'').trim();if(!v){toast('Escreva o nome do subtema');return}smSubNovo(QA.area,v);QA.sub=v;qaVai('quando')}
function qaQuandoOk(i){
  QA.qc=i;if(i===0){QA.quando='hoje';qaAdd([smHoje()])}else if(i===2){QA.quando='sem';qaAdd(['sem'])}
  else{QA.quando='dia';QA.calCur=smHoje();qaVai('data')}
}
function qaCalVai(iso){QA.calCur=iso;qaDesenha()}
function qaCalMes(k){const[y,m,d]=QA.calCur.split('-').map(Number),n=new Date(y,m-1+k,1,12),ult=new Date(n.getFullYear(),n.getMonth()+1,0,12).getDate();QA.calCur=dKey(+new Date(n.getFullYear(),n.getMonth(),Math.min(d,ult),12));qaDesenha()}
function qaCalHtml(){
  const hj=smHoje(),c=QA.calCur,[y,m]=c.split('-').map(Number),ini=smSeg(dKey(+new Date(y,m-1,1,12))),fim=dKey(+new Date(y,m,0,12));let h='';
  for(let x=ini;x<=fim||smDt(x).getDay()!==1;x=smMais(x,1)){
    const dm=x.slice(0,7)===c.slice(0,7);
    h+=`<button type="button" class="qa-cd ${dm?'':'fora'} ${x===hj?'hoje':''} ${x===c?'cur':''} ${dm&&smTipo(x)!=='estudo'?'des':''}" onclick="qaAdd(['${x}'])">${smDt(x).getDate()}</button>`;
  }
  return `<div class="qa-cal"><div class="row" style="justify-content:space-between;align-items:center"><button class="b s sm-ghost" onclick="qaCalMes(-1)" aria-label="Mês anterior">‹</button><b>${smMES[m-1]} ${y}</b><button class="b s sm-ghost" onclick="qaCalMes(1)" aria-label="Próximo mês">›</button></div>
   <div class="qa-cg">${['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(d=>`<span class="qa-ch">${d}</span>`).join('')}${h}</div></div>`;
}
function qaDesenha(){
  let el=document.getElementById('qa');
  if(!el){el=document.createElement('div');el.id='qa';el.className='qa-fundo';el.onclick=e=>{if(e.target===el)qaFecha()};document.body.appendChild(el)}
  const p=QA.passo,b=qaBase(p),hj=smHoje(),seq=qaSeq(),ix=seq.indexOf(b),nomes={texto:'Tarefa',tipo:'Tipo',sub:'Subtema',quando:'Quando',data:'Data',dias:'Dias'};
  const pas=seq.map((n,i)=>`<span class="qa-p ${ix===i?'on':ix>i?'ok':''}">${ix>i?'✓':i+1} ${nomes[n]}</span>`).join('');
  const T=smTipoDe(QA.area),resumo=`“${esc(QA.texto.trim())}” · ${smTipoIco(QA.area)} ${esc(T.nome)}${QA.sub?' › '+esc(QA.sub):''}`;
  const lista=(itens,cur,fn)=>`<div class="qa-ops">${itens.map((n,i)=>`<button class="qa-op ${i===cur?'on':''}" onclick="${fn}(${i})">${n}</button>`).join('')}</div>`;
  const voltar=p2=>`<button class="b s sm-ghost" onclick="qaVai('${p2}')">← voltar</button>`;
  let corpo,dica;
  if(p==='texto'){corpo=`<input id="qa_in" class="qa-in" placeholder="Ex.: revisar RM de joelho" value="${esc(QA.texto)}" oninput="QA.texto=this.value" autocomplete="off"><div class="row" style="margin-top:10px"><button class="b" onclick="qaVai('tipo')">Próximo →</button></div>`;
    dica='<kbd>Enter</kbd> próximo · <kbd>Esc</kbd> fechar'}
  else if(p==='tipo'){const L=qaTipos(),curto=qaCurto(QA.area)&&QA.tc<L.length;
    corpo=`<div class="qa-tx">“${esc(QA.texto.trim())}”</div>${lista([...L.map(t=>`${smTipoIco(t.id)} ${esc(t.nome)}`),'➕ Novo tipo…'],QA.tc,'qaEscolheTipo')}
    <div class="row" style="margin-top:10px">${curto?`<button class="b" onclick="QA.dias=new Set(['${hj}']);qaAdd()">Adicionar só hoje</button><button class="b s sm-ghost" onclick="qaVai('dias')">Escolher mais dias →</button>`:`<button class="b" onclick="qaTipoOk()">Próximo →</button>`}${voltar('texto')}</div>`;
    dica=curto?'<kbd>↑</kbd><kbd>↓</kbd> escolhe o tipo · <kbd>Enter</kbd> adiciona <b>só hoje</b> · <kbd>→</kbd> mais dias · <kbd>Esc</kbd> volta':'<kbd>↑</kbd><kbd>↓</kbd> escolhe o tipo · <kbd>Enter</kbd> ou <kbd>→</kbd> próximo · <kbd>Esc</kbd> volta'}
  else if(p==='novotipo'){corpo=`<div class="qa-tx">Novo tipo de tarefa</div><input id="qa_in" class="qa-in" placeholder="Ex.: Pessoal, Casa, Leitura" value="" autocomplete="off"><div class="row" style="margin-top:10px"><button class="b" onclick="qaNovoTipo()">Criar e continuar →</button>${voltar('tipo')}</div>`;
    dica='<kbd>Enter</kbd> cria o tipo · <kbd>Esc</kbd> volta'}
  else if(p==='sub'){const ss=T.subs||[];
    corpo=`<div class="qa-tx">${resumo}</div>${lista(['Sem subtema',...ss.map(esc),'➕ Novo subtema…'],QA.sc,'qaSubOk')}<div class="row" style="margin-top:10px">${voltar('tipo')}</div>`;
    dica='<kbd>↑</kbd><kbd>↓</kbd> escolhe o subtema · <kbd>Enter</kbd> confirma · <kbd>Esc</kbd> volta'}
  else if(p==='novosub'){corpo=`<div class="qa-tx">Novo subtema de ${esc(T.nome)}</div><input id="qa_in" class="qa-in" placeholder="Ex.: Casamento" value="" autocomplete="off"><div class="row" style="margin-top:10px"><button class="b" onclick="qaNovoSub()">Criar e continuar →</button>${voltar('sub')}</div>`;
    dica='<kbd>Enter</kbd> cria o subtema · <kbd>Esc</kbd> volta'}
  else if(p==='quando'){
    corpo=`<div class="qa-tx">${resumo}</div>${lista(['📅 Hoje','🗓️ Dia específico…','♾️ Sem data'],QA.qc,'qaQuandoOk')}<div class="row" style="margin-top:10px">${voltar('sub')}</div>`;
    dica='<kbd>↑</kbd><kbd>↓</kbd> escolhe · <kbd>Enter</kbd> confirma · <kbd>Esc</kbd> volta'}
  else if(p==='data'){
    corpo=`<div class="qa-tx">${resumo}</div>${qaCalHtml()}<div class="row" style="margin-top:10px"><button class="b" onclick="qaAdd(['${QA.calCur}'])">Adicionar em ${smRotL(QA.calCur)}</button>${voltar('quando')}</div>`;
    dica='<kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd> dia/semana · <kbd>PgUp</kbd><kbd>PgDn</kbd> mês · <kbd>Enter</kbd> escolhe · <kbd>Esc</kbd> volta'}
  else{let sem='';corpo=`<div class="qa-tx">${resumo}</div><div class="qa-dias">${QA.lista.map((d,i)=>{
      const s=smNumSem(d),cab=s!==sem?`<div class="qa-sem">Semana ${s}</div>`:'';sem=s;const tp=smTipo(d),noi=smNoite(d);
      return cab+`<div class="qa-dia ${QA.dias.has(d)?'on':''} ${i===QA.cur?'cur':''} ${tp!=='estudo'?'des':''}" id="qa_d${i}" onclick="QA.cur=${i};qaMarca('${d}')"><span class="qa-ck">${QA.dias.has(d)?'✓':''}</span>${smRotL(d)}${d===hj?' <b>· hoje</b>':''}<span class="mut">${noi?' · '+noi:''}${tp!=='estudo'?' · '+tp:''}</span></div>`}).join('')}</div>
    <div class="row" style="margin-top:10px"><button class="b" onclick="qaAdd()">Adicionar em ${QA.dias.size||1} dia${(QA.dias.size||1)>1?'s':''}</button>${voltar('tipo')}</div>`;
    dica='<kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> anda · <kbd>A</kbd> marca/desmarca · <kbd>Enter</kbd> adiciona · <kbd>Esc</kbd> volta'}
  el.innerHTML=`<div class="qa-caixa" role="dialog" aria-label="Adicionar tarefa"><div class="row" style="justify-content:space-between"><b>➕ Nova tarefa</b><button class="b s sm-ghost" onclick="qaFecha()" aria-label="Fechar">✕</button></div>
    <div class="qa-passos">${pas}</div>${corpo}<div class="qa-dica">${dica}</div></div>`;
  if(p==='texto'||p==='novotipo'||p==='novosub'){const i=document.getElementById('qa_in');i.focus();i.setSelectionRange(i.value.length,i.value.length)}
  else{document.activeElement&&document.activeElement.blur();const c=document.getElementById('qa_d'+QA.cur)||document.querySelector('#qa .qa-op.on');c&&c.scrollIntoView({block:'nearest'})}
}
window.addEventListener('keydown',e=>{
  if(!QA.on){if(e.altKey&&!e.ctrlKey&&(e.code==='Key'+KEY('qa').toUpperCase()||e.code==='Digit'+KEY('qa'))&&(tela==='hoje'||tela==='semana')){e.preventDefault();e.stopImmediatePropagation();qaAbre()}return}
  const k=e.key,p=QA.passo;e.stopImmediatePropagation();
  const usa=()=>e.preventDefault();
  if(p==='texto'||p==='novotipo'||p==='novosub'){
    if(k==='Enter'){usa();p==='texto'?qaVai('tipo'):p==='novotipo'?qaNovoTipo():qaNovoSub()}else if(k==='Escape'){usa();qaVolta()}return}
  usa();const dn=k==='ArrowDown',up=k==='ArrowUp';
  if(p==='tipo'){if(up||dn)qaEscolheTipo(QA.tc+(dn?1:-1));else if(k==='Enter')qaTipoOk();
    else if(k==='ArrowRight'){if(qaCurto(QA.area)&&QA.tc<qaTipos().length)qaVai('dias');else qaTipoOk()}else if(k==='Escape'||k==='ArrowLeft')qaVolta();return}
  if(p==='sub'){const n=(smTipoDe(QA.area).subs||[]).length+2;
    if(up||dn){QA.sc=(QA.sc+(dn?1:-1)+n)%n;qaDesenha()}else if(k==='Enter'||k==='ArrowRight')qaSubOk(QA.sc);else if(k==='Escape'||k==='ArrowLeft')qaVolta();return}
  if(p==='quando'){if(up||dn){QA.qc=(QA.qc+(dn?1:-1)+3)%3;qaDesenha()}else if(k==='Enter'||k==='ArrowRight')qaQuandoOk(QA.qc);else if(k==='Escape'||k==='ArrowLeft')qaVolta();return}
  if(p==='data'){const m={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[k];
    if(m)qaCalVai(smMais(QA.calCur,m));else if(k==='PageUp')qaCalMes(-1);else if(k==='PageDown')qaCalMes(1);else if(k==='Enter')qaAdd([QA.calCur]);else if(k==='Escape')qaVolta();return}
  const n=QA.lista.length;   // passo "dias" (Estudo/Ferramenta)
  if(dn||k==='ArrowRight'){QA.cur=Math.min(n-1,QA.cur+1);qaDesenha()}
  else if(up||k==='ArrowLeft'){QA.cur=Math.max(0,QA.cur-1);qaDesenha()}
  else if((k==='a'||k==='A'||k===' ')&&!e.altKey)qaMarca(QA.lista[QA.cur]);
  else if(k==='Enter')qaAdd();else if(k==='Escape')qaVolta();
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
function smkLista(){return [...smAgrupa(smItensDe(smHoje())).flatMap(g=>g.l),...smAgrupa(smItensDe('sem')).flatMap(g=>g.l)]}
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
  if(k==='Enter'){e.preventDefault();if(x.pri)smPriCheck(x.dia,!x.feito);else smCheck(x.id,!x.feito);return}
  if(keyIs(e,'smdel')){e.preventDefault();if(x.pri){toast('Esse item vem da lista de prioridades; não dá para apagar aqui.');return}
    smMudar(d=>{d.tarefas=d.tarefas.filter(y=>y.id!==x.id)},'excluiu item');SMK.i=Math.min(SMK.i,n-2);toast('Item apagado')}
});
// clique fora do cartão de hoje e da célula "Sem data" solta a seleção do teclado
document.addEventListener('pointerdown',e=>{if(tela==='semana'&&SMK.on&&!e.target.closest('.sm-hoje1,.sm-sd')){SMK.on=false;smkPinta()}},true);
