// Go to target symbol: on the map at the point (CATANI), and an edge pointer with name and distance when it's off the map
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({...PX9}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=090&gs=90'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(800);
 console.log('CATANI found:', await p.evaluate(()=>{ const q=findPoint('CATANI'); return q? `${q.k} ${q.c} ${q.n} ${q.la.toFixed(3)},${q.lo.toFixed(3)}` : 'no'; }));
 await p.fill('#goIn','CATANI'); await p.press('#goIn','Enter'); await p.waitForTimeout(300);
 const near=await p.evaluate(()=>{ const [la,lo]=[GO.la-0.05,GO.lo-0.12]; $('simPos').value=la+','+lo; simApply(); MAP.range=10; CH.on=false; render(); return GO.c+' '+distBrg(la,lo,GO.la,GO.lo)[0].toFixed(1)+' NM'; });
 console.log('Go to', near); const m=await p.$('.mapbox'); await m.scrollIntoViewIfNeeded(); await m.screenshot({path:'goto_tgt_on.png'});
 await p.evaluate(()=>{ $('simPos').value='-37.98,145.1'; simApply(); MAP.range=10; render(); }); await m.screenshot({path:'goto_tgt_edge.png'});
 console.log(errs); await b.close(); })();
