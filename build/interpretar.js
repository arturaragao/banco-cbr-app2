// ===== INTERPRETAR O TEXTO DE UMA TAREFA (pt-BR, sem API) — 1.17.0 =====
// Função pura: interpretarTarefa(texto, hoje) -> [{texto, dia, hora, urg, area}]
//  dia: 'AAAA-MM-DD' | 'sem' (disse "sem data") | null (o texto não diz; quem chama usa o padrão/opção escolhida)
//  hora: 'HH:MM' | null · urg: boolean · area: 'estudo' | 'ferramenta' | 'tarefas' | null (null = padrão de quem chama)
//  hoje: 'AAAA-MM-DD' (padrão: hoje no aparelho). Um ditado pode ter várias tarefas: "próxima tarefa", "nova tarefa", "outra tarefa" ou ";".
// Ex.: "consulta neurologista dia 30/10 11 horas" -> [{texto:'Consulta neurologista', dia:'AAAA-10-30', hora:'11:00', ...}]
// Testes: teste/interpretar.test.js (node teste/interpretar.test.js). Sem dependências: roda no navegador e no node.
const itpSem = s => s.replace(/[áàâãä]/g, 'a').replace(/[éèêë]/g, 'e').replace(/[íìîï]/g, 'i').replace(/[óòôõö]/g, 'o').replace(/[úùûü]/g, 'u').replace(/ç/g, 'c').replace(/ñ/g, 'n');
const itpP = n => String(n).padStart(2, '0');
const itpIso = (y, m, d) => y + '-' + itpP(m) + '-' + itpP(d);
const itpValida = (y, m, d) => { const x = new Date(y, m - 1, d, 12); return x.getFullYear() === y && x.getMonth() === m - 1 && x.getDate() === d };
function itpMais(iso, n) { const [y, m, d] = iso.split('-').map(Number), x = new Date(y, m - 1, d + n, 12); return itpIso(x.getFullYear(), x.getMonth() + 1, x.getDate()) }
function itpDow(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d, 12).getDay() }
const ITP_MESES = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const ITP_DIAS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

// dia/mês (sem ano: este ano, ou o próximo se já passou) -> ISO ou null
function itpDataNum(d, mo, y, hoje) {
  const hy = +hoje.slice(0, 4);
  if (y != null) { y = y < 100 ? 2000 + y : y; return itpValida(y, mo, d) ? itpIso(y, mo, d) : null }
  if (itpValida(hy, mo, d) && itpIso(hy, mo, d) >= hoje) return itpIso(hy, mo, d);
  return itpValida(hy + 1, mo, d) ? itpIso(hy + 1, mo, d) : null;
}
// "dia 30": este mês; se já passou (ou o mês não tem o dia), o próximo que tiver
function itpDiaDoMes(d, hoje) {
  const y = +hoje.slice(0, 4), m = +hoje.slice(5, 7);
  for (let i = 0; i < 14; i++) { const mm = m + i, yy = y + Math.floor((mm - 1) / 12), m2 = ((mm - 1) % 12) + 1; if (itpValida(yy, m2, d) && itpIso(yy, m2, d) >= hoje) return itpIso(yy, m2, d) }
  return null;
}

function itpPartes(s) {
  const n = itpSem(s.toLowerCase()), re = /\s*;\s*|[\s,.]*\b(?:proxima|nova|outra)\s+tarefa\b[\s,.:]*/g, out = [];
  let ult = 0, m;
  while ((m = re.exec(n))) { out.push(s.slice(ult, m.index)); ult = m.index + m[0].length; if (!m[0].length) re.lastIndex++ }
  out.push(s.slice(ult));
  return out.map(x => x.trim()).filter(Boolean);
}

function itpUma(seg, hoje) {
  let o = seg, n = itpSem(seg.toLowerCase());
  const R = { texto: '', dia: null, hora: null, urg: false, area: null };
  // acha a 1ª ocorrência em que fn(m) não devolve false e apaga o trecho (o e n ficam alinhados, com espaços no lugar)
  const tira = (re, fn) => {
    const g = new RegExp(re.source, 'g'); let m;
    while ((m = g.exec(n))) {
      if (!m[0].length) { g.lastIndex++; continue }
      if (fn(m) === false) continue;
      const b = ' '.repeat(m[0].length);
      o = o.slice(0, m.index) + b + o.slice(m.index + m[0].length); n = n.slice(0, m.index) + b + n.slice(m.index + m[0].length);
      return true;
    }
    return false;
  };
  tira(/\bsem\s+data(?:\s+definida)?\b/, () => { R.dia = 'sem' });
  tira(/\burgente\b/, () => { R.urg = true });
  // ---- data ----
  const pre = '(?:\\b(?:para|pra|ate|em)\\s+)?';
  if (!R.dia) {
    tira(new RegExp(pre + '\\bdepois\\s+de\\s+amanha\\b'), () => { R.dia = itpMais(hoje, 2) }) ||
    tira(new RegExp(pre + '\\bamanha\\b'), () => { R.dia = itpMais(hoje, 1) }) ||
    tira(new RegExp(pre + '\\bhoje\\b'), () => { R.dia = hoje }) ||
    tira(/(?:\bdia\s+)?\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?(?!\d)/, m => { const iso = itpDataNum(+m[1], +m[2], m[3] != null ? +m[3] : null, hoje); if (!iso) return false; R.dia = iso }) ||
    tira(new RegExp('(?:\\bdia\\s+)?\\b(\\d{1,2})\\s+de\\s+(' + ITP_MESES.join('|') + ')(?:\\s+de\\s+(\\d{4}))?\\b'), m => { const iso = itpDataNum(+m[1], ITP_MESES.indexOf(m[2]) + 1, m[3] != null ? +m[3] : null, hoje); if (!iso) return false; R.dia = iso }) ||
    tira(/\bdia\s+(\d{1,2})\b/, m => { const iso = itpDiaDoMes(+m[1], hoje); if (!iso) return false; R.dia = iso }) ||
    tira(new RegExp('(?:\\b(?:na|no|nesta|neste|esta|este|proxima|proximo|pra|para)\\s+)?\\b(' + ITP_DIAS.join('|') + ')(?:-feira)?\\b'), m => {
      const alvo = ITP_DIAS.indexOf(m[1]), delta = ((alvo - itpDow(hoje)) % 7 + 7) % 7 || 7; R.dia = itpMais(hoje, delta);
    });
  }
  // ---- hora ----
  const as = '(?:\\bas\\s+)?', hv = (h, mi) => { if (h > 23 || mi > 59) return false; R.hora = itpP(h) + ':' + itpP(mi) };
  tira(new RegExp(as + '\\b(\\d{1,2})\\s+(?:horas?\\s+)?da\\s+(tarde|noite|manha)\\b'), m => { let h = +m[1]; if (m[2] !== 'manha' && h < 12) h += 12; return hv(h, 0) }) ||
  tira(new RegExp(as + '\\b(\\d{1,2})\\s*(?:horas?|h)\\s+e\\s+meia\\b'), m => hv(+m[1], 30)) ||
  tira(new RegExp(as + '\\b(\\d{1,2}):(\\d{2})\\b'), m => hv(+m[1], +m[2])) ||
  tira(new RegExp(as + '\\b(\\d{1,2})h(\\d{2})\\b'), m => hv(+m[1], +m[2])) ||
  tira(new RegExp(as + '\\b(\\d{1,2})\\s*(?:horas?|h)\\b'), m => hv(+m[1], 0)) ||
  tira(new RegExp(as + '\\b(\\d{1,2})\\s+e\\s+meia\\b'), m => hv(+m[1], 30)) ||
  tira(/\bmeio[\s-]dia\b/, () => hv(12, 0)) ||
  tira(/\bas\s+(\d{1,2})\b(?![\/:])/, m => hv(+m[1], 0));
  if (R.hora) {   // "3 horas da tarde", "11 da noite": ajusta para 24 h e tira a palavra
    const h = +R.hora.slice(0, 2);
    tira(/\bda\s+(tarde|noite|manha)\b/, m => { if (m[1] !== 'manha' && h >= 1 && h < 12) R.hora = itpP(h + 12) + R.hora.slice(2) });
  }
  // ---- tipo: "estudo"/"ferramenta"/"tarefa" no começo ou no fim ----
  const resta = (re) => { const m = re.exec(n); if (!m) return null; const t = n.slice(0, m.index) + ' '.repeat(m[0].length) + n.slice(m.index + m[0].length); return /[a-z0-9]/.test(t) ? m : null };
  const tira2 = (m) => { const b = ' '.repeat(m[0].length); o = o.slice(0, m.index) + b + o.slice(m.index + m[0].length); n = n.slice(0, m.index) + b + n.slice(m.index + m[0].length) };
  const tipoDe = w => /^tarefa/.test(w) ? 'tarefas' : w;
  for (let i = 0; i < 4; i++) {
    const ini = resta(/^\s*(?:[,.:;-]\s*)*(estudo|ferramenta|tarefas?)\b(?!\s+(?:de|do|da|dos|das|sobre|para|pra)\b)/), fim = resta(/\b(estudo|ferramenta|tarefas?)[\s,.:;-]*$/);
    const m = ini || fim; if (!m) break;
    if (!R.area) R.area = tipoDe(m[1]);
    tira2(m);
  }
  // ---- limpeza: espaços, pontuação solta e preposições que sobraram nas pontas ----
  let t = o.replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 12; i++) {
    const nt = itpSem(t.toLowerCase());
    const f = nt.match(/^(?:[,.:;-]\s*)+/) || nt.match(/(?:\s*[,:;-])+$/) || nt.match(/\s+(?:a|as|o|os|no|na|nos|nas|em|para|pra|de|do|da|e|ate|por)$/) || nt.match(/^(?:para|pra|e|ate)\s+/);
    if (!f) break;
    t = f.index === 0 ? t.slice(f[0].length) : t.slice(0, f.index);
    t = t.trim();
  }
  if (!t) t = seg.trim();
  R.texto = t.charAt(0).toUpperCase() + t.slice(1);
  return R;
}

function interpretarTarefa(texto, hoje) {
  if (!hoje) { const x = new Date(); hoje = itpIso(x.getFullYear(), x.getMonth() + 1, x.getDate()) }
  texto = String(texto == null ? '' : texto).normalize('NFC');
  return itpPartes(texto).map(p => itpUma(p, hoje));
}
// Título curto de uma ideia ditada no widget Ideia (pedido do Artur, 24/10/2026): tira a enrolação da fala
// ("eu queria que", "tipo", "né") e fica com a 1ª frase, até 8 palavras. O texto inteiro vai nos detalhes.
const ITP_MULETAS = /(^|\s)(n[ée]|tipo assim|tipo|beleza|a[íi]|ent[ãa]o|assim|sabe|cara|enfim)[,.]?(?=\s|$)/gi;
const ITP_INICIO = /^(e |mas |olha |bom |a ideia [ée] |ideia:? |seria (legal|bom) (se |que )?|(eu )?(queria|quero|preciso|gostaria)( de)?( que)? |vamos |fazer (com )?que )+/i;
function tituloIdeia(texto) {
  const t = String(texto == null ? '' : texto).replace(/\s+/g, ' ').trim();
  const frase = t.split(/[.!?;]|, (?=mas |porque |pq )/)[0].trim() || t;
  let c = frase.replace(ITP_MULETAS, ' ').replace(/\s+/g, ' ').trim();
  for (let k = 0; k < 3; k++) c = c.replace(ITP_INICIO, '').trim();
  if (!c) c = t;
  c = c.split(' ').slice(0, 8).join(' ').replace(/[\s,.;:—-]+$/, '')
    .replace(/\s+(e|de|do|da|que|o|a|os|as|em|no|na|pra|para|com|um|uma|ele|ela|se|mas|é)$/i, '');
  return c.charAt(0).toUpperCase() + c.slice(1);
}
if (typeof module !== 'undefined' && module.exports) module.exports = { interpretarTarefa, tituloIdeia };
