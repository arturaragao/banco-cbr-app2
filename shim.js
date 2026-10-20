// Banco CBR (app) — ponte entre o código do artefato e o GitHub.
// - Questões: dados/questoes.json do repo privado (cache no aparelho, só baixa de novo se mudar).
// - Progresso: substitui o banco do artefato (claude.use('db')) por arquivos progresso/<doc>.json no repo privado.
// - IA: substitui claude.use('sample') pelo Gemini (chave do aparelho).
// - Imagens: o service worker (sw.js) serve ./img/<arquivo> lendo do repo com a chave.
(function () {
  const REPO = "arturaragao/banco-cbr-app", API = "https://api.github.com";
  const LS = { tk: "bcbr_gh_token", gm: "bcbr_gemini_key", gmModelo: "bcbr_gemini_modelo" };
  const tok = () => localStorage.getItem(LS.tk) || "";
  window.BCBR = { REPO };

  // ---------- tela de configuração (1x por aparelho) ----------
  function telaConfig(msg) {
    document.getElementById("app").innerHTML = `<div class="card" style="max-width:560px;margin:24px auto">
      <h2>Banco CBR — configurar este aparelho</h2>
      <p class="mut">Uma vez por aparelho. As chaves ficam só aqui.</p>
      ${msg ? `<p style="color:var(--bad)">${msg}</p>` : ""}
      <label style="display:block;margin-top:10px"><b>Chave do GitHub</b> (fine-grained, repositório <b>banco-cbr-app</b>, Contents: Read and write)
        <input id="cf_tk" type="password" style="width:100%" value="${tok()}"></label>
      <label style="display:block;margin-top:10px"><b>Chave do Gemini</b> (opcional: para o botão de comentário com IA)
        <input id="cf_gm" type="password" style="width:100%" value="${localStorage.getItem(LS.gm) || ""}"></label>
      <div class="row" style="margin-top:14px"><button class="b" id="cf_ok">Salvar e abrir</button></div></div>`;
    document.getElementById("cf_ok").onclick = async () => {
      localStorage.setItem(LS.tk, document.getElementById("cf_tk").value.trim());
      localStorage.setItem(LS.gm, document.getElementById("cf_gm").value.trim());
      await passarChaveSW(); location.reload();
    };
  }
  window.BCBR.config = telaConfig;

  async function api(path, opt = {}) {
    const r = await fetch(API + path, {
      ...opt, cache: "no-store",
      headers: { Authorization: "Bearer " + tok(), Accept: opt.accept || "application/vnd.github+json", ...(opt.body ? { "Content-Type": "application/json" } : {}) },
    });
    if (r.status === 401 || r.status === 403 && /credential|token/i.test(await r.clone().text())) throw Object.assign(new Error("chave"), { chave: true });
    if (!r.ok) throw Object.assign(new Error("GitHub " + r.status), { status: r.status, resp: await r.text().catch(() => "") });
    return opt.accept === "raw" ? r : r.json();
  }
  const raw = (sha) => fetch(`${API}/repos/${REPO}/git/blobs/${sha}`, { headers: { Authorization: "Bearer " + tok(), Accept: "application/vnd.github.raw" } })
    .then((r) => { if (!r.ok) throw new Error("GitHub " + r.status); return r.text(); });
  const b64 = (s) => btoa(unescape(encodeURIComponent(s)));

  // ---------- cache simples em IndexedDB ----------
  const idb = new Promise((ok, no) => { const r = indexedDB.open("bcbr", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
  const kvGet = (k) => idb.then((d) => new Promise((ok) => { const t = d.transaction("kv").objectStore("kv").get(k); t.onsuccess = () => ok(t.result); t.onerror = () => ok(undefined); })).catch(() => undefined);
  const kvSet = (k, v) => idb.then((d) => new Promise((ok) => { const t = d.transaction("kv", "readwrite"); t.objectStore("kv").put(v, k); t.oncomplete = ok; t.onerror = ok; })).catch(() => {});

  async function passarChaveSW() {
    try { const c = await caches.open("bcbr-cfg"); await c.put("./__token", new Response(tok())); } catch (e) {}
  }

  // ---------- questões ----------
  const limpa = (s) => String(s ?? "").replace(/<span[^>]*>\s*\[\*?🖼[^\]]*\]\([^)]*\)\s*<\/span>/g, "").replace(/\*\*(.+?)\*\*/g, "$1").replace(/\n{3,}/g, "\n\n").trim();
  function adaptar(U) {
    return U.filter((u) => u.alts && Object.keys(u.alts).length).map((u) => ({
      id: u.id, n: u.n, grupo: null, enunciado: limpa(u.enunciado),
      alts: Object.fromEntries(Object.entries(u.alts).map(([k, v]) => [k, limpa(v)])), gab: u.gab || null,
      coment: (u.claude && u.claude.coment) || {}, ponto: (u.claude && u.claude.ponto) || "",
      tags: u.tags && u.tags.length ? u.tags : (u.cl || []).slice(),
      imgs: (u.imgs || []).filter((f) => !f.startsWith("images/")).map((f) => "gh:" + f),
      imgsCom: (u.imgsCom || []).filter((f) => !f.startsWith("images/")).map((f) => "gh:" + f),
      acerto: u.acerto ?? null, ar: u.ar || undefined, cl: u.cl || [], dif: u.dif || null,
      curso: u.curso || null, claudeMd: u.claude_md || "", chegou: u.chegou || null, classif: u.classif || null, origem: u.origem || null, legendas: u.legendas || [], legendasCom: u.legendasCom || [],
    }));
  }
  async function carregarDados() {
    const lista = await api(`/repos/${REPO}/contents/dados`);
    const sha = Object.fromEntries(lista.map((f) => [f.name, f.sha]));
    const pegar = async (nome) => {
      const c = await kvGet("f:" + nome);
      if (c && c.sha === sha[nome]) return c.txt;
      const txt = await raw(sha[nome]); kvSet("f:" + nome, { sha: sha[nome], txt }); return txt;
    };
    const [q, m] = await Promise.all([pegar("questoes.json"), sha["metodologia.md"] ? pegar("metodologia.md") : ""]);
    window.QUESTOES = adaptar(JSON.parse(q)); window.METODO = m;
  }
  async function dadosDoCache() {
    const q = await kvGet("f:questoes.json"), m = await kvGet("f:metodologia.md");
    if (!q) return false;
    window.QUESTOES = adaptar(JSON.parse(q.txt)); window.METODO = m ? m.txt : ""; return true;
  }

  // ---------- progresso: o "banco" do artefato vira arquivos no GitHub ----------
  const docs = new Map(), shas = new Map();   // id -> dados, id -> sha do arquivo
  let fila = Promise.resolve(), ouvintes = [];
  const avisar = () => { const s = { docs: [...docs].map(([id, d]) => ({ id, data: () => d })) }; ouvintes.forEach((o) => o.cb(s)); };
  async function gravarDoc(id, data) {
    docs.set(id, data);
    const tarefa = async () => {
      for (let t = 1; t <= 4; t++) {
        try {
          const body = { message: "progresso: " + id, content: b64(JSON.stringify(data)), branch: "main" };
          if (shas.get(id)) body.sha = shas.get(id);
          const r = await api(`/repos/${REPO}/contents/progresso/${id}.json`, { method: "PUT", body: JSON.stringify(body) });
          shas.set(id, r.content.sha); kvSet("p:" + id, { sha: r.content.sha, d: data }); return;
        } catch (e) {
          if (e.status === 409 || e.status === 422) {   // mudou em outro aparelho: pega o sha novo e grava de novo
            try { const f = await api(`/repos/${REPO}/contents/progresso/${id}.json`); shas.set(id, f.sha); } catch (e2) { shas.delete(id); }
            continue;
          }
          throw e;
        }
      }
      throw new Error("não consegui gravar " + id);
    };
    const p = fila.then(tarefa); fila = p.catch(() => {}); return p;
  }
  async function puxar() {
    let lista;
    try { lista = await api(`/repos/${REPO}/contents/progresso`); } catch (e) { if (e.status === 404) lista = []; else throw e; }
    let mudou = false;
    await Promise.all(lista.filter((f) => f.name.endsWith(".json")).map(async (f) => {
      const id = f.name.slice(0, -5);
      if (shas.get(id) === f.sha && docs.has(id)) return;
      const c = await kvGet("p:" + id);
      const d = c && c.sha === f.sha ? c.d : JSON.parse(await raw(f.sha));
      if (!(c && c.sha === f.sha)) kvSet("p:" + id, { sha: f.sha, d });
      docs.set(id, d); shas.set(id, f.sha); mudou = true;
    }));
    return mudou;
  }
  const DBshim = {
    collection() {
      return {
        doc: (id) => ({ set: (data) => gravarDoc(id, data) }),
        onSnapshot(cb, err) {
          const o = { cb, err }; ouvintes.push(o);
          const ciclo = async (primeira) => {
            try { const m = await puxar(); if (m || primeira) avisar(); } catch (e) { err && err(e); }
          };
          ciclo(true);
          setInterval(() => document.visibilityState === "visible" && ciclo(false), 60000);
          document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && ciclo(false));
          return () => { ouvintes = ouvintes.filter((x) => x !== o); };
        },
      };
    },
  };

  // ---------- IA: Gemini no lugar do Claude do artefato ----------
  async function gemini(prompt) {
    const k = localStorage.getItem(LS.gm); if (!k) throw Object.assign(new Error("sem chave"), { code: "not_granted" });
    const m = localStorage.getItem(LS.gmModelo) || "gemini-3.8-flash";
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${k}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3 } }),
    });
    if (!r.ok) throw new Error("Gemini " + r.status);
    const j = await r.json(); return { text: j.candidates[0].content.parts.map((p) => p.text || "").join("") };
  }
  window.claude = { use: async (k) => (k === "db" ? DBshim : k === "sample" ? (localStorage.getItem(LS.gm) ? gemini : null) : null) };

  // ---------- baixar tudo (offline) ----------
  window.BCBR.baixarTudo = async (aoAndar) => {
    const fs = [...new Set((window.QUESTOES || []).flatMap((q) => [...q.imgs, ...q.imgsCom]).map((u) => u.slice(3)))];
    let n = 0;
    for (let i = 0; i < fs.length; i += 6) {
      await Promise.all(fs.slice(i, i + 6).map((f) => fetch("./img/" + encodeURIComponent(f)).catch(() => {})));
      n = Math.min(fs.length, i + 6); aoAndar && aoAndar(n, fs.length);
    }
    return fs.length;
  };

  // ---------- imagens: plano B quando o service worker não serve ./img/ (1ª abertura, endereço alternativo) ----------
  const imgCache = new Map();
  async function imgDireto(nome) {
    if (imgCache.has(nome)) return imgCache.get(nome);
    const p = (async () => {
      try { const c = await caches.open("bcbr-img"); const h = await c.match("./img/" + encodeURIComponent(nome)); if (h) return URL.createObjectURL(await h.blob()); } catch (e) {}
      const r = await fetch(`${API}/repos/${REPO}/contents/imagens/${encodeURIComponent(nome)}`, { headers: { Authorization: "Bearer " + tok(), Accept: "application/vnd.github.raw" } });
      if (!r.ok) throw new Error("img " + r.status);
      const b = await r.blob();
      try { const c = await caches.open("bcbr-img"); await c.put("./img/" + encodeURIComponent(nome), new Response(b.slice(0), { headers: { "Content-Type": b.type || "image/jpeg" } })); } catch (e) {}
      return URL.createObjectURL(b);
    })();
    imgCache.set(nome, p); p.catch(() => imgCache.delete(nome)); return p;
  }
  document.addEventListener("error", (ev) => {
    const el = ev.target;
    if (!el || el.tagName !== "IMG" || el.dataset.bcbrTentou) return;
    const m = String(el.getAttribute("src") || "").match(/(?:^|\/)img\/([^/?#]+)$/);
    if (!m) return;
    el.dataset.bcbrTentou = "1";
    imgDireto(decodeURIComponent(m[1])).then((u) => { el.src = u; }).catch(() => {});
  }, true);
  window.BCBR.imgDireto = imgDireto;

  // ---------- início ----------
  async function iniciar() {
    if ("serviceWorker" in navigator) { try { await navigator.serviceWorker.register("./sw.js"); await passarChaveSW(); } catch (e) {} }
    if (!tok()) return telaConfig();
    document.getElementById("app").innerHTML = `<div class="card"><p class="mut">Carregando o banco…</p></div>`;
    let ok = false;
    try { await carregarDados(); ok = true; }
    catch (e) {
      if (e.chave) return telaConfig("A chave do GitHub foi recusada. Confira e cole de novo.");
      ok = await dadosDoCache();   // sem internet: usa o que já está no aparelho
      if (!ok) return telaConfig("Não consegui baixar o banco (" + e.message + "). Confira a internet e a chave.");
    }
    const s = document.createElement("script"); s.src = "./app.js?v=" + (window.BCBR_VERSAO || "1"); document.body.appendChild(s);
  }
  iniciar();
})();
