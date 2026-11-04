// footer "App updated … (N min ago)" keeps counting while the app stays open
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({...PX9}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.clock.install(); await p.goto('http://localhost:8811/index.html?sim=YBRS&alt=1500&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function');
 const t=()=>p.evaluate(()=>$('foot').querySelector('.upd').textContent);
 console.log('now:', await t()); await p.clock.runFor(5*60000); console.log('+5 min:', await t()); await p.clock.fastForward(2*3600000); await p.clock.runFor(61000); console.log('+2 h:', await t());
 console.log(errs); await b.close(); })();
