/* NOTAM proxy for Radio Calls AU (Cloudflare Worker).
   The app (a static page on GitHub Pages) can't call a NOTAM service itself: they need credentials and send no CORS
   headers. This Worker holds the credentials, asks the FAA NOTAM Management Service (NMS) API, which carries
   international NOTAMs (Australia's included) from the FAA's international NOTAM system, and returns a small JSON
   list with CORS for the app's origin.

   GET /notams?lat=-38.25&lon=144.43&nm=50&loc=YMMB,YBRS
     lat/lon/nm  NOTAMs within nm (max 100) of the point
     loc         up to 25 ICAO locations (aerodromes on the flight plan, the Go to aerodrome, the FIR e.g. YMMM)
   -> {src, t, n, items:[{id, loc, fir, q, lo, hi, la, lon, r, from, to, est, sch, text, icao}], errors?}
      lo/hi in ft (from the Q-line flight levels), la/lon/r = the Q-line circle (r in NM), from/to ISO or 'PERM'.
   Responses are cached for 10 minutes per query (rounded position) at the edge.

   GET /traffic?lat=-38.25&lon=144.43&nm=25
     ADS-B traffic within nm (max 40) from airplanes.live (free, non-commercial, 1 request/s, no key) or, with
     ADSB_URL/ADSB_KEY set, another readsb-style feed (adsb.lol, adsb.fi).
   -> {src, t, ac:[{hex, flt, reg, type, la, lo, ab, ag, gs, trk, vs, cat, seen}]}  ab = baro alt ft (null on the ground,
      gnd:true), ag = geometric (GNSS, WGS84 ellipsoid) alt ft, seen = age of the position in s. Cached 3 s.

   Secrets (wrangler secret put): NMS_CLIENT_ID, NMS_CLIENT_SECRET   (request from NOTAMS@faa.gov); optional ADSB_KEY
   Vars (wrangler.toml): ALLOW_ORIGIN = "https://meee1.github.io,http://localhost:8811", NMS_ENV = "production" */
const URLS={
  production:{auth:'https://api-nms.aim.faa.gov/v1/auth/token', api:'https://api-nms.aim.faa.gov/nmsapi'},
  staging:{auth:'https://api-staging.cgifederal-aim.com/v1/auth/token', api:'https://api-staging.cgifederal-aim.com/nmsapi'},
};
let TOK=null, TEXP=0, TP=null;   // token survives while the isolate is warm; TP = request in flight (parallel jobs share it)

function token(env){
  if(TOK && Date.now()<TEXP) return Promise.resolve(TOK);
  return TP || (TP=getToken(env).finally(()=>{ TP=null; }));
}
async function getToken(env){
  const U=URLS[env.NMS_ENV||'production'];
  const r=await fetch(U.auth,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',
    Authorization:'Basic '+btoa(`${env.NMS_CLIENT_ID}:${env.NMS_CLIENT_SECRET}`)},body:'grant_type=client_credentials'});
  if(!r.ok) throw new Error(`NMS token ${r.status}`);
  const j=await r.json(); TOK=j.access_token; TEXP=Date.now()+((+j.expires_in||1800)-60)*1000; return TOK;
}
async function nms(env,params){
  const U=URLS[env.NMS_ENV||'production'], u=new URL(U.api+'/v1/notams');
  for(const [k,v] of Object.entries(params)) if(v!=null&&v!=='') u.searchParams.set(k,v);
  let r=await fetch(u,{headers:{Authorization:'Bearer '+await token(env),Accept:'application/json',nmsResponseFormat:'GEOJSON'}});
  if(r.status===401){ TOK=null; r=await fetch(u,{headers:{Authorization:'Bearer '+await token(env),Accept:'application/json',nmsResponseFormat:'GEOJSON'}}); }
  if(!r.ok) throw new Error(`NMS ${r.status} ${JSON.stringify(params)}`);
  const j=await r.json(), d=j.data||j;
  return d.geojson || d.items || (Array.isArray(d)? d : []);
}

// "3758S14506E" -> [-37.967, 145.1]
function coord(s){ const m=/^(\d{2})(\d{2})(\d{2})?([NS])(\d{3})(\d{2})(\d{2})?([EW])$/.exec(String(s||'').trim()); if(!m) return null;
  const la=(+m[1]+ +m[2]/60+(+m[3]||0)/3600)*(m[4]==='S'?-1:1), lo=(+m[5]+ +m[6]/60+(+m[7]||0)/3600)*(m[8]==='W'?-1:1); return [la,lo]; }
// ICAO Q) line: Q) YMMM/QRRCA/IV/BO/W/000/045/3755S14450E005
function qline(t){ const m=/Q\)\s*([A-Z]{4})\/(Q[A-Z]{4})\/[A-Z ]*\/[A-Z ]*\/[A-Z ]*\/(\d{3})\/(\d{3})\/(\d{4}[NS]\d{5}[EW])(\d{3})/.exec(t||''); if(!m) return null;
  const c=coord(m[5]); return {fir:m[1], q:m[2], lo:+m[3]*100, hi:+m[4]*100, la:c&&c[0], lon:c&&c[1], r:+m[6]}; }
// the ICAO text of a NOTAM: "C1234/26 NOTAMN Q) … A) YMMB B) 2610280000 C) 2610302359 EST D) … E) … F) … G) …"
function icaoParts(t){ if(!t) return {}; const f=k=>{ const m=new RegExp(`(?:^|\\s)${k}\\)\\s*([\\s\\S]*?)(?=\\s[A-G]\\)\\s|$)`).exec(t); return m? m[1].trim() : ''; };
  const dt=s=>{ const m=/^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(s||''); return m? `20${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00.000Z` : null; };
  const C=f('C'), id=(/^\s*([A-Z]\d{3,4}\/\d{2})/.exec(t)||[])[1]||'';
  return {id, loc:f('A').split(/\s/)[0], from:dt(f('B')), to:/PERM/.test(C)? 'PERM' : dt(C), est:/EST/.test(C), sch:f('D'), text:f('E')}; }
function iso(v){ if(!v) return null; if(/^PERM/i.test(v)) return 'PERM'; const d=new Date(v); return isNaN(d)? String(v) : d.toISOString(); }

function norm(f){
  const p=(f&&f.properties)||f||{}, core=p.coreNOTAMData||p, n=core.notam||core;
  const tr=(core.notamTranslation||[]).find(x=>/ICAO/i.test(x.type||''))||(core.notamTranslation||[])[0]||{};
  const icao=tr.formattedText||n.icaoMessage||'';
  const Q=qline(icao)||{}, I=icaoParts(icao);
  const c=n.coordinates? coord(n.coordinates) : null;
  const num=n.number||'', ser=n.series||'';
  return {
    id: (num&&!num.startsWith(ser)? ser+num : num) || I.id || n.id || '',
    loc: n.icaoLocation||n.location||I.loc||'',
    fir: n.affectedFIR||Q.fir||'',
    q: n.selectionCode? 'Q'+String(n.selectionCode).replace(/^Q/,'') : Q.q||'',
    lo: n.minimumFL!=null&&n.minimumFL!==''? +n.minimumFL*100 : Q.lo!=null? Q.lo : null,
    hi: n.maximumFL!=null&&n.maximumFL!==''? +n.maximumFL*100 : Q.hi!=null? Q.hi : null,
    la: c? c[0] : Q.la!=null? Q.la : null, lon: c? c[1] : Q.lon!=null? Q.lon : null,
    r: n.radius!=null&&n.radius!==''? +n.radius : Q.r!=null? Q.r : null,
    from: iso(n.effectiveStart)||I.from||null, to: iso(n.effectiveEnd)||I.to||null, est: /EST/i.test(String(n.effectiveEnd||'')+String(n.estimatedEnd||''))||!!I.est,
    sch: n.schedule||I.sch||'', text: n.text||I.text||'', icao,
    cls: n.classification||'',
  };
}

const cors=(req,env)=>{ const o=req.headers.get('Origin')||'', ok=(env.ALLOW_ORIGIN||'').split(',').map(s=>s.trim()).filter(Boolean);
  return {'Access-Control-Allow-Origin': ok.includes(o)? o : ok[0]||'*', 'Access-Control-Allow-Methods':'GET, OPTIONS', 'Vary':'Origin'}; };
const json=(o,status,h)=>new Response(JSON.stringify(o),{status,headers:{'Content-Type':'application/json',...h}});

export default {
  async fetch(req,env,ctx){
    const H=cors(req,env);
    if(req.method==='OPTIONS') return new Response(null,{headers:{...H,'Access-Control-Max-Age':'86400'}});
    const u=new URL(req.url);
    if(u.pathname==='/traffic') return traffic(u,env,ctx,H);
    if(u.pathname!=='/notams') return json({error:'use /notams?lat=&lon=&nm=&loc= or /traffic?lat=&lon=&nm='},404,H);
    const lat=parseFloat(u.searchParams.get('lat')), lon=parseFloat(u.searchParams.get('lon')), nm=Math.min(100,Math.max(1,parseFloat(u.searchParams.get('nm'))||50));
    const locs=[...new Set((u.searchParams.get('loc')||'').toUpperCase().split(',').map(s=>s.trim()).filter(s=>/^[A-Z0-9]{3,4}$/.test(s)))].slice(0,25);
    const area=isFinite(lat)&&isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180;
    if(!area&&!locs.length) return json({error:'give lat/lon or loc'},400,H);
    // edge cache: position rounded to 0.1 deg, so a moving aircraft re-uses nearby answers
    const key=new Request(`https://notam.cache/v1?${area?`a=${lat.toFixed(1)},${lon.toFixed(1)},${Math.round(nm)}`:''}&l=${locs.sort().join(',')}`);
    const cache=caches.default; const hit=await cache.match(key);
    if(hit){ const r=new Response(hit.body,hit); for(const [k,v] of Object.entries(H)) r.headers.set(k,v); r.headers.set('X-Cache','HIT'); return r; }
    const jobs=[], errors=[];
    if(area) jobs.push(nms(env,{latitude:lat.toFixed(4),longitude:lon.toFixed(4),radius:Math.round(nm)}));
    for(const l of locs) jobs.push(nms(env,{location:l}));
    const res=await Promise.allSettled(jobs), seen=new Map();
    for(const r of res){ if(r.status!=='fulfilled'){ errors.push(String(r.reason&&r.reason.message||r.reason)); continue; }
      for(const f of r.value){ const n=norm(f); const k=n.id+'|'+n.loc; if(n.id&&!seen.has(k)) seen.set(k,n); } }
    if(!seen.size&&errors.length===res.length) return json({error:'NOTAM service unavailable',errors},502,H);
    const items=[...seen.values()];
    const out=json({src:'FAA NMS',t:new Date().toISOString(),n:items.length,items,...(errors.length?{errors}:{})},200,{...H,'Cache-Control':'public, max-age=600'});
    ctx.waitUntil(cache.put(key,out.clone()));
    return out;
  }
};
async function traffic(u,env,ctx,H){
  const lat=parseFloat(u.searchParams.get('lat')), lon=parseFloat(u.searchParams.get('lon')), nm=Math.min(40,Math.max(1,Math.round(parseFloat(u.searchParams.get('nm'))||25)));
  if(!(Math.abs(lat)<=90&&Math.abs(lon)<=180)) return json({error:'give lat/lon'},400,H);
  const la=lat.toFixed(2), lo=lon.toFixed(2);   // ~0.6 NM: nearby callers share an answer
  const key=new Request(`https://adsb.cache/v1?${la},${lo},${nm}`), cache=caches.default, hit=await cache.match(key);
  if(hit){ const r=new Response(hit.body,hit); for(const [k,v] of Object.entries(H)) r.headers.set(k,v); r.headers.set('X-Cache','HIT'); return r; }
  const tpl=env.ADSB_URL||'https://api.airplanes.live/v2/point/{lat}/{lon}/{nm}';
  const url=tpl.replace('{lat}',la).replace('{lon}',lo).replace('{nm}',nm);
  let j;
  try{ const ac=new AbortController(), tm=setTimeout(()=>ac.abort(),6000);
    const r=await fetch(url,{signal:ac.signal,headers:{Accept:'application/json','User-Agent':'radio-au-proxy (personal VFR app)',...(env.ADSB_KEY?{'api-auth':env.ADSB_KEY}:{})}}).finally(()=>clearTimeout(tm));
    if(!r.ok) return json({error:`ADS-B feed ${r.status}`},502,H); j=await r.json(); }
  catch(e){ return json({error:'ADS-B feed unavailable'},502,H); }
  const num=v=>typeof v==='number'&&isFinite(v)? v : null;
  const out=(j.ac||j.aircraft||[]).filter(a=>num(a.lat)!=null&&num(a.lon)!=null).map(a=>({hex:a.hex||'', flt:(a.flight||'').trim(), reg:a.r||'', type:a.t||'',
    la:a.lat, lo:a.lon, ab:num(a.alt_baro), gnd:a.alt_baro==='ground'||undefined, ag:num(a.alt_geom), gs:num(a.gs), trk:num(a.track)??num(a.true_heading),
    vs:num(a.baro_rate)??num(a.geom_rate), cat:a.category||'', seen:num(a.seen_pos)??num(a.seen)??0}));
  const res=json({src:env.ADSB_URL?new URL(url).host:'airplanes.live',t:new Date().toISOString(),n:out.length,ac:out},200,{...H,'Cache-Control':'public, max-age=3'});
  ctx.waitUntil(cache.put(key,res.clone()));
  return res;
}
