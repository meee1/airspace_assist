// node test.mjs : the Worker against a fake NMS (no network)
const calls=[];
const feat=(o)=>({type:'Feature',geometry:null,properties:{coreNOTAMData:{notam:o,notamTranslation:o.icao?[{type:'ICAO',formattedText:o.icao}]:[]}}});
const DB={
  area:[feat({id:'1',series:'C',number:'C4321/26',type:'N',issued:'2026-10-27T03:00:00.000Z',affectedFIR:'YMMM',selectionCode:'QRRCA',minimumFL:'000',maximumFL:'045',location:'YMMM',icaoLocation:'YMMM',effectiveStart:'2026-10-28T00:00:00.000Z',effectiveEnd:'2026-10-29T08:00:00.000Z',text:'R330A ACT',coordinates:'3754S14445E',radius:'005',classification:'INTERNATIONAL'}),
        feat({id:'2',icao:'C1234/26 NOTAMN\nQ) YMMM/QMRLC/IV/NBO/A/000/999/3759S14506E005\nA) YMMB B) 2610280000 C) 2610302359 EST\nE) RWY 17L/35R CLSD'})],
  YMMB:[feat({id:'2',icao:'C1234/26 NOTAMN\nQ) YMMM/QMRLC/IV/NBO/A/000/999/3759S14506E005\nA) YMMB B) 2610280000 C) 2610302359 EST\nE) RWY 17L/35R CLSD'}),
        feat({id:'3',number:'C1240/26',series:'C',icaoLocation:'YMMB',effectiveStart:'2026-10-20T00:00:00Z',effectiveEnd:'PERM',text:'TWR FREQ 118.1 U/S, USE 123.0'})],
};
let tokCalls=0;
globalThis.fetch=async(u,o={})=>{ u=String(u); calls.push(u);
  if(u.includes('/auth/token')){ tokCalls++; return new Response(JSON.stringify({access_token:'tok',expires_in:1800})); }
  const q=new URL(u).searchParams; const hdr=o.headers||{};
  if(hdr.Authorization!=='Bearer tok') return new Response('no',{status:401});
  if(q.get('location')==='YXXX') return new Response('boom',{status:500});
  const list=q.get('location')? (DB[q.get('location')]||[]) : DB.area;
  return new Response(JSON.stringify({status:'Success',data:{geojson:list}})); };
const store=new Map(); globalThis.caches={default:{match:async k=>store.get(k.url)?.clone(), put:async(k,r)=>{ store.set(k.url,r); }}};
const W=(await import('./worker.js')).default, env={NMS_CLIENT_ID:'a',NMS_CLIENT_SECRET:'b',ALLOW_ORIGIN:'https://meee1.github.io,http://localhost:8811'};
const ctx={waitUntil:p=>p};
const go=async(qs,origin='https://meee1.github.io')=>{ const r=await W.fetch(new Request('https://w.dev/notams?'+qs,{headers:{Origin:origin}}),env,ctx); return [r.status,r.headers.get('Access-Control-Allow-Origin'),r.headers.get('X-Cache'),await r.json()]; };
let [s,o,c,j]=await go('lat=-38.25&lon=144.43&nm=50&loc=YMMB,ybrs,YXXX');
console.log(s,o,c,'n',j.n,'errors',j.errors);
for(const it of j.items) console.log(' ',JSON.stringify(it));
[s,o,c,j]=await go('lat=-38.24&lon=144.43&nm=50&loc=YMMB,ybrs,YXXX','http://evil.example'); console.log('2nd',s,o,c,j.n,'token calls',tokCalls);
[s,o,c,j]=await go('foo=1'); console.log('bad',s,j.error);
const pre=await W.fetch(new Request('https://w.dev/notams',{method:'OPTIONS',headers:{Origin:'http://localhost:8811'}}),env,ctx); console.log('preflight',pre.status,pre.headers.get('Access-Control-Allow-Origin'));
