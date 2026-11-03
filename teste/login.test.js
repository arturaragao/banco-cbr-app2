const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const fonte=fs.readFileSync(require.resolve('../shim.js'),'utf8');
async function app({status=503,rede=false,cache=false,mem=new Map([['bcbr_gh_token','credencial-ficticia']]),legado=''}={}){
  const els=new Map(),eventos=new Map(),pedidos=[],recarregamentos=[],kv=new Map(cache?[['f:questoes.json',{txt:'[]'}]]:[]);
  const el=id=>{if(!els.has(id))els.set(id,{innerHTML:'',value:''});return els.get(id)};
  const document={visibilityState:'visible',getElementById:el,addEventListener:(k,f)=>{eventos.set(k,f)},createElement:()=>({}),body:{appendChild(){}}};
  const localStorage={getItem:k=>mem.get(k)||null,setItem:(k,v)=>mem.set(k,String(v)),removeItem:k=>mem.delete(k)};
  const db={transaction(){const tr={objectStore(){return{get(k){const r={result:kv.get(k)};queueMicrotask(()=>r.onsuccess());return r},put(v,k){kv.set(k,v);queueMicrotask(()=>tr.oncomplete?.())}}}};return tr}};
  const c=vm.createContext({console,document,localStorage,navigator:{},window:{addEventListener:(k,f)=>eventos.set(k,f),BCBR_VERSAO:'1.28.0'},
    location:{search:'',reload(){recarregamentos.push(true)}},sessionStorage:{getItem(){},setItem(){}},setInterval(){},URL,URLSearchParams,Response,
    indexedDB:{open(){const r={result:db};queueMicrotask(()=>r.onsuccess());return r}},
    caches:{open:async()=>({match:async()=>legado?new Response(legado):null,put:async()=>{}})},
    fetch:async(u,opt)=>{if(String(u).includes('versao.txt'))return new Response('1.28.0');pedidos.push(opt.headers.Authorization);if(rede)throw new TypeError('Falha de rede');return new Response('{"message":"credential token"}',{status})},
    atob:s=>Buffer.from(s,'base64').toString('binary'),btoa:s=>Buffer.from(s,'binary').toString('base64')});
  vm.runInContext(fonte,c);await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r));
  return{c,mem,els,eventos,pedidos,recarregamentos,document,config:()=>el('app').innerHTML.includes('id="cf_tk"')};
}
for(const cache of [false,true])for(const tipo of ['rede',403,404,409,429,503])test(`login não é pedido após ${tipo}, cache=${cache}`,async()=>{
  const a=await app({rede:tipo==='rede',status:typeof tipo==='number'?tipo:503,cache});
  assert.equal(a.config(),false);assert.equal(a.mem.get('bcbr_gh_token'),'credencial-ficticia');
  if(!cache)assert.match(a.els.get('app').innerHTML,/Tentar novamente/);
  await assert.rejects(a.c.window.BCBR.api('/teste'));
  assert.equal(a.config(),false);
});
test('401 real pede credencial uma vez; abas compartilham chave e aviso',async()=>{
  const a=await app({status:401});assert.equal(a.config(),true);
  const aviso=a.mem.get('bcbr_auth_aviso');await assert.rejects(a.c.window.BCBR.api('/teste'));
  assert.equal(a.mem.get('bcbr_auth_aviso'),aviso);
  const b=await app({status:401,mem:a.mem});assert.equal(b.config(),false);
  b.eventos.get('storage')({key:'bcbr_gh_token',newValue:'nova-ficticia'});assert.equal(b.recarregamentos.length,1);
  a.mem.set('bcbr_gh_token','nova-ficticia');await assert.rejects(b.c.window.BCBR.api('/teste'));
  assert.equal(b.pedidos.at(-1),'Bearer nova-ficticia');
});

test('blobs usam Accept raw do GitHub e preservam a classificação de 401',async()=>{
  const a=await app({cache:true});let accept;
  a.c.fetch=async(_u,opt)=>{accept=opt.headers.Accept;return new Response('conteúdo fictício')};
  assert.equal(await a.c.window.BCBR.raw('sha-ficticio'),'conteúdo fictício');assert.equal(accept,'application/vnd.github.raw');
  a.c.fetch=async()=>new Response('{}',{status:401});await assert.rejects(a.c.window.BCBR.raw('sha-ficticio'));assert.equal(a.config(),true);
});
test('401 de uma requisição antiga não pede login depois de trocar a chave',async()=>{
  const a=await app({cache:true});
  a.c.fetch=async()=>{a.mem.set('bcbr_gh_token','atual-ficticia');return new Response('{}',{status:401})};
  await assert.rejects(a.c.window.BCBR.api('/teste'));assert.equal(a.config(),false);
});
test('recupera token do cache legado do SW e o reutiliza após atualização/reabertura',async()=>{
  const a=await app({mem:new Map(),legado:'legada-ficticia',rede:true});
  assert.equal(a.config(),false);assert.equal(a.mem.get('bcbr_gh_token'),'legada-ficticia');
  const b=await app({mem:a.mem,rede:true});assert.equal(b.config(),false);assert.equal(b.pedidos[0],'Bearer legada-ficticia');
  const sw=fs.readFileSync(require.resolve('../sw.js'),'utf8');
  const ativacao=sw.slice(sw.indexOf('self.addEventListener("activate"'),sw.indexOf('async function token'));
  assert.doesNotMatch(ativacao,/bcbr-cfg|localStorage/);
});
