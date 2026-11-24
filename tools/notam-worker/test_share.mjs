// node test_share.mjs : /traffic shared between callers (25 Nov 2026): one 100 NM fetch per 0.5-degree cell, fresh 8 s, a 60 s
// fallback when the feeds fail, positions over 60 s old dropped, each caller's own nm, aircraft merged across cells.
const store=new Map(); globalThis.caches={default:{match:async k=>store.get(k.url)?.clone(), put:async(k,r)=>{ store.set(k.url,r); }}};
let NOW=Date.UTC(2026,10,25,2,0,0); const realNow=Date.now; Date.now=()=>NOW;
const W=(await import('./worker.js')).default, env={ALLOW_ORIGIN:'https://meee1.github.io'}, ctx={waitUntil:p=>p};
const go=async qs=>{ const r=await W.fetch(new Request('https://w.dev/traffic'+qs,{headers:{Origin:'https://meee1.github.io'}}),env,ctx); return {s:r.status, c:r.headers.get('X-Cache'), j:await r.json()}; };
let fail=0; const ok=(c,m)=>{ console.log((c?'ok   ':'FAIL ')+m); if(!c) fail++; };
const calls=[]; let FEED=[{hex:'7c0001',flight:'ABC',lat:-38.0,lon:145.1,alt_baro:1500,gs:90,track:0,seen_pos:2},{hex:'7c0002',lat:-38.9,lon:145.1,alt_baro:3000,gs:120,seen_pos:0},{hex:'7c0003',lat:-36.6,lon:145.0,alt_baro:5000,seen_pos:0}];
let up=true; globalThis.fetch=async u=>{ calls.push(String(u)); return up? new Response(JSON.stringify({ac:FEED})) : new Response('down',{status:503}); };
// two callers in the same cell (-38.25,145.25): one feed call, 100 NM round the cell's centre
let a=await go('?lat=-38.02&lon=145.11&nm=25'), b=await go('?lat=-38.20&lon=145.40&nm=60');
ok(calls.length===1&&/\/v2\/point\/-38\.2500\/145\.2500\/100$/.test(calls[0]),'one feed call for both callers: '+calls[0]);
ok(a.c==='MISS'&&b.c==='HIT'&&a.j.cell==='-38.25,145.25'&&a.j.fetchNm===100,`first MISS, second HIT, cell ${a.j.cell}`);
ok(a.j.ac.map(x=>x.hex).join()==='7c0001'&&b.j.ac.map(x=>x.hex).sort().join()==='7c0001,7c0002',`each caller's own range: 25 NM ${a.j.ac.map(x=>x.hex)}, 60 NM ${b.j.ac.map(x=>x.hex)}`);
ok(a.j.ac[0].seen===2,'seen = the age of the position: 2 s');
// 5 s later: still fresh, seen has grown
NOW+=5000; a=await go('?lat=-38.02&lon=145.11&nm=25'); ok(calls.length===1&&a.c==='HIT'&&a.j.ac[0].seen===7,`5 s later: HIT, no feed call, seen ${a.j.ac[0].seen} s`);
// 9 s: stale -> asked again
NOW+=4000; a=await go('?lat=-38.02&lon=145.11&nm=25'); ok(calls.length===2&&a.c==='MISS','after 8 s the cell is fetched again');
// the feeds fail: the last snapshot is used (STALE) while under 60 s, positions ageing
up=false; NOW+=20000; a=await go('?lat=-38.02&lon=145.11&nm=25'); ok(a.s===200&&a.c==='STALE'&&a.j.ac[0].seen===22,`feeds down 20 s later: STALE, seen ${a.j.ac[0]&&a.j.ac[0].seen} s`);
NOW+=39000; a=await go('?lat=-38.02&lon=145.11&nm=25'); ok(a.s===200&&a.c==='STALE'&&a.j.n===0,`59 s after the fetch: the aircraft (position 61 s old) is dropped: n=${a.j.n}`);
NOW+=2000; a=await go('?lat=-38.02&lon=145.11&nm=25'); ok(a.s===502,'over 60 s with the feeds down: 502');
// another cell's fetch fills in a caller near the boundary (per-aircraft merge, newer position wins)
up=true; NOW+=1000; FEED=[{hex:'7c0009',lat:-37.52,lon:145.1,alt_baro:2500,seen_pos:1}];
await go('?lat=-37.6&lon=145.1&nm=10');   // cell -37.75,145.25: sees 7c0009 (just north of it)
FEED=[]; const c=await go('?lat=-37.4&lon=145.1&nm=15');   // cell -37.25,145.25: its own fetch has nothing
ok(c.j.ac.some(x=>x.hex==='7c0009'),'an aircraft from the neighbouring cell\'s fetch is included for a caller near the boundary');
Date.now=realNow; console.log(fail? fail+' FAILED':'all passed'); process.exit(fail?1:0);
