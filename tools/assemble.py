import json, os, sys, hashlib
from PIL import Image, ImageDraw, ImageFont
# Service worker: everything the app needs offline.
#  - app shell (index.html with all AIP data inlined, manifest, icons): cache per build, network first with a
#    3 s timeout so a weak signal in flight doesn't stall start-up
#  - SRTM terrain tiles: all precached at install into a cache that survives app updates, then cache first
#  - Google Fonts: cached on first use (system fonts are used until then)
SW=r"""const C='radio-au-__VER__', T='radio-au-terrain', F='radio-au-fonts';
const CORE=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
const timed=(req,ms)=>new Promise((res,rej)=>{const t=setTimeout(()=>rej(new Error('timeout')),ms); fetch(req).then(r=>{clearTimeout(t);res(r)},e=>{clearTimeout(t);rej(e)})});
async function precacheTerrain(){
  const c=await caches.open(T);
  try{ const r=await fetch('terrain/index.json',{cache:'no-cache'}); if(!r.ok) return;
    await c.put('terrain/index.json',r.clone()); const idx=await r.json(), have=new Set((await c.keys()).map(k=>new URL(k.url).pathname.split('/').pop()));
    await Promise.allSettled((idx.tiles||[]).filter(n=>!have.has(n+'.bin.z')).map(n=>c.add('terrain/'+n+'.bin.z')));
  }catch(e){}
}
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(CORE)).then(precacheTerrain).then(()=>self.skipWaiting()))});
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
"""
here=os.path.dirname(os.path.abspath(__file__)); out=os.path.join(here,'dist'); os.makedirs(out,exist_ok=True)
data=open(os.path.join(here,'data.json')).read()
html=open(os.path.join(here,'template.html')).read().replace('/*__DATA__*/null',data)
open(os.path.join(out,'index.html'),'w').write(html)
ver=hashlib.sha1((html+SW).encode()).hexdigest()[:10]
open(os.path.join(out,'sw.js'),'w').write(SW.replace('__VER__',ver))
json.dump({"name":"Radio Calls AU","short_name":"Radio AU","start_url":"./","display":"standalone","orientation":"portrait",
  "background_color":"#0d1417","theme_color":"#0d1417",
  "icons":[{"src":"icon-192.png","sizes":"192x192","type":"image/png"},{"src":"icon-512.png","sizes":"512x512","type":"image/png","purpose":"any maskable"}]},
  open(os.path.join(out,'manifest.webmanifest'),'w'))
for sz in (192,512):
    im=Image.new('RGB',(sz,sz),'#0d1417'); d=ImageDraw.Draw(im); s=sz/512
    d.ellipse([96*s,96*s,416*s,416*s],outline='#5fe0a8',width=int(18*s))
    d.polygon([(256*s,120*s),(330*s,370*s),(256*s,325*s),(182*s,370*s)],fill='#ffad4d')
    im.save(os.path.join(out,f'icon-{sz}.png'))
print('ok',ver,os.path.getsize(os.path.join(out,'index.html')))
