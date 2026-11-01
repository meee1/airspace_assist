// runway diagram: end labels stay inside the canvas at any track (track up)
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const p=await (await b.newContext(PX9)).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=000&gs=60'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(800);
 let i=0; for(const [ad,trk] of [['YMMB',0],['YMMB',45],['YMMB',300],['YSBK',90],['YBRS',135],['YMML',200]]){
  await p.evaluate(([ad,trk])=>{ $('simPos').value=ad; simApply(); MAP.up='trk'; $('simTrk').value=String(trk); $('simGs').value='60'; simApply(); render(); },[ad,trk]);
  await p.waitForTimeout(400); const c=await p.$('#rwBox'); await c.scrollIntoViewIfNeeded(); await c.screenshot({path:`play/rwlab_${i++}.png`}); }
 console.log(errs); await b.close(); })();
