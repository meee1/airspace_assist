const C='radio-au-174c161e7b', T='radio-au-terrain', F='radio-au-fonts', X='radio-au-charts';
const CORE=['./','./index.html','./app.js','./data.json','./urban.json','./manifest.webmanifest','./icon-192.png','./icon-512.png','./data-next.json'];
// files that belong to this build: served from this build's cache first (the ?v= in the URL is only a network cache-buster),
// so app code and AIP data can never come from two different builds
const BUILD=/\/(app\.js|data\.json|data-next\.json|urban\.json)$/;
const timed=(req,ms)=>{ const ac=new AbortController(); const t=setTimeout(()=>ac.abort(),ms);
  return fetch(req instanceof Request? new Request(req,{signal:ac.signal}) : req,{signal:ac.signal}).finally(()=>clearTimeout(t)); };
async function precacheTerrain(){   // all SRTM tiles, a few at a time; safe to call again (skips what's stored)
  const c=await caches.open(T);
  try{ const r=await fetch('terrain/index.json',{cache:'no-cache'}); if(!r.ok) return;
    await c.put('terrain/index.json',r.clone()); const idx=await r.json(), have=new Set((await c.keys()).map(k=>new URL(k.url).pathname.split('/').pop()));
    const todo=(idx.tiles||[]).filter(n=>!have.has(n+'.bin.z'));
    await Promise.all(Array.from({length:4},async()=>{ let n; while((n=todo.shift())!==undefined){ try{ await c.add('terrain/'+n+'.bin.z'); }catch(e){} } }));
  }catch(e){}
}
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(CORE.map(u=>new Request(u,{cache:'reload'})))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>![C,T,F,X].includes(k)).map(k=>caches.delete(k)))).then(()=>self.clients.claim()).then(()=>{ precacheTerrain(); }))});
self.addEventListener('message',e=>{ if(e.data==='precache') e.waitUntil(precacheTerrain()); });
self.addEventListener('fetch',e=>{
  const req=e.request, u=new URL(req.url);
  if(req.method!=='GET') return;
  if(u.origin!==location.origin){
    if(/fonts\.(googleapis|gstatic)\.com/.test(u.host)) e.respondWith(caches.open(F).then(c=>c.match(req).then(r=>r||fetch(req).then(n=>{ c.put(req,n.clone()); return n; }))));
    return; }
  if(/\/charts\/.+\.jpg$/.test(u.pathname) || /\/lib\//.test(u.pathname)){        // chart tiles (stored by the page) and pdf.js: cache first, kept across builds
    e.respondWith(caches.open(X).then(c=>c.match(req,{ignoreSearch:true}).then(r=>r||fetch(req).then(n=>{ if(n.ok&&/\/lib\//.test(u.pathname)) c.put(req,n.clone()); return n; }))));
  } else if(/\/charts\/index\.json$/.test(u.pathname)){
    e.respondWith(timed(req,3000).catch(()=>null).then(r=>r&&r.ok? r : caches.open(X).then(c=>c.match('charts/index.json').then(x=>x||r||Response.error()))));
  } else if(/\/terrain\/[^/]+\.bin\.z$/.test(u.pathname)){
    e.respondWith(caches.open(T).then(c=>c.match(req).then(r=>r||fetch(req).then(n=>{ if(n.ok) c.put(req,n.clone()); return n; }))));
  } else if(/\/terrain\/index\.json$/.test(u.pathname)){
    e.respondWith(caches.open(T).then(c=>timed(req,3000).then(n=>{ if(n.ok) c.put('terrain/index.json',n.clone()); return n; }).catch(()=>c.match('terrain/index.json'))));
  } else if(BUILD.test(u.pathname)){
    e.respondWith(caches.open(C).then(c=>c.match(req,{ignoreSearch:true}).then(r=>r||fetch(req).then(n=>{ if(n.ok) c.put(req,n.clone()); return n; }))));
  } else {   // the page and everything else: network first (3 s), then this build's cache; the page itself is the only fallback for a navigation
    e.respondWith(timed(req,3000).then(r=>{ if(r.ok){ const cp=r.clone(); caches.open(C).then(c=>c.put(req,cp)); return r; } return caches.match(req,{ignoreSearch:true}).then(x=>x||r); })
      .catch(()=>caches.match(req,{ignoreSearch:true}).then(r=>r||(req.mode==='navigate'? caches.match('./index.html') : Response.error()))));
  }
});
