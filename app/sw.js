const C='radio-au-cd40e4c87f', T='radio-au-terrain', F='radio-au-fonts';
const CORE=['./','./index.html','./app.js','./data.json','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
const timed=(req,ms)=>new Promise((res,rej)=>{const t=setTimeout(()=>rej(new Error('timeout')),ms); fetch(req).then(r=>{clearTimeout(t);res(r)},e=>{clearTimeout(t);rej(e)})});
async function precacheTerrain(){
  const c=await caches.open(T);
  try{ const r=await fetch('terrain/index.json',{cache:'no-cache'}); if(!r.ok) return;
    await c.put('terrain/index.json',r.clone()); const idx=await r.json(), have=new Set((await c.keys()).map(k=>new URL(k.url).pathname.split('/').pop()));
    await Promise.allSettled((idx.tiles||[]).filter(n=>!have.has(n+'.bin.z')).map(n=>c.add('terrain/'+n+'.bin.z')));
  }catch(e){}
}
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(CORE.map(u=>new Request(u,{cache:'reload'})))).then(precacheTerrain).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>![C,T,F].includes(k)).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('message',e=>{ if(e.data==='precache') e.waitUntil(precacheTerrain()); });
self.addEventListener('fetch',e=>{
  const req=e.request, u=new URL(req.url);
  if(req.method!=='GET') return;
  if(u.origin===location.origin && /\/terrain\/[^/]+\.bin\.z$/.test(u.pathname)){
    e.respondWith(caches.open(T).then(c=>c.match(req).then(r=>r||fetch(req).then(n=>{ if(n.ok) c.put(req,n.clone()); return n; }))));
  } else if(u.origin===location.origin && /\/terrain\/index\.json$/.test(u.pathname)){
    e.respondWith(caches.open(T).then(c=>timed(req,3000).then(n=>{ if(n.ok) c.put('terrain/index.json',n.clone()); return n; }).catch(()=>c.match('terrain/index.json'))));
  } else if(u.origin===location.origin){
    e.respondWith(timed(req,3000).then(r=>{ if(r.ok){ const cp=r.clone(); caches.open(C).then(c=>c.put(req,cp)); } return r; })
      .catch(()=>caches.match(req,{ignoreSearch:true}).then(r=>r||caches.match('./index.html'))));
  } else if(/fonts\.(googleapis|gstatic)\.com/.test(u.host)){
    e.respondWith(caches.open(F).then(c=>c.match(req).then(r=>r||fetch(req).then(n=>{ c.put(req,n.clone()); return n; }))));
  }
});
