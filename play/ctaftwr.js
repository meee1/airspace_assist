// tower aerodromes first: YMML/YMEN zones on their tower frequencies, Avalon and Moorabbin zones cut the CTAF circles round them
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const p=await (await b.newContext(PX9)).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YMML&alt=1500&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(800);
 for(const [n,pos,r] of [['ymml','YMML',20],['ymav','YMAV',20],['ymmb','YMMB',20]]){
  await p.evaluate(([pos,r])=>{ $('simPos').value=pos; simApply(); CH.on=false; MAP.ter=false; MAP.ctaf=true; MAP.range=r; MAP.up='north'; MAP.pan=null; render(); },[pos,r]); await p.waitForTimeout(600);
  const m=await p.$('#map'); await m.screenshot({path:`play/ctaftwr_${n}.png`}); console.log(n, await p.textContent('#ctafLeg')); }
 console.log(errs); await b.close(); })();
