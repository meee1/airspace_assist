/* ADS-B traffic proxy for Radio Calls AU (Cloudflare Worker).
   The app (a static page on GitHub Pages) can't call the ADS-B feeds itself: they send no CORS headers. This Worker
   asks the feed and returns a small JSON list with CORS for the app's origin. (It used to proxy FAA NOTAMs too; those
   were removed 29 Oct 2026: NOTAMs now come only from a NAIPS briefing the pilot loads into the app.)

   GET /traffic?lat=-38.25&lon=144.43&nm=25
     ADS-B traffic within nm (max 40) from adsb.lol (ODbL; with the ADSBLOL_KEY secret its keyed re-api first),
     falling back to adsb.fi, or, with ADSB_URL/ADSB_KEY set, another readsb-style feed. (airplanes.live's API now answers 403 "please contact us"
     unless they have approved the project.)
   -> {src, t, n, ac:[{hex, flt, reg, type, la, lo, ab, gnd, ag, gs, trk, vs, cat, seen}]}  ab = baro alt ft (null on the
      ground, gnd:true), ag = geometric (GNSS, WGS84 ellipsoid) alt ft, seen = age of the position in s. Cached 3 s.
   On failure -> 502 {error, errors:[per-feed status]}.

   Vars (wrangler.toml or the dashboard): ALLOW_ORIGIN = "https://meee1.github.io,http://localhost:8811",
   optional secret ADSBLOL_KEY (adsb.lol API key: npx wrangler secret put ADSBLOL_KEY, or the dashboard → Settings →
   Variables and Secrets, type Secret); optional ADSB_URL with optional secret ADSB_KEY (sent as the api-auth header). */
const cors=(req,env)=>{ const o=req.headers.get('Origin')||'', ok=(env.ALLOW_ORIGIN||'').split(',').map(s=>s.trim()).filter(Boolean);
  return {'Access-Control-Allow-Origin': ok.includes(o)? o : ok[0]||'*', 'Access-Control-Allow-Methods':'GET, OPTIONS', 'Vary':'Origin'}; };
const json=(o,status,h)=>new Response(JSON.stringify(o),{status,headers:{'Content-Type':'application/json',...h}});

export default {
  async fetch(req,env,ctx){
    const H=cors(req,env);
    if(req.method==='OPTIONS') return new Response(null,{headers:{...H,'Access-Control-Max-Age':'86400'}});
    const u=new URL(req.url);
    if(u.pathname==='/traffic') return traffic(u,env,ctx,H);
    return json({error:'use /traffic?lat=&lon=&nm='},404,H);
  }
};
async function traffic(u,env,ctx,H){
  const lat=parseFloat(u.searchParams.get('lat')), lon=parseFloat(u.searchParams.get('lon')), nm=Math.min(40,Math.max(1,Math.round(parseFloat(u.searchParams.get('nm'))||25)));
  if(!(Math.abs(lat)<=90&&Math.abs(lon)<=180)) return json({error:'give lat/lon'},400,H);
  const la=lat.toFixed(2), lo=lon.toFixed(2);   // ~0.6 NM: nearby callers share an answer
  const key=new Request(`https://adsb.cache/v1?${la},${lo},${nm}`), cache=caches.default, hit=await cache.match(key);
  if(hit){ const r=new Response(hit.body,hit); for(const [k,v] of Object.entries(H)) r.headers.set(k,v); r.headers.set('X-Cache','HIT'); return r; }
  // feeds in order, each [url template, extra headers]. With the ADSBLOL_KEY secret: adsb.lol's keyed re-api first
  // (x-api-key header), then its public v2 API WITHOUT the key (a key bound to another address makes it answer 401
  // "api key bound to a different address" even though the public API needs none), then adsb.fi.
  // ADSB_URL (+ ADSB_KEY as api-auth) replaces the list.
  const UA={Accept:'application/json','User-Agent':'radio-au-proxy (personal VFR app)'}, LK=env.ADSBLOL_KEY? {'x-api-key':env.ADSBLOL_KEY} : {};
  const feeds=env.ADSB_URL? [[env.ADSB_URL, env.ADSB_KEY?{'api-auth':env.ADSB_KEY}:{}]] : [
    ...(env.ADSBLOL_KEY? [['https://re-api.adsb.lol/?circle={lat},{lon},{nm}',LK]] : []),
    ['https://api.adsb.lol/v2/point/{lat}/{lon}/{nm}',{}],
    ['https://opendata.adsb.fi/api/v2/lat/{lat}/lon/{lon}/dist/{nm}',{}]];
  let j=null, url='', errs=[];
  for(const [tpl,hd] of feeds){ url=tpl.replace('{lat}',la).replace('{lon}',lo).replace('{nm}',nm); const host=new URL(url).host;
    try{ const ac=new AbortController(), tm=setTimeout(()=>ac.abort(),5000);
      const r=await fetch(url,{signal:ac.signal,headers:{...UA,...hd}}).finally(()=>clearTimeout(tm));
      if(!r.ok){ errs.push(`${host} ${r.status}: ${(await r.text()).slice(0,120)}`); continue; }
      j=await r.json(); break; }
    catch(e){ errs.push(`${host}: ${e.name==='AbortError'?'timeout':e.message}`); } }
  if(!j) return json({error:'ADS-B feed unavailable',errors:errs},502,H);
  const num=v=>typeof v==='number'&&isFinite(v)? v : null;
  const out=(j.ac||j.aircraft||[]).filter(a=>num(a.lat)!=null&&num(a.lon)!=null).map(a=>({hex:a.hex||'', flt:(a.flight||'').trim(), reg:a.r||'', type:a.t||'',
    la:a.lat, lo:a.lon, ab:num(a.alt_baro), gnd:a.alt_baro==='ground'||undefined, ag:num(a.alt_geom), gs:num(a.gs), trk:num(a.track)??num(a.true_heading),
    vs:num(a.baro_rate)??num(a.geom_rate), cat:a.category||'', seen:num(a.seen_pos)??num(a.seen)??0}));
  const res=json({src:new URL(url).host,t:new Date().toISOString(),n:out.length,ac:out},200,{...H,'Cache-Control':'public, max-age=3'});
  ctx.waitUntil(cache.put(key,res.clone()));
  return res;
}
