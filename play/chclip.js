// chart clips: Tamworth (rotated page), Adelaide VNC (whole sheet), Cairns VTC (legend column out), Sydney VNC west edge (legend column out)
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); require('./classic.js')(b); const ctx=await b.newContext(PX9); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YSTW&alt=3000&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(800);
 await p.evaluate(()=>{ ls.set('chartSel',CH.site.map(e=>e.sheet)); }); await p.reload(); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(800);
 for(const [n,pos,r] of [['tamworth','YSTW',20],['adl_pirie','YPPF',40],['adl_renmark','YREN',40],['cairns','YBCS',20],['sydvnc_w','YTEM',40],['ml','YMMB',10]]){
  await p.evaluate(([pos,r])=>{ $('simPos').value=pos; simApply(); CH.on=true; MAP.ter=false; MAP.ctaf=false; MAP.range=r; MAP.up='north'; MAP.pan=null; render(); },[pos,r]);
  for(let k=0;k<20;k++){ await p.waitForTimeout(1500); await p.evaluate(()=>render()); }
  const m=await p.$('#map'); await m.screenshot({path:`play/chclip_${n}.png`}); console.log(n, await p.evaluate(()=>CH.have+'/'+CH.need)); }
 console.log(errs); await b.close(); })();
