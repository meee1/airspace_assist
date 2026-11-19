// node test_429.mjs : a feed that answers 429 is skipped until its Retry-After has passed; when every feed is over quota the
// Worker answers 429 with Retry-After (and retryAfter in the body) so the app waits. No network.
const store=new Map(); globalThis.caches={default:{match:async k=>store.get(k.url)?.clone(), put:async(k,r)=>{ store.set(k.url,r); }}};
const W=(await import('./worker.js')).default, env={}, ctx={waitUntil:p=>p};
const go=async qs=>{ const r=await W.fetch(new Request('https://w.dev'+qs),env,ctx); return [r.status, r.headers.get('Retry-After'), await r.json()]; };
const AC={ac:[{hex:'7c1234',r:'VH-VOZ',lat:-38.2,lon:144.4,alt_baro:1700,gs:90,track:180}]};
let fails=0; const ok=(c,m)=>{ console.log((c?'ok   ':'FAIL ')+m); if(!c) fails++; };
const calls=[];
// adsb.lol over quota (Retry-After 120), adsb.fi fine -> data from adsb.fi
globalThis.fetch=async u=>{ u=String(u); calls.push(new URL(u).host); if(u.includes('adsb.lol')) return new Response('rate limit exceeded',{status:429,headers:{'Retry-After':'120'}}); return new Response(JSON.stringify({aircraft:AC.ac})); };
let [s,ra,j]=await go('/traffic?lat=-38.25&lon=144.43&nm=25&debug=1');
ok(s===200&&j.src==='opendata.adsb.fi'&&j.skipped.some(e=>/429.*Retry-After 120 s/.test(e)),'adsb.lol 429: answered from adsb.fi, the 429 noted ('+j.skipped+')');
calls.length=0; [s,ra,j]=await go('/traffic?lat=-37.25&lon=144.43&nm=25&debug=1');
ok(s===200&&!calls.includes('api.adsb.lol')&&j.skipped.some(e=>/rate limited, next try in 1\d\d s/.test(e)),'next request: adsb.lol not asked while blocked ('+calls.join(',')+')');
// both over quota -> 429 to the app with the shortest wait
globalThis.fetch=async u=>{ u=String(u); return new Response('rate limit exceeded',{status:429,headers:{'Retry-After': u.includes('adsb.fi')?'30':'120'}}); };
[s,ra,j]=await go('/traffic?lat=-36.25&lon=144.43&nm=25&debug=1');
ok(s===429&&+ra>=28&&+ra<=30&&j.retryAfter===+ra&&j.error==='rate limited','every feed over quota: 429, Retry-After '+ra+' s (the shorter wait)');
console.log(fails? fails+' FAILED' : 'all passed'); process.exit(fails?1:0);
