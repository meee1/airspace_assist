// Sat layer through the proxy (notam-worker/mockserver.mjs on :8812 with fake Esri): CORS tiles, service-worker cache, offline
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext(PX9); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function');
 await p.evaluate(()=>navigator.serviceWorker.ready); await p.reload(); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(500);
 console.log('sw controls', await p.evaluate(()=>!!navigator.serviceWorker.controller));
 await p.evaluate(()=>{ ls.set('notamUrl','http://localhost:8812'); $('ntUrl').value='http://localhost:8812'; $('ntUrl').dispatchEvent(new Event('change')); }); await p.waitForTimeout(200);
 await p.click('#bOpts'); await p.waitForTimeout(200); console.log('via:', await p.textContent('#satVia'));
 await p.click('#satTest'); await p.waitForTimeout(1500); console.log('check:', await p.textContent('#satStat')); await p.keyboard.press('Escape');
 await p.evaluate(()=>{ SAT.on=true; ls.set('mapSat',true); satUI(); CH.on=false; MAP.ter=false; MAP.range=5; MAP.up='north'; MAP.pan=null; render(); }); await p.waitForTimeout(2500); await p.evaluate(()=>render());
 const n1=await p.evaluate(async()=>{ const c=await caches.open('radio-au-sat'); return (await c.keys()).length; });
 console.log('sat on:', await p.evaluate(()=>[$('mapSat').getAttribute('aria-pressed'), [...SAT.img.values()].filter(t=>t.ok).length+' tiles loaded', SAT.lastErr].join(' | ')), '| stored by SW', n1);
 await (await p.$('#map')).screenshot({path:'play/satproxy_on.png'});
 // offline: new page load, proxy unreachable -> tiles from the SW cache
 await ctx.setOffline(true); const p2=await ctx.newPage(); p2.on('pageerror',e=>errs.push(e.message));
 await p2.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=000&gs=0'); await p2.waitForFunction(()=>typeof render==='function',null,{timeout:20000});
 await p2.evaluate(()=>{ CH.on=false; MAP.ter=false; MAP.range=5; MAP.up='north'; MAP.pan=null; render(); }); await p2.waitForTimeout(2500); await p2.evaluate(()=>render());
 console.log('offline:', await p2.evaluate(()=>[...SAT.img.values()].filter(t=>t.ok).length+' tiles loaded, '+[...SAT.img.values()].filter(t=>t.bad).length+' failed'));
 await (await p2.$('#map')).screenshot({path:'play/satproxy_offline.png'});
 console.log(errs); await b.close(); })();
