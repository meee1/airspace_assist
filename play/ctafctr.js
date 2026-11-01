// tower aerodromes: CTAF area = control zone (YMMB, YMAV), others 10 NM circles
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const p=await (await b.newContext(PX9)).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(600);
 for(const [ad,r] of [['YMMB',20],['YMAV',20]]){ await p.evaluate(([ad,r])=>{ $('simPos').value=ad; simApply(); CH.on=false; MAP.ter=false; MAP.ctaf=true; MAP.range=r; MAP.up='north'; MAP.pan=null; render(); },[ad,r]); await p.waitForTimeout(500);
   const m=await p.$('#map'); await m.scrollIntoViewIfNeeded(); await m.screenshot({path:`play/ctafctr_${ad}.png`});
   console.log(ad, await p.evaluate(ad=>{ const a=DATA.ap.find(x=>x.i===ad); return ctafInfo(a).f+' ctr '+ASP.filter(z=>z.k==='CTR'&&inAsp(z,a.la,a.lo)).map(z=>z.n).join(','); },ad), await p.textContent('#ctafLeg')); }
 console.log(errs); await b.close(); })();
