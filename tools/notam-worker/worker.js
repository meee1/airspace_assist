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
   Variables and Secrets, type Secret); optional ADSB_URL with optional secret ADSB_KEY (sent as the api-auth header).

   GET /tile/{src}/{z}/{y}/{x}   Esri satellite imagery for the app's Sat layer, with the key kept here (secret ESRI_KEY)
     src wi: World Imagery raster tiles (256 px, z 3-19); st: static basemap tiles arcgis/imagery/labels (512 px, z 2-20).
     Only for the app (Origin or Referer in ALLOW_ORIGIN) and only tiles touching Australia (lat -46..-8, lon 108..160),
     so the proxy can't be used to spend the Esri allowance elsewhere. Cached at Cloudflare's edge for 90 days (the key
     isn't part of the cache key), and sent with Cache-Control so the app's service worker keeps it for offline use.

   POST /naips  {u, p, areas:['9300',...], met:true, validity:12}   (JSON; only from ALLOW_ORIGIN)
     The pilot's own NAIPS area briefing: logs into the NAIPS website with the username and password the app sends
     (kept encrypted on the pilot's device; nothing is stored or logged here), posts the area briefing form the app's
     "Brief in NAIPS" button uses (BriefingArea1-5, Notam, Met, Validity), logs off, and returns {text, t} with the
     briefing as plain text. On failure {error, stage, detail} with the page title / form field names found (never
     values) so a change to the NAIPS site can be diagnosed. Unofficial: NAIPS's own machine access is Airservices'
     Dynamic Data service; the website can change, and its bot protection may refuse requests from here.

   GET  /gauth                       -> {client_id}   the Google OAuth client ID the app signs in with (not a secret)
   POST /gauth {code}                -> {access_token, expires_in, refresh_token}   after the app's Google sign-in pop-up
   POST /gauth {refresh_token}       -> {access_token, expires_in}                  a fresh 1-hour token, no pop-up
     Google Drive for the app's flight logs (scope drive.file: only files the app made). The client secret stays here
     (secrets GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, a "Web application" OAuth client with https://meee1.github.io as
     an authorised JavaScript origin); the refresh token is kept encrypted on the pilot's device and sent only to swap it
     for an access token. Nothing is stored or logged here. Only from ALLOW_ORIGIN. */
const cors=(req,env)=>{ const o=req.headers.get('Origin')||'', ok=(env.ALLOW_ORIGIN||'').split(',').map(s=>s.trim()).filter(Boolean);
  return {'Access-Control-Allow-Origin': ok.includes(o)? o : ok[0]||'*', 'Access-Control-Allow-Methods':'GET, POST, OPTIONS', 'Access-Control-Allow-Headers':'Content-Type', 'Vary':'Origin'}; };
const json=(o,status,h)=>new Response(JSON.stringify(o),{status,headers:{'Content-Type':'application/json',...h}});

export default {
  async fetch(req,env,ctx){
    const H=cors(req,env);
    if(req.method==='OPTIONS') return new Response(null,{headers:{...H,'Access-Control-Max-Age':'86400'}});
    const u=new URL(req.url);
    if(u.pathname==='/traffic') return traffic(u,env,ctx,H);
    if(u.pathname.startsWith('/tile/')) return tile(req,u,env,ctx,H);
    if(u.pathname==='/naips') return naips(req,env,ctx,H);
    if(u.pathname==='/gauth') return gauth(req,env,H);
    return json({error:'use /traffic?lat=&lon=&nm=, /tile/{wi|st}/{z}/{y}/{x}, POST /naips or /gauth'},404,H);
  }
};
async function traffic(u,env,ctx,H){
  const lat=parseFloat(u.searchParams.get('lat')), lon=parseFloat(u.searchParams.get('lon')), nm=Math.min(40,Math.max(1,Math.round(parseFloat(u.searchParams.get('nm'))||25)));
  if(!(Math.abs(lat)<=90&&Math.abs(lon)<=180)) return json({error:'give lat/lon'},400,H);
  const la=lat.toFixed(2), lo=lon.toFixed(2);   // ~0.6 NM: nearby callers share an answer
  const dbg=u.searchParams.has('debug');   // ?debug=1: skip the cache, so every feed is asked now
  const key=new Request(`https://adsb.cache/v1?${la},${lo},${nm}`), cache=caches.default, hit=dbg? null : await cache.match(key);
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
  if(!j) return json({error:'ADS-B feed unavailable',keyed:!!env.ADSBLOL_KEY,errors:errs},502,H);
  const num=v=>typeof v==='number'&&isFinite(v)? v : null;
  const out=(j.ac||j.aircraft||[]).filter(a=>num(a.lat)!=null&&num(a.lon)!=null).map(a=>({hex:a.hex||'', flt:(a.flight||'').replace(/@/g,'').trim(), reg:a.r||'', type:a.t||'',
    la:a.lat, lo:a.lon, ab:num(a.alt_baro), gnd:a.alt_baro==='ground'||undefined, ag:num(a.alt_geom), gs:num(a.gs), trk:num(a.track)??num(a.true_heading),
    vs:num(a.baro_rate)??num(a.geom_rate), cat:a.category||'', seen:num(a.seen_pos)??num(a.seen)??0}));
  // keyed: the ADSBLOL_KEY secret is set; skipped: why earlier feeds were passed over (e.g. re-api 401 invalid api key)
  const res=json({src:new URL(url).host,keyed:!!env.ADSBLOL_KEY,skipped:errs,t:new Date().toISOString(),n:out.length,ac:out},200,{...H,'Cache-Control':'public, max-age=3'});
  ctx.waitUntil(cache.put(key,res.clone()));
  return res;
}
const TILE={
  wi:{min:3,max:19,url:(z,y,x)=>`https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`},
  st:{min:2,max:20,url:(z,y,x)=>`https://static-map-tiles-api.arcgis.com/arcgis/rest/services/static-basemap-tiles-service/v1/arcgis/imagery/labels/static/tile/${z}/${y}/${x}`}};
const AU={la0:-46,la1:-8,lo0:108,lo1:160};
const tileLL=(z,y,x)=>{ const n=2**z, lo=v=>v/n*360-180, la=v=>Math.atan(Math.sinh(Math.PI*(1-2*v/n)))*180/Math.PI; return {la0:la(y+1),la1:la(y),lo0:lo(x),lo1:lo(x+1)}; };
async function tile(req,u,env,ctx,H){
  const m=/^\/tile\/(wi|st)\/(\d{1,2})\/(\d{1,7})\/(\d{1,7})$/.exec(u.pathname);
  if(!m) return json({error:'use /tile/{wi|st}/{z}/{y}/{x}'},400,H);
  const [,src,zs,ys,xs]=m, z=+zs, y=+ys, x=+xs, S=TILE[src], n=2**z;
  // only the app may use it: Origin (images loaded with crossorigin) or Referer must be one of ALLOW_ORIGIN
  const ok=(env.ALLOW_ORIGIN||'').split(',').map(s=>s.trim()).filter(Boolean), org=req.headers.get('Origin')||'', ref=req.headers.get('Referer')||'';
  if(ok.length && !ok.includes(org) && !ok.some(o=>ref.startsWith(o+'/')||ref===o)) return json({error:'not allowed'},403,H);
  if(z<S.min||z>S.max||y>=n||x>=n) return json({error:'zoom or tile out of range'},400,H);
  const b=tileLL(z,y,x);   // a 512-px static tile at level z covers the same box as a 256-px tile at z
  if(b.la1<AU.la0||b.la0>AU.la1||b.lo1<AU.lo0||b.lo0>AU.lo1) return json({error:'outside Australia'},400,H);
  if(!env.ESRI_KEY) return json({error:'proxy has no ESRI_KEY secret'},503,H);
  const key=new Request(`https://esri.cache/${src}/${z}/${y}/${x}`), cache=caches.default, hit=await cache.match(key);
  const out=(r,xc)=>{ const o=new Response(r.body,r); for(const [k,v] of Object.entries(H)) o.headers.set(k,v); o.headers.set('X-Cache',xc); return o; };
  if(hit) return out(hit,'HIT');
  let r; try{ const ac=new AbortController(), tm=setTimeout(()=>ac.abort(),8000);
    r=await fetch(S.url(z,y,x)+'?token='+encodeURIComponent(env.ESRI_KEY),{signal:ac.signal,headers:{'User-Agent':'radio-au-proxy (personal VFR app)'}}).finally(()=>clearTimeout(tm)); }
  catch(e){ return json({error:'Esri '+(e.name==='AbortError'?'timeout':e.message)},502,H); }
  const ct=r.headers.get('content-type')||'';
  if(!r.ok||!/^image\//.test(ct)){ const t=(await r.text()).slice(0,160); return json({error:`Esri ${r.status}`,detail:t},r.ok?502:r.status,H); }   // Esri errors come back as JSON with 200 sometimes
  const res=new Response(r.body,{status:200,headers:{'Content-Type':ct,'Cache-Control':'public, max-age=7776000, immutable'}});
  ctx.waitUntil(cache.put(key,res.clone()));
  return out(res,'MISS');
}

// ---------- NAIPS area briefing with the pilot's own login ----------
const NB='https://www.airservicesaustralia.com/naips';
const NB_UA='Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
const decodeHtml=t=>t.replace(/&nbsp;/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;|&#x27;/g,"'").replace(/&#(\d+);/g,(m,n)=>String.fromCharCode(+n)).replace(/&amp;/g,'&');
const pageTitle=h=>decodeHtml(((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(h)||[])[1]||'').trim());
// the forms on a page: action and inputs (hidden values kept; others by name only)
function pageForms(h){ const out=[];
  for(const m of h.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)){ const at=m[1], body=m[2], attr=(a,n)=>((new RegExp('\\b'+n+'\\s*=\\s*["\']([^"\']*)["\']','i')).exec(a)||[])[1];
    const inputs=[...body.matchAll(/<(input|select|textarea)\b([^>]*)>/gi)].map(x=>({tag:x[1].toLowerCase(),type:(attr(x[2],'type')||'').toLowerCase(),name:attr(x[2],'name')||'',value:decodeHtml(attr(x[2],'value')||'')})).filter(i=>i.name);
    out.push({id:attr(at,'id')||'',action:decodeHtml(attr(at,'action')||''),inputs}); }
  return out; }
const formShape=h=>pageForms(h).map(f=>`${f.id||'form'}→${f.action}: ${f.inputs.map(i=>i.name+(i.type?':'+i.type:'')).join(', ')}`).join(' | ').slice(0,600);
// the briefing text: the biggest <pre>, else the page text with line breaks kept
function briefText(h){ const pres=[...h.matchAll(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi)].map(m=>m[1]).sort((a,b)=>b.length-a.length);
  const raw= pres.length? pres[0] : (/<body\b[^>]*>([\s\S]*)<\/body>/i.exec(h)||[,h])[1].replace(/<(script|style)\b[\s\S]*?<\/\1>/gi,'').replace(/<br\s*\/?>/gi,'\n').replace(/<\/(p|div|tr|li|h\d)>/gi,'\n');
  return decodeHtml(raw.replace(/<[^>]+>/g,'')).replace(/\r/g,'').replace(/[ \t]+$/gm,'').replace(/\n{3,}/g,'\n\n').trim(); }
async function naips(req,env,ctx,H){
  const ok=(env.ALLOW_ORIGIN||'').split(',').map(s=>s.trim()).filter(Boolean), org=req.headers.get('Origin')||'';
  if(req.method!=='POST') return json({error:'POST {u, p, areas}'},405,H);
  if(ok.length&&!ok.includes(org)) return json({error:'not allowed'},403,H);   // only the app: this isn't a public NAIPS relay
  let b; try{ b=await req.json(); }catch(e){ return json({error:'bad JSON'},400,H); }
  const user=String(b.u||''), pass=String(b.p||''), areas=(Array.isArray(b.areas)?b.areas:[]).map(String).filter(a=>/^\d{3,4}$/.test(a)).slice(0,5);
  if(!/^[a-zA-Z0-9][a-zA-Z0-9_.\-]{0,19}$/.test(user)||pass.length<4||pass.length>64) return json({error:'NAIPS username or password missing or not valid'},400,H);
  if(!areas.length) return json({error:'give 1-5 NAIPS area numbers, e.g. 9300'},400,H);
  const jar=new Map(), cookie=()=>[...jar].map(([k,v])=>k+'='+v).join('; ');
  const take=r=>{ const sc= r.headers.getSetCookie? r.headers.getSetCookie() : (r.headers.get('set-cookie')||'').split(/,(?=\s*[A-Za-z0-9_.-]+=)/);
    for(const c of sc){ const m=/^\s*([^=;\s]+)=([^;]*)/.exec(c||''); if(m) jar.set(m[1],m[2]); } };
  const go=async(url,opt={},hops=0)=>{ const ac=new AbortController(), tm=setTimeout(()=>ac.abort(),15000);
    let r; try{ r=await fetch(url,{...opt,redirect:'manual',signal:ac.signal,headers:{'User-Agent':NB_UA,'Accept':'text/html,application/xhtml+xml','Accept-Language':'en-AU,en;q=0.9',...(jar.size?{Cookie:cookie()}:{}),...(opt.headers||{})}}); }
    finally{ clearTimeout(tm); }
    take(r);
    if(r.status>=300&&r.status<400&&r.headers.get('location')&&hops<6) return go(new URL(r.headers.get('location'),url).toString(),{headers:{Referer:url}},hops+1);
    return {status:r.status, url, html:await r.text()}; };
  const blocked=h=>/Request Rejected|support ID is|TSPD|bobcmn|window\["bobcmn"\]/i.test(h);
  const fail=(stage,p,msg)=>json({error:msg||`NAIPS ${stage} didn't work`, stage, detail:p? {status:p.status, title:pageTitle(p.html), forms:formShape(p.html)} : null},502,H);
  const form=(f,extra)=>{ const q=new URLSearchParams(); for(const i of f? f.inputs:[]) if(i.type==='hidden') q.append(i.name,i.value); for(const [k,v] of extra) q.append(k,v); return q; };
  try{
    // 1. login page (cookies, any anti-forgery token), 2. log in
    const lp=await go(NB+'/Account/LogOn'); if(blocked(lp.html)) return fail('login page',lp,"NAIPS's bot protection refused the request from the Worker");
    const lf=pageForms(lp.html).find(f=>/LogOn/i.test(f.action)||f.id==='frmLogon');
    if(!lf) return fail('login page',lp,'NAIPS login form not found');
    const li=await go(new URL(lf.action||'/naips/Account/LogOn',NB+'/').toString(),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Origin:'https://www.airservicesaustralia.com',Referer:NB+'/Account/LogOn'},body:form(lf,[['UserName',user],['Password',pass]]).toString()});
    if(blocked(li.html)) return fail('login',li,"NAIPS's bot protection refused the login from the Worker");
    if(/id=["']frmLogon["']/i.test(li.html)){ const box=/validation-summary-errors[^>]*>([\s\S]*?)<\/(?:div|ul)>/i.exec(li.html), m=(box&&/<li>([\s\S]*?)<\/li>/i.exec(box[1]))||/field-validation-error[^>]*>([^<]+)</i.exec(li.html);   // only inside the error box (the page footer has list items too)
      return json({error:'NAIPS login failed'+(m?': '+decodeHtml(m[1].replace(/<[^>]+>/g,'')).trim():' (check the username and password)'), stage:'login'},401,H); }
    // 3. the area briefing form (for any hidden fields), 4. request the briefing as the app's button does
    const ap=await go(NB+'/Briefing/Area'); const af=pageForms(ap.html).find(f=>/Briefing\/Area/i.test(f.action)||f.inputs.some(i=>/^BriefingArea1$/i.test(i.name)));
    const met=b.met!==false, val=[6,12,18,24].includes(+b.validity)? String(+b.validity) : '12';
    const fields=[]; for(let k=1;k<=5;k++) fields.push(['BriefingArea'+k,areas[k-1]||'']);
    fields.push(['Met',met?'true':'false']); if(met) fields.push(['Met','false']); fields.push(['Notam','true'],['Notam','false'],['HeadOfficeNotam','false'],['Charts','false'],['MidSigwxGpwt','false'],['GPWTRegionalCharts','false'],['ChartVariant','HI'],['GPWTNationalCharts','false'],['Validity',val]);
    const br=await go(new URL(af&&af.action||'/naips/Briefing/Area',NB+'/').toString(),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Origin:'https://www.airservicesaustralia.com',Referer:NB+'/Briefing/Area'},body:form(af,fields).toString()});
    ctx.waitUntil(go(NB+'/Account/LogOff').catch(()=>{}));   // best effort, after the answer
    if(blocked(br.html)) return fail('briefing',br,"NAIPS's bot protection refused the briefing request");
    const text=briefText(br.html);
    if(!/\d{4} UTC \d{2}\/\d{2}\/\d{2}/.test(text)) return fail('briefing',br,"NAIPS didn't return a briefing (the page may have changed)");
    return json({text, t:new Date().toISOString(), areas},200,{...H,'Cache-Control':'no-store'});
  }catch(e){ return json({error:'NAIPS '+(e.name==='AbortError'?'timed out':'unreachable: '+e.message)},502,H); }
}

// ---------- Google sign-in for Drive: the code / refresh-token swap needs the client secret, so it happens here ----------
async function gauth(req,env,H){
  const ok=(env.ALLOW_ORIGIN||'').split(',').map(s=>s.trim()).filter(Boolean), org=req.headers.get('Origin')||'';
  if(ok.length&&!ok.includes(org)) return json({error:'not allowed'},403,H);
  if(!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET) return json({error:"Google Drive isn't set up on the proxy (secrets GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)"},501,H);
  if(req.method==='GET') return json({client_id:env.GOOGLE_CLIENT_ID},200,H);
  if(req.method!=='POST') return json({error:'GET, or POST {code} / {refresh_token}'},405,H);
  let b; try{ b=await req.json(); }catch(e){ return json({error:'bad JSON'},400,H); }
  const base={client_id:env.GOOGLE_CLIENT_ID, client_secret:env.GOOGLE_CLIENT_SECRET};
  const body= b.code? {...base, code:String(b.code), redirect_uri:'postmessage', grant_type:'authorization_code'}
            : b.refresh_token? {...base, refresh_token:String(b.refresh_token), grant_type:'refresh_token'} : null;
  if(!body) return json({error:'give code or refresh_token'},400,H);
  let r, j;
  try{ r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body)}); j=await r.json(); }
  catch(e){ return json({error:'Google token service: '+e.message},502,H); }
  if(!r.ok||!j.access_token) return json({error:j.error_description||j.error||('Google token service '+r.status), reauth:j.error==='invalid_grant'},r.status>=400&&r.status<500?400:502,H);
  return json({access_token:j.access_token, expires_in:j.expires_in||3600, ...(j.refresh_token?{refresh_token:j.refresh_token}:{})},200,{...H,'Cache-Control':'no-store'});
}
