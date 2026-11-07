// press-and-hold menu: CTAF and area/ATC frequency at the point
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext(PX9); await ctx.addInitScript(()=>{ const T=Date.parse('2026-10-30T01:00:00Z'), o=Date.now, off=T-o.call(Date); Date.now=()=>o.call(Date)+off; const D=Date; window.Date=class extends D{ constructor(...a){ super(...(a.length?a:[D.now()])); } static now(){ return D.now(); } }; }); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YBRS&alt=1500&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(800);
 for(const [n,la,lo] of [['ybrs',-38.26,144.42],['ymmb_e',-37.98,145.15],['ymmb_w',-37.98,145.05],['avalon',-38.04,144.47],['nowhere',-37.2,143.0],['bay',-38.1,144.85]]){
  const r=await p.evaluate(([la,lo])=>{ CH.on=false; MAP.ter=false; MAP.range=20; MAP.up='north'; MAP.pan=[la,lo]; render(); const [x,y]=MAP.P(la,lo); mapMenu(x,y); return $('mmFq').innerText.replace(/\n/g,' '); },[la,lo]);
  console.log(n, r); if(n==='ymmb_w'||n==='bay') await (await p.$('#mapMenu')).screenshot({path:'play/mmfq_'+n+'.png'}); }
 console.log(errs); await b.close(); })();
