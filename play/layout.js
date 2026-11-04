// After each update: ms of JS (render) and of the style+layout the page needs afterwards (forced right away to time it), CPU x4
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); for(const fs of [false,true]){ const ctx=await b.newContext({...PX9}); const p=await ctx.newPage();
 await p.addInitScript(v=>{ try{ localStorage.setItem('rc_fsMap',v); }catch(e){} }, String(fs));
 await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=090&gs=90'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(8000);
 const cdp=await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 console.log(fs?'full screen':'classic   ', await p.evaluate(async()=>{ const J=[],L=[],M=[]; const mo=new MutationObserver(r=>{ for(const m of r){ const e=m.target.nodeType===1?m.target:m.target.parentElement; M.push((e.id||e.className||e.tagName)+':'+m.type[0]+(m.attributeName?'.'+m.attributeName:'')); } }); mo.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true});
   for(let i=0;i<20;i++){ st.pos=[st.pos[0],st.pos[1]+0.0004]; const t=performance.now(); render(); const t1=performance.now(); document.body.getBoundingClientRect(); void document.body.offsetHeight; const t2=performance.now(); J.push(t1-t); L.push(t2-t1); await new Promise(r=>setTimeout(r,150)); }
   mo.disconnect(); const med=a=>a.sort((x,y)=>x-y)[a.length>>1].toFixed(1); const c=new Map(); for(const m of M) c.set(m,(c.get(m)||0)+1);
   return `render ${med(J)} ms · layout after ${med(L)} ms · DOM changes per update: ${(M.length/20).toFixed(0)} · most: ${[...c.entries()].sort((a,b)=>b[1]-a[1]).slice(0,40).map(([k,v])=>k+' '+(v/20).toFixed(0)).join(', ')}`; }));
 await ctx.close(); } await b.close(); })();
