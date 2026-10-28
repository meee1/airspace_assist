// Local test: the real worker.js on http://localhost:8812 with a fake ADS-B feed behind it (no network)
import http from 'node:http';
// fake ADS-B around Barwon Heads: one converging (TA), one proximate, one far, and the ownship (VH-EAN)
const T0=Date.now(), mv=(la,lo,trk,gs)=>{ const s=(Date.now()-T0)/3600e3*gs/60; return [la+s*Math.cos(trk*Math.PI/180), lo+s*Math.sin(trk*Math.PI/180)/Math.cos(la*Math.PI/180)]; };
const ADSB=()=>{ const own=globalThis.OWN||[-38.2581,144.4275];
  const a=mv(own[0]+0.03,own[1]-0.01,180,90), b=mv(own[0]-0.05,own[1]+0.08,300,110), c=mv(own[0]+0.25,own[1]+0.2,45,140);
  return {ac:[{hex:'7c1234',flight:'VOZ123 ',r:'VH-VOZ',t:'C172',lat:a[0],lon:a[1],alt_baro:1700,alt_geom:1820,gs:90,track:180,baro_rate:-500,category:'A1',seen_pos:1.2},
    {hex:'7c2222',flight:'HEL2',r:'VH-HLX',t:'B06',lat:b[0],lon:b[1],alt_baro:2400,alt_geom:2520,gs:110,track:300,baro_rate:0,category:'A7',seen_pos:0.5},
    {hex:'7c3333',flight:'QFA401',r:'VH-XZA',t:'A333',lat:c[0],lon:c[1],alt_baro:8000,alt_geom:8150,gs:250,track:45,baro_rate:1500,category:'A5',seen_pos:0.8},
    {hex:'7c0ea0',flight:'',r:'VH-EAN',t:'B06',lat:own[0],lon:own[1],alt_baro:1500,alt_geom:1600,gs:100,track:45,category:'A7',seen_pos:0.3}]}; };
globalThis.fetch=async(u,o={})=>{ u=String(u);
  if(u.includes('adsb.lol')||u.includes('adsb.fi')){ const m=/point\/(-?[\d.]+)\/(-?[\d.]+)/.exec(u); if(!globalThis.OWN) globalThis.OWN=[+m[1],+m[2]]; return new Response(JSON.stringify(ADSB())); }
  return new Response('not found',{status:404}); };
const store=new Map(); globalThis.caches={default:{match:async k=>store.get(k.url)?.clone(), put:async(k,r)=>{ store.set(k.url,r); }}};
const W=(await import('./worker.js')).default, env={ALLOW_ORIGIN:'http://localhost:8811'};
http.createServer(async(req,res)=>{ const r=await W.fetch(new Request('http://localhost:8812'+req.url,{method:req.method,headers:req.headers}),env,{waitUntil:()=>{}});
  res.writeHead(r.status,Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer())); }).listen(8812,()=>console.log('mock traffic proxy on :8812'));
