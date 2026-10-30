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
// with the adsb.lol key: re-api first, key in x-api-key; a bad key falls back to the public API
const seen=[]; env.ADSBLOL_KEY='test-key';
globalThis.fetch=async(u,o)=>{ u=String(u); seen.push(u.split('?')[0]+' '+(o.headers['x-api-key']||'-'));
  if(u.startsWith('https://re-api.adsb.lol/?circle=-35.50,144.90,25')&&o.headers['x-api-key']==='test-key') return new Response(JSON.stringify({now:1,aircraft:AC.ac}));
  return new Response('x',{status:500}); };
[s,o,c,j]=await go('/traffic?lat=-35.5&lon=144.9&nm=25'); console.log('keyed',s,j.src,j.n,seen.join(' | '));
seen.length=0; globalThis.fetch=async(u,o)=>{ u=String(u); seen.push(u.split('?')[0]+' '+(o.headers['x-api-key']||'-')); return u.includes('re-api')||o.headers['x-api-key']? new Response('api key bound to a different address',{status:401}) : new Response(JSON.stringify(AC)); };
[s,o,c,j]=await go('/traffic?lat=-34.5&lon=144.9&nm=25'); console.log('bad key',s,j.src,j.n,seen.join(' | '));
delete env.ADSBLOL_KEY;
// satellite tiles: key from the secret, origin/referer and Australia checks, edge cache, Esri error passthrough
{ const PNG=new Uint8Array([137,80,78,71,13,10,26,10]); const seen=[];
  env.ESRI_KEY='secret-key';
  globalThis.fetch=async(u)=>{ u=String(u); seen.push(u.replace(/token=[^&]+/,'token=…'));
    if(!u.includes('token=secret-key')) return new Response('{"error":"token"}',{status:498});
    if(u.includes('/19/')) return new Response('{"error":{"code":498}}',{status:200,headers:{'content-type':'application/json'}});
    return new Response(PNG,{status:200,headers:{'content-type':'image/png'}}); };
  const T=async(path,h={Origin:'https://meee1.github.io'})=>{ const r=await W.fetch(new Request('https://w.dev'+path,{headers:h}),env,ctx); return [r.status,r.headers.get('X-Cache'),r.headers.get('Cache-Control'),r.headers.get('Access-Control-Allow-Origin'),r.headers.get('content-type')]; };
  // Melbourne at z10: x=924 y=631
  console.log('tile wi', ...await T('/tile/wi/10/631/924'));
  console.log('tile wi again', ...await T('/tile/wi/10/631/924'));
  console.log('tile st referer', ...await T('/tile/st/9/315/462',{Referer:'https://meee1.github.io/airspace_assist/app/'}));
  console.log('no origin', ...await T('/tile/wi/10/631/925',{}));
  console.log('other site', ...await T('/tile/wi/10/631/925',{Origin:'https://evil.example'}));
  console.log('outside AU (London)', ...await T('/tile/wi/10/340/511'));
  console.log('zoom too low', ...await T('/tile/wi/1/1/1'));
  console.log('bad path', ...await T('/tile/xx/1/1/1'));
  console.log('esri json error', ...await T('/tile/wi/19/323224/473238'));
  console.log('upstream', seen.join(' | '));
  delete env.ESRI_KEY; console.log('no key', ...await T('/tile/wi/10/631/926')); }
