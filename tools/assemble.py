import json, os, sys, hashlib
from PIL import Image, ImageDraw, ImageFont
here=os.path.dirname(os.path.abspath(__file__)); out=os.path.join(here,'dist'); os.makedirs(out,exist_ok=True)
data=open(os.path.join(here,'data.json')).read()
html=open(os.path.join(here,'template.html')).read().replace('/*__DATA__*/null',data)
open(os.path.join(out,'index.html'),'w').write(html)
ver=hashlib.sha1(html.encode()).hexdigest()[:10]
open(os.path.join(out,'sw.js'),'w').write(f"""const C='radio-au-{ver}';
const CORE=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>{{e.waitUntil(caches.open(C).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()))}});
self.addEventListener('activate',e=>{{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))}});
self.addEventListener('fetch',e=>{{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET') return;
  if(u.origin===location.origin){{ // network first for the page so AIRAC updates land, cache fallback offline
    e.respondWith(fetch(e.request).then(r=>{{const cp=r.clone(); caches.open(C).then(c=>c.put(e.request,cp)); return r}}).catch(()=>caches.match(e.request,{{ignoreSearch:true}}).then(r=>r||caches.match('./index.html'))));
  }} else if(/fonts\\.(googleapis|gstatic)\\.com/.test(u.host)){{
    e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(n=>{{const cp=n.clone(); caches.open(C).then(c=>c.put(e.request,cp)); return n}})));
  }}
}});
""")
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
