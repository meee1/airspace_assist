import json, os, sys, hashlib
from PIL import Image, ImageDraw, ImageFont
# Service worker: everything the app needs offline.
#  - app shell (index.html with all AIP data inlined, manifest, icons): cache per build, network first with a
#    3 s timeout so a weak signal in flight doesn't stall start-up
#  - SRTM terrain tiles: all precached at install into a cache that survives app updates, then cache first
#  - Google Fonts: cached on first use (system fonts are used until then)
SW=r"""const C='radio-au-__VER__', T='radio-au-terrain', F='radio-au-fonts', X='radio-au-charts';
const CORE=['./','./index.html','./app.js','./data.json','./urban.json','./manifest.webmanifest','./icon-192.png','./icon-512.png'__NEXT__];
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
"""
here=os.path.dirname(os.path.abspath(__file__)); out=os.path.join(here,'dist'); os.makedirs(out,exist_ok=True)
# Output: index.html (page + small loader), app.js (the app code) and the data:
#   data.json       current AIRAC (tools/data.json)
#   data-next.json  next AIRAC, if tools/data-next.json exists; the app switches to it by itself at its effective time
#   urban.json      ABS urban areas and suburbs {urb, sal}, shared by both
# The loader picks the dataset in force now (AIRAC data takes effect at 1600 UTC the day before the nominated date,
# AIP GEN 3.1 4.3), fetches it and urban.json, then starts app.js. The service worker stores everything for offline use.
import datetime
def eff_ms(meta):
    ds=[datetime.datetime.strptime(meta[k],'%d %b %Y') for k in ('ersa','dah') if meta.get(k)]
    if not ds: return 0
    d=max(ds).replace(tzinfo=datetime.timezone.utc)-datetime.timedelta(hours=8)    # 1600 UTC the day before
    return int(d.timestamp()*1000)
h=lambda t: hashlib.sha1(t.encode()).hexdigest()[:10]
sets=[]; urb=None; sal=None
for name in ('data.json','data-next.json'):
    p=os.path.join(here,name)
    if not os.path.exists(p): continue
    d=json.load(open(p)); u=d.pop('urb',None)
    if u is not None: urb=u
    s_=d.pop('sal',None)
    if s_ is not None: sal=s_
    txt=json.dumps(d,separators=(',',':')); open(os.path.join(out,name),'w').write(txt)
    sets.append([eff_ms(d['meta']), name+'?v='+h(txt), d['meta'].get('ersa','')])
sets.sort()
urbt=json.dumps({'urb':urb or [],'sal':sal or []},separators=(',',':')); open(os.path.join(out,'urban.json'),'w').write(urbt)
data=''.join(s_[1] for s_ in sets)+h(urbt)          # for the build version hash
tpl=open(os.path.join(here,'template.html')).read()
i=tpl.index('<script>\n'); j=tpl.rindex('</script>')
app=tpl[i+len('<script>\n'):j]
assert 'const DATA = /*__DATA__*/null;' in app
import time
gp=os.path.join(here,'egm96_au.json')
app=app.replace('/*__GEOID__*/null', open(gp).read().strip() if os.path.exists(gp) else 'null')   # EGM96 grid for Australia (tools/geoid.py)
app=app.replace('/*__BUILT__*/0', str(int(time.time()*1000)))   # app build time, shown as 'App updated' in the footer
app=app.replace('/*__CHARTS__*/[]', json.dumps(json.load(open(os.path.join(here,'charts.json'))),separators=(',',':')) if os.path.exists(os.path.join(here,'charts.json')) else '[]')
app=app.replace('const DATA = /*__DATA__*/null;','const DATA = window.__DATA;   // loaded from data.json / data-next.json by the loader in index.html')
av=h(app)
LOADER=f"""<script>
// Loader: pick the AIP dataset in force now, fetch it and the urban areas, then start the app (all cached for offline).
if('serviceWorker' in navigator && (location.protocol==='https:'||location.hostname==='localhost')) navigator.serviceWorker.register('sw.js').catch(()=>{{}});
window.__SETS={json.dumps(sets)};   // [effective ms (1600 UTC day before), file, ERSA date]
(async()=>{{
  const now=Date.now(), S=window.__SETS, pick=[...S].reverse().find(s=>s[0]<=now)||S[0];
  try{{ const [r,u]=await Promise.all([fetch(pick[1]), fetch('urban.json?v={h(urbt)}').catch(()=>null)]);
    if(!r.ok) throw new Error('HTTP '+r.status);
    if(!/json/i.test(r.headers.get('content-type')||'')) throw new Error('not JSON (a sign-in page or captive portal?)');
    window.__DATA=await r.json();
    try{{ const x = u&&u.ok ? await u.json() : []; window.__DATA.urb = Array.isArray(x) ? x : x.urb||[]; window.__DATA.sal = Array.isArray(x) ? [] : x.sal||[]; }}catch(e){{ window.__DATA.urb=[]; window.__DATA.sal=[]; }}
    window.__DATA.meta.eff=pick[0]; window.__DATA.meta.next=S.find(s=>s[0]>pick[0])||null; }}
  catch(e){{ const d=document.createElement('div'); d.className='bootErr';
    d.innerHTML='<b>Could not load the aerodrome and airspace data</b> ('+pick[1].split('?')[0]+': '+String(e.message||e).replace(/[<&]/g,'')+'). Open the app once with signal so it can be stored for offline use.';
    document.body.prepend(d); return; }}
  const s=document.createElement('script'); s.src='app.js?v={av}';
  s.onerror=()=>{{ const d=document.createElement('div'); d.className='bootErr'; d.textContent='Could not load the app code (app.js). Open the app once with signal so it can be stored for offline use.'; document.body.prepend(d); }};
  document.body.appendChild(s);
}})();
</script>
"""
html=tpl[:i]+LOADER+tpl[j+len('</script>'):]
open(os.path.join(out,'index.html'),'w').write(html)
open(os.path.join(out,'app.js'),'w').write(app)
nx=os.path.join(out,'data-next.json')
if not any(s_[1].startswith('data-next.json') for s_ in sets) and os.path.exists(nx): os.remove(nx)
ver=h(html+app+data+SW)
open(os.path.join(out,'sw.js'),'w').write(SW.replace('__VER__',ver).replace('__NEXT__',",'./data-next.json'" if len(sets)>1 else ''))
json.dump({"name":"Radio Calls AU","short_name":"Radio AU","start_url":"./","display":"standalone","orientation":"portrait",
  "background_color":"#0d1417","theme_color":"#0d1417",
  "icons":[{"src":"icon-192.png","sizes":"192x192","type":"image/png"},{"src":"icon-512.png","sizes":"512x512","type":"image/png","purpose":"any maskable"}]},
  open(os.path.join(out,'manifest.webmanifest'),'w'))
for sz in (192,512):
    im=Image.new('RGB',(sz,sz),'#0d1417'); d=ImageDraw.Draw(im); s=sz/512
    d.ellipse([96*s,96*s,416*s,416*s],outline='#5fe0a8',width=int(18*s))
    d.polygon([(256*s,120*s),(330*s,370*s),(256*s,325*s),(182*s,370*s)],fill='#ffad4d')
    im.save(os.path.join(out,f'icon-{sz}.png'))
print('ok',ver,{f:os.path.getsize(os.path.join(out,f)) for f in os.listdir(out) if f.endswith(('.html','.js','.json'))}, [(datetime.datetime.utcfromtimestamp(a/1000).isoformat(),b) for a,b,c in sets])
