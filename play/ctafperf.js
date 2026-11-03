// drawMap cost with the CTAF layer on/off, per range, phone viewport, CPU throttled 4x
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({...PX9}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=315&gs=100'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(1500);
 const cdp=await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate',{rate:+(process.argv[2]||4)});
 const pos=process.argv[3]||'-37.98,145.1';
 await p.evaluate(([pos,od])=>{ if(od) CTAF_OD=+od; $('simPos').value=pos; simApply(); render(); },[pos,process.argv[4]||'']);
 for(const split of [true,false]) for(const range of [10,20,40,80]) {
   const r=await p.evaluate(([range,split])=>{ ls.set('ctafSplit',split); MAP.range=range; const out={};
     for(const on of [false,true]){ MAP.ctaf=on; drawMap(...MAP.last); const t=[]; for(let i=0;i<8;i++){ const t0=performance.now(); drawMap(...MAP.last); t.push(performance.now()-t0); } t.sort((a,b)=>a-b); out[on?'on':'off']=t[4]; }
     return out; },[range,split]);
   console.log(`split ${split?'on ':'off'} ${String(range).padStart(2)} NM  off ${r.off.toFixed(0).padStart(4)} ms   on ${r.on.toFixed(0).padStart(4)} ms   CTAF +${(r.on-r.off).toFixed(0)} ms`); }
 console.log('canvas', await p.evaluate(()=>{ const c=document.querySelector('#mapCv')||document.querySelector('canvas#map')||[...document.querySelectorAll('canvas')].sort((a,b)=>b.width*b.height-a.width*a.height)[0]; return c.id+' '+c.width+'x'+c.height; }), errs); await b.close(); })();
