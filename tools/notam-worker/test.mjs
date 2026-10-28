// node test.mjs : the Worker against fake ADS-B feeds (no network)
const store=new Map(); globalThis.caches={default:{match:async k=>store.get(k.url)?.clone(), put:async(k,r)=>{ store.set(k.url,r); }}};
const W=(await import('./worker.js')).default, env={ALLOW_ORIGIN:'https://meee1.github.io,http://localhost:8811'}, ctx={waitUntil:p=>p};
const go=async(qs,origin='https://meee1.github.io')=>{ const r=await W.fetch(new Request('https://w.dev'+qs,{headers:{Origin:origin}}),env,ctx); return [r.status,r.headers.get('Access-Control-Allow-Origin'),r.headers.get('X-Cache'),await r.json()]; };
const AC={ac:[{hex:'7c1234',flight:'VOZ123 ',r:'VH-VOZ',t:'C172',lat:-38.2,lon:144.4,alt_baro:1700,alt_geom:1820,gs:90,track:180,baro_rate:-500,category:'A1',seen_pos:1.2},
  {hex:'7c9999',r:'VH-GND',lat:-38.1,lon:144.5,alt_baro:'ground',gs:5}]};
globalThis.fetch=async u=>{ u=String(u); if(u.includes('adsb.lol')) return new Response(JSON.stringify(AC)); return new Response('x',{status:500}); };
let [s,o,c,j]=await go('/traffic?lat=-38.25&lon=144.43&nm=25'); console.log('lol',s,o,c,j.src,j.n,JSON.stringify(j.ac[1]));
[s,o,c,j]=await go('/traffic?lat=-38.25&lon=144.43&nm=25','http://evil.example'); console.log('cached',s,o,c);
globalThis.fetch=async u=>{ u=String(u); if(u.includes('adsb.lol')) return new Response('please contact us',{status:403}); return new Response(JSON.stringify({aircraft:AC.ac})); };
[s,o,c,j]=await go('/traffic?lat=-37.5&lon=144.9&nm=25'); console.log('fallback',s,j.src,j.n);
globalThis.fetch=async()=>new Response('nope',{status:403});
[s,o,c,j]=await go('/traffic?lat=-36.5&lon=144.9&nm=25'); console.log('both fail',s,j.error,j.errors);
[s,o,c,j]=await go('/traffic?foo=1'); console.log('bad',s,j.error);
[s,o,c,j]=await go('/notams?lat=-38&lon=144'); console.log('notams gone',s,j.error);
const pre=await W.fetch(new Request('https://w.dev/traffic',{method:'OPTIONS',headers:{Origin:'http://localhost:8811'}}),env,ctx); console.log('preflight',pre.status,pre.headers.get('Access-Control-Allow-Origin'));
