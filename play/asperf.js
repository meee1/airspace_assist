// airStack (Screen update → airspace stack): ms per call at CPU x4 at a few places, with a breakdown
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const errs=[];
 const ctx=await b.newContext({...PX9}); const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=090&gs=90'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(1500);
 const cdp=await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 const r=await p.evaluate(()=>{ const out={n:ASP.length};
   const W=(name,f)=>{ const o=window[name]; let t=0,n=0; window[name]=function(...a){ const t0=performance.now(); try{ return o.apply(this,a); } finally{ t+=performance.now()-t0; n++; } }; return ()=>{ window[name]=o; return [t,n]; }; };
   for(const [nm,la,lo] of [['YMMB',-37.976,145.102],['YBRS',-38.25,144.43],['YMML CTR',-37.67,144.84],['YMAV',-38.04,144.47],['open G',-36.5,146.0]]){
     const un=['sectorsAt','unitFor','suaStatus','twrStatus','inAsp'].map(n=>[n,W(n)]);
     const T=[]; for(let i=0;i<20;i++){ const t=performance.now(); airStack(la+i*1e-4,lo,100); T.push(performance.now()-t); }
     T.sort((a,b)=>a-b); const parts=un.map(([n,f])=>{ const [t,c]=f(); return n+' '+(t/20).toFixed(2)+'/'+(c/20|0); }).join(' · ');
     out[nm]=T[10].toFixed(2)+' ms  ('+parts+')'; }
   return out; });
 console.log(JSON.stringify(r,null,1)); console.log(errs); await b.close(); })();
