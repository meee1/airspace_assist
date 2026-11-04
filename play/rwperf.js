// Runways stage of render(): ms per update at CPU x4, in the classic page and full screen, moving at 90 kt near YMMB
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const errs=[];
 for(const fs of [false,true]){
 const ctx=await b.newContext({...PX9}); const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(v=>{ try{ localStorage.setItem('rc_fsMap',v); }catch(e){} }, String(fs));
 await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=090&gs=90'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(1500);
 const cdp=await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 const r=await p.evaluate(async()=>{ const T=[], o=renderRunways; let draws=0; const od=drawAdMap;
   window.renderRunways=function(...a){ const t=performance.now(); o.apply(this,a); T.push(performance.now()-t); };
   for(let i=0;i<30;i++){ st.pos=[st.pos[0],st.pos[1]+0.0004]; render(); await new Promise(r=>setTimeout(r,60)); }
   window.renderRunways=o; T.sort((a,b)=>a-b); return {med:T[T.length>>1].toFixed(2), max:T[T.length-1].toFixed(2), n:T.length}; });
 console.log(fs?'full screen':'classic', JSON.stringify(r));
 await ctx.close(); }
 console.log(errs); await b.close(); })();
