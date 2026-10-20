// Service worker do Banco CBR: guarda o app para abrir sem internet e serve as imagens (./img/<arquivo>)
// lendo do repositório privado com a chave do aparelho. Imagem vista uma vez fica no aparelho.
const VERSAO = "bcbr-v8";
const APP = ["./", "./index.html", "./shim.js", "./app.js", "./manifest.webmanifest", "./icon.svg"];
const REPO = "arturaragao/banco-cbr-app";
self.addEventListener("install", (e) => { e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(APP)).catch(() => {})); self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("bcbr-v") && k !== VERSAO).map((k) => caches.delete(k))))); self.clients.claim(); });
async function token() { const c = await caches.open("bcbr-cfg"); const r = await c.match("./__token"); return r ? r.text() : ""; }
async function imagem(req, nome) {
  const cache = await caches.open("bcbr-img");
  const hit = await cache.match(req); if (hit) return hit;
  const tk = await token();
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/imagens/${encodeURIComponent(nome)}`, { headers: { Authorization: "Bearer " + tk, Accept: "application/vnd.github.raw" } });
  if (!r.ok) return new Response("", { status: r.status });
  const ext = nome.split(".").pop().toLowerCase();
  const tipo = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" }[ext] || "image/jpeg";
  const resp = new Response(await r.blob(), { headers: { "Content-Type": tipo } });
  cache.put(req, resp.clone()); return resp;
}
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (u.origin !== location.origin) return;
  const m = u.pathname.match(/\/img\/([^/]+)$/);
  if (m) return e.respondWith(imagem(e.request, decodeURIComponent(m[1])));
  // app: rede primeiro (pega versão nova), cache se estiver sem internet
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok && e.request.method === "GET") { const cp = r.clone(); caches.open(VERSAO).then((c) => c.put(e.request, cp)); return r; }
    return caches.match(e.request, { ignoreSearch: true }).then((c) => c || r);   // GitHub fora do ar (erro 5xx): usa a cópia do aparelho
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
