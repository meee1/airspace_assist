// warning row when you're inside an R / P / D area at your altitude
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const p=await (await b.newContext(PX9)).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(800);
 for(const [n,pos,alt] of [['ybrs','YBRS',1500],['ybrs_high','YBRS',14000],['woomera','YPWR',3000],['ymmb','YMMB',1500]]){
  await p.evaluate(([pos,alt])=>{ $('simPos').value=pos; $('simAlt').value=String(alt); simApply(); render(); },[pos,alt]); await p.waitForTimeout(500);
  const v=await p.evaluate(()=>({hid:$('sInSua').hidden, vis:getComputedStyle($('sInSua')).display, t:$('sInSua').textContent}));
  console.log(n,JSON.stringify(v));
  await p.evaluate(()=>window.scrollTo(0,0)); const s=await p.$('.status'); await s.screenshot({path:`play/insua_${n}.png`}); }
 console.log(errs); await b.close(); })();
