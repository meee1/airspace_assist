// Local test: the real worker.js on http://localhost:8812 with a fake NMS behind it (no network, no credentials)
import http from 'node:http';
const now=Date.now(), d=h=>new Date(now+h*3600e3).toISOString();
const feat=o=>({type:'Feature',properties:{coreNOTAMData:{notam:o,notamTranslation:o.icao?[{type:'ICAO',formattedText:o.icao}]:[]}}});
const AREA=[
  feat({number:'C4321/26',series:'C',affectedFIR:'YMMM',selectionCode:'QRRCA',minimumFL:'000',maximumFL:'045',icaoLocation:'YMMM',effectiveStart:d(-2),effectiveEnd:d(6),text:'R330A ACT',coordinates:'3754S14445E',radius:'004'}),
  feat({number:'C4400/26',series:'C',affectedFIR:'YMMM',selectionCode:'QWPLW',minimumFL:'000',maximumFL:'140',icaoLocation:'YMMM',effectiveStart:d(-1),effectiveEnd:d(5),text:'PJE WILL TAKE PLACE WI 3NM OF TOOLERN VALE',coordinates:'3736S14436E',radius:'003'}),
  feat({number:'C4410/26',series:'C',affectedFIR:'YMMM',selectionCode:'QWULW',minimumFL:'000',maximumFL:'004',icaoLocation:'YMMM',effectiveStart:d(-1),effectiveEnd:d(3),text:'UA OPS (DRONE) WI 2NM OF BARWON HEADS SFC TO 400FT AGL',coordinates:'3817S14428E',radius:'002'}),
  feat({number:'C4500/26',series:'C',affectedFIR:'YMMM',selectionCode:'QOBCE',minimumFL:'000',maximumFL:'005',icaoLocation:'YMMM',effectiveStart:d(-30),effectiveEnd:d(-1),text:'EXPIRED CRANE',coordinates:'3810S14422E',radius:'001'}),
];
const LOC={
  YMMB:[feat({icao:'C1234/26 NOTAMN\nQ) YMMM/QMRLC/IV/NBO/A/000/999/3759S14506E005\nA) YMMB B) 2610280000 C) 2611302359 EST\nE) RWY 17L/35R CLSD DUE WIP'}),
        feat({number:'C1240/26',series:'C',icaoLocation:'YMMB',effectiveStart:d(-100),effectiveEnd:'PERM',text:'TWR FREQ 118.1 U/S. USE 123.0'}),
        feat({number:'C1250/26',series:'C',icaoLocation:'YMMB',effectiveStart:d(10),effectiveEnd:d(14),text:'ATIS NOT AVBL'})],
  YBRS:[feat({number:'C2001/26',series:'C',icaoLocation:'YBRS',effectiveStart:d(-5),effectiveEnd:d(48),text:'RWY 18/36 LGT U/S'})],
};
// fake ADS-B around Barwon Heads: one converging (TA), one proximate, one far, and the ownship (VH-EAN)
const T0=Date.now(), mv=(la,lo,trk,gs)=>{ const s=(Date.now()-T0)/3600e3*gs/60; return [la+s*Math.cos(trk*Math.PI/180), lo+s*Math.sin(trk*Math.PI/180)/Math.cos(la*Math.PI/180)]; };
const ADSB=()=>{ const own=globalThis.OWN||[-38.2581,144.4275];
  const a=mv(own[0]+0.03,own[1]-0.01,180,90), b=mv(own[0]-0.05,own[1]+0.08,300,110), c=mv(own[0]+0.25,own[1]+0.2,45,140);
  return {ac:[{hex:'7c1234',flight:'VOZ123 ',r:'VH-VOZ',t:'C172',lat:a[0],lon:a[1],alt_baro:1700,alt_geom:1820,gs:90,track:180,baro_rate:-500,category:'A1',seen_pos:1.2},
    {hex:'7c2222',flight:'HEL2',r:'VH-HLX',t:'B06',lat:b[0],lon:b[1],alt_baro:2400,alt_geom:2520,gs:110,track:300,baro_rate:0,category:'A7',seen_pos:0.5},
    {hex:'7c3333',flight:'QFA401',r:'VH-XZA',t:'A333',lat:c[0],lon:c[1],alt_baro:8000,alt_geom:8150,gs:250,track:45,baro_rate:1500,category:'A5',seen_pos:0.8},
    {hex:'7c0ea0',flight:'',r:'VH-EAN',t:'B06',lat:own[0],lon:own[1],alt_baro:1500,alt_geom:1600,gs:100,track:45,category:'A7',seen_pos:0.3}]}; };
globalThis.fetch=async(u,o={})=>{ u=String(u);
  if(u.includes('airplanes.live')){ const m=/point\/(-?[\d.]+)\/(-?[\d.]+)/.exec(u); if(!globalThis.OWN) globalThis.OWN=[+m[1],+m[2]]; return new Response(JSON.stringify(ADSB())); }
  if(u.includes('/auth/token')) return new Response(JSON.stringify({access_token:'tok',expires_in:1800}));
  const q=new URL(u).searchParams; const list=q.get('location')? (LOC[q.get('location')]||[]) : AREA;
  return new Response(JSON.stringify({status:'Success',data:{geojson:list}})); };
const store=new Map(); globalThis.caches={default:{match:async k=>store.get(k.url)?.clone(), put:async(k,r)=>{ store.set(k.url,r); }}};
const W=(await import('./worker.js')).default, env={NMS_CLIENT_ID:'a',NMS_CLIENT_SECRET:'b',ALLOW_ORIGIN:'http://localhost:8811'};
http.createServer(async(req,res)=>{ const r=await W.fetch(new Request('http://localhost:8812'+req.url,{method:req.method,headers:req.headers}),env,{waitUntil:()=>{}});
  res.writeHead(r.status,Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer())); }).listen(8812,()=>console.log('mock NOTAM proxy on :8812'));
