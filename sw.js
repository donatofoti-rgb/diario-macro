const CACHE='diario-macro-v5';
const SHELL=['./','index.html','app.js','seed.js','fooddb.json','manifest.webmanifest','vendor/zxing-reader.js','vendor/zxing_reader.wasm','icons/icon-180.png','icons/icon-192.png','icons/icon-512.png'];
// install: scarica sempre dalla rete (niente cache HTTP vecchia)
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL.map(u=>new Request(u,{cache:'reload'})))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
// pagina e codice: prima la rete (così gli aggiornamenti arrivano subito), cache se offline; resto: prima la cache
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin)return;
  const fresh=e.request.mode==='navigate'||/\.(html|js|json|webmanifest)$/.test(u.pathname)||u.pathname.endsWith('/');
  const put=res=>{if(res.ok){const cp=res.clone();caches.open(CACHE).then(c=>c.put(e.request,cp))}return res};
  if(fresh){e.respondWith(fetch(e.request,{cache:'no-store'}).then(put).catch(()=>caches.match(e.request,{ignoreSearch:true}).then(r=>r||caches.match('index.html'))));return}
  e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(r=>r||fetch(e.request).then(put)));
});
