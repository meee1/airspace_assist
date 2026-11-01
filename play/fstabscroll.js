// full-screen tablet/phone: each sheet tab scrolls its section to the top of the sheet
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
const DEV={tab:{viewport:{width:1280,height:800},deviceScaleFactor:1.5,isMobile:true,hasTouch:true}, tabp:{viewport:{width:800,height:1280},deviceScaleFactor:1.5,isMobile:true,hasTouch:true}, phone:PX9};
(async()=>{ const b=await chromium.launch(); for(const [nm,d] of Object.entries(DEV)){ const ctx=await b.newContext({...d,storageState:{cookies:[],origins:[{origin:'http://localhost:8811',localStorage:[{name:'rc_fsMap',value:'true'}]}]}});
 const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YBRS&alt=1500&trk=000&gs=80'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(1500);
 const cls=await p.evaluate(()=>document.body.className); const out=[];
 for(const id of ['adCard','calls','fpBox','goBox','ntSet','moreCtl','fpBox','goBox']){ await p.click(`#fsTabs [data-fs="${id}"]`); await p.waitForTimeout(900);
   out.push(id+' '+await p.evaluate(i=>{ const e=$(i), B=$('fsBody').getBoundingClientRect(), r=e.getBoundingClientRect(); return `top off ${Math.round(r.top-B.top)} (sheet ${$('fsSheet').dataset.s}, scroll ${Math.round($('fsBody').scrollTop)}/${$('fsBody').scrollHeight-$('fsBody').clientHeight})`; },id));
   if(id==='goBox'||id==='fpBox') await p.screenshot({path:`play/fstab_${nm}_${id}.png`}); }
 console.log(nm,cls,'\n '+out.join('\n '),errs); await ctx.close(); } await b.close(); })();
