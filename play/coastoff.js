// The whole coastline is kept for offline use: downloaded in the background after the app starts (service worker on).
// Status (≈ Coast legs row in Edit, the Offline line at the foot, Plan check); some areas missing -> Store now; old builds'
// tiles are dropped; then with no signal a coast leg can still be made and a shared plan's coast leg worked out; a phone
// that never got the coastline says so. Needs app/coast/ (tools/coast.py).
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); require('./classic.js')(b); const ctx=await b.newContext({...PX9}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 p.on('dialog',d=>d.accept());
 await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function');
 await p.evaluate(()=>navigator.serviceWorker.ready); await p.reload(); await p.waitForFunction(()=>typeof render==='function'&&!!navigator.serviceWorker.controller);
 // in the background, without asking
 const t0=Date.now(); let bg=[0,0];
 while(Date.now()-t0<60e3){ bg=await p.evaluate(async()=>{ try{ await coastIndex(); return [(await coastStored()).have.size, COAST.c.size]; }catch(e){ return [0,0]; } }); if(bg[1]&&bg[0]>=bg[1]) break; await p.waitForTimeout(500); }
 console.log('stored in the background:', bg.join('/'), 'areas,', Date.now()-t0, 'ms after the service worker took over (it waits 6 s)'); if(!bg[1]||bg[0]<bg[1]) errs.push('not stored in the background: '+bg);
 // some missing (and one from an "older build", which is dropped): the status says so, Store now fills it
 await p.evaluate(async()=>{ const c=await caches.open('radio-au-terrain'); for(const k of await c.keys()) if(/\/coast\/S3/.test(k.url)) await c.delete(k); await c.put('coast/S38E144.json?v=2000-01-01',new Response('{"p":[]}')); });
 await p.evaluate(()=>{ ls.set('coastOff',500); ls.set('coastGap',2); COAST.off=500; COAST.gap=2; fpSet({name:'Bay',kind:'map',pts:[fpPt(findPoint('YMMB')),fpPt(findPoint('YBRS'))],i:1}); FP_EDIT=true; render(); coastOffl(); });
 const st=()=>p.evaluate(()=>[$('fpCoastOffl').textContent, $('fpCoastStore').hidden?'(no button)':$('fpCoastStore').textContent+($('fpCoastStore').disabled?' disabled':'')]);
 await p.waitForTimeout(800); const s0=await st(); console.log('some missing:', JSON.stringify(s0)); if(!/Coastline stored: \d+ of \d+ areas.*background/.test(s0[0])||s0[1]!=='Store now') errs.push('status with some missing: '+JSON.stringify(s0));
 const old=await p.evaluate(async()=>(await (await caches.open('radio-au-terrain')).keys()).filter(k=>/2000-01-01/.test(k.url)).length); if(old) errs.push('older build tile not dropped');
 await p.click('#fpLegs li[data-k="1"] [data-a="cst"]'); await p.waitForFunction(()=>FP.pts.length>2,undefined,{timeout:30000}); await p.waitForTimeout(500);
 const s1=await st(); console.log('after a coast leg:', JSON.stringify(s1)); if(!/this plan's coast legs: (\d+)\/\1 areas/.test(s1[0])) errs.push('leg areas: '+s1[0]);
 const pc=await p.evaluate(async()=>(await routeReady(FP.pts,Date.now(),Date.now()+3600e3)).txt.split('\n').filter(l=>/oast/.test(l))); console.log('plan check:', JSON.stringify(pc));
 const t1=Date.now(); await p.click('#fpCoastStore'); try{ await p.waitForFunction(()=>$('fpCoastStore').hidden,undefined,{timeout:60000}); }catch(e){ console.log('STUCK', JSON.stringify(await st()), await p.evaluate(()=>COAST.storing)); }
 const s2=await st(); console.log('store now:', Date.now()-t1, 'ms', JSON.stringify(s2)); if(!/Coastline stored: all areas/.test(s2[0])) errs.push('after store all: '+s2[0]);
 await p.evaluate(()=>offlineStatus()); await p.waitForTimeout(300); const foot=await p.evaluate(()=>$('offl').textContent); console.log('foot:', foot); if(!/coastline all areas/.test(foot)) errs.push('foot: '+foot);
 // no signal: a fresh page (nothing in memory), a coast leg elsewhere, and a shared plan with one
 const link=await p.evaluate(()=>planLink('Bay',FP.pts));
 await ctx.setOffline(true); const p2=await ctx.newPage(); p2.on('pageerror',e=>errs.push(e.message));
 await p2.goto('http://localhost:8811/index.html?sim=YSBK&alt=1500&trk=000&gs=0'); await p2.waitForFunction(()=>typeof render==='function');
 await p2.evaluate(()=>{ fpSet({name:'Syd',kind:'map',pts:[fpPt(findPoint('YSBK')),fpPt(findPoint('YSHL'))],i:1}); FP_EDIT=true; render(); });
 await p2.click('#fpLegs li[data-k="1"] [data-a="cst"]'); await p2.waitForFunction(()=>FP.pts.length>2||/No /.test($('fpCoastStat').textContent),undefined,{timeout:30000}); await p2.waitForTimeout(500);
 const o1=await p2.evaluate(()=>[FP.pts.length, $('fpCoastStat').textContent, $('fpCoastOffl').textContent, $('fpCoastStore').hidden]); console.log('offline, new coast leg:', JSON.stringify(o1)); if(o1[0]<3||!/no signal/.test(o1[2])) errs.push('offline leg: '+JSON.stringify(o1));
 const p3=await ctx.newPage(); p3.on('pageerror',e=>errs.push(e.message)); p3.on('dialog',d=>d.accept());
 await p3.goto(link.replace(/^[^#]*/,'http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=000&gs=0')); await p3.waitForFunction(()=>typeof FP!=='undefined'&&FP&&FP.name==='Bay'&&FP.pts.some(q=>q.cg),undefined,{timeout:30000});
 const o3=await p3.evaluate(()=>FP.name+' '+fplRoute(FP.pts)+', '+FP.pts.length+' points'); console.log('offline, shared link:', o3); if(!/^Bay YMMB → YBRS, \d{2,} points/.test(o3)) errs.push('offline link: '+o3);
 // a phone that never stored the area: opened once with signal (app installed, coastline index fetched), then none
 const ctx2=await b.newContext({...PX9}); const p4=await ctx2.newPage(); p4.on('pageerror',e=>errs.push(e.message));
 await p4.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=000&gs=0'); await p4.evaluate(()=>navigator.serviceWorker.ready); await p4.reload(); await p4.waitForFunction(()=>typeof render==='function'&&!!navigator.serviceWorker.controller);
 await p4.evaluate(()=>coastIndex()); await p4.waitForTimeout(500); await ctx2.setOffline(true);
 await p4.evaluate(()=>{ fpSet({name:'Bay',kind:'map',pts:[fpPt(findPoint('YMMB')),fpPt(findPoint('YBRS'))],i:1}); FP_EDIT=true; render(); coastOffl(); });
 await p4.click('#fpLegs li[data-k="1"] [data-a="cst"]'); await p4.waitForFunction(()=>/No /.test($('fpCoastStat').textContent),undefined,{timeout:30000}); await p4.waitForTimeout(300);
 const o2=await p4.evaluate(()=>[$('fpCoastStat').textContent, $('fpCoastOffl').textContent, $('fpCoastStore').textContent+($('fpCoastStore').disabled?' (disabled)':'')]); console.log('offline, area not stored:', JSON.stringify(o2)); if(!/isn't stored on this phone yet/.test(o2[0])||!/disabled/.test(o2[2])||!/no signal/.test(o2[1])) errs.push('offline missing: '+JSON.stringify(o2));
 await (await p4.$('#fpBox')).screenshot({path:'play/coastoff.png'});
 await ctx.setOffline(false); await ctx2.setOffline(false); console.log(errs); await b.close(); })();
