// charted CTAFs (tools/chart_ctaf.json): YWOT 118.8 from the VTC/VNC, ERSA still wins elsewhere
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const p=await (await b.newContext(PX9)).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YWOT&alt=1000&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(1500);
 console.log(await p.evaluate(()=>['YWOT','YRTH','YCES','YMMB','YBRS','YLVB'].map(i=>{ const a=DATA.ap.find(x=>x.i===i); const c=ctafInfo(a); return i+' '+c.f+' '+c.src+' | '+c.note+(c.other?' | other '+c.other.src+' '+c.other.f:''); }).join('\n')));
 console.log('tile', await p.textContent('#ctafRow'));
 await p.evaluate(()=>{ MAP.ctaf=true; MAP.range=10; MAP.up='north'; CH.on=false; MAP.ter=false; render(); }); await p.waitForTimeout(500);
 const c=await p.$('#ctafRow'); await c.scrollIntoViewIfNeeded(); await c.screenshot({path:'play/chartctaf_card.png'});
 const m=await p.$('#map'); await m.screenshot({path:'play/chartctaf_map.png'});
 console.log(errs); await b.close(); })();
