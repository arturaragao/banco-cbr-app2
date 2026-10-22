// Kit de teste do Banco CBR: serve a raiz do app (sem copiar) e simula a API do GitHub com os dados locais.
// Uso: node teste/servidor.js [pasta-dos-dados] [porta]   (ou BCBR_DADOS=... PORT=...)
// Só código aqui: nenhum dado/questão/imagem é copiado. PUT de progresso só responde 200 (nada é gravado).
const http = require('http'), fs = require('fs'), path = require('path');
const RAIZ = path.resolve(__dirname, '..');
const D = path.resolve(process.argv[2] || process.env.BCBR_DADOS || path.join(RAIZ, '..', 'banco-cbr-app'));
const PORT = +(process.argv[3] || process.env.PORT || 8765);
if (!fs.existsSync(D + '/dados/questoes.json')) { console.error('Dados não encontrados em ' + D + ' (passe a pasta como 1º argumento)'); process.exit(1); }
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/json' };
// interceptor injetado no index.html (só na resposta; o arquivo do app não muda): desvia api.github.com para /api e põe token falso
const PRE = `(()=>{const f=window.fetch;window.fetch=(u,o)=>{u=String(u);if(u.startsWith('https://api.github.com'))u=u.replace('https://api.github.com','/api');return f(u,o)};
try{localStorage.setItem('bcbr_gh_token','token-falso')}catch(e){}})();`;
const SW_NULO = `self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.registration.unregister()));`;
let n = 0;
http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const j = (o, c = 200) => { res.writeHead(c, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (u.startsWith('/api/')) {
    let m;
    if ((m = u.match(/contents\/(dados|progresso|semana)$/))) {
      const d = D + '/' + m[1]; if (!fs.existsSync(d)) return j([]);
      return j(fs.readdirSync(d).filter(f => fs.statSync(d + '/' + f).isFile()).map(f => ({ name: f, sha: m[1] + '|' + f, type: 'file' })));
    }
    if ((m = u.match(/git\/blobs\/(.+)$/))) { const [a, b] = m[1].split('|'); if (!/^(dados|progresso|semana)$/.test(a) || b.includes('..')) { res.writeHead(404); return res.end(); } res.writeHead(200); return res.end(fs.readFileSync(D + '/' + a + '/' + b)); }
    if ((m = u.match(/contents\/imagens\/(.+)$/))) {
      const p = path.join(D, 'imagens', path.basename(m[1]));
      if (!fs.existsSync(p)) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'content-type': 'image/jpeg' }); return res.end(fs.readFileSync(p));
    }
    if (req.method === 'PUT') { req.resume(); return j({ content: { sha: 'fake' + (++n) } }); }
    const p = path.join(D, u.replace(/^.*contents\//, ''));
    if (p.startsWith(D) && fs.existsSync(p) && fs.statSync(p).isFile()) return j({ sha: 'x', content: fs.readFileSync(p).toString('base64'), encoding: 'base64' });
    res.writeHead(404); return res.end('{}');
  }
  if (u === '/sw.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(SW_NULO); }
  const rel = u === '/' ? '/index.html' : u, p = path.join(RAIZ, rel);
  if (!p.startsWith(RAIZ) || rel.startsWith('/teste') || !fs.existsSync(p) || !fs.statSync(p).isFile()) { res.writeHead(404); return res.end(); }
  let body = fs.readFileSync(p);
  if (rel === '/index.html') body = Buffer.from(body.toString('utf8').replace(/<script/, '<script>' + PRE + '</script><script'));
  res.writeHead(200, { 'content-type': mime[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(body);
}).listen(PORT, () => console.log(`Banco CBR (teste) em http://localhost:${PORT}/  dados: ${D}`));
