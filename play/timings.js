// Current render timing panel at CPU x4 (phone-like), moving at 90 kt near YMMB, 10 NM, default layers
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({...PX9}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(v=>{ try{ localStorage.setItem('rc_fsMap',v); }catch(e){} }, String(process.argv[2]==='fs')); await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=090&gs=90'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(8000);
 await p.evaluate(()=>{ $('optPerf').checked=true; $('optPerf').dispatchEvent(new Event('change')); });
 const cdp=await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 await p.evaluate(async()=>{ for(let i=0;i<40;i++){ st.pos=[st.pos[0],st.pos[1]+0.0004]; render(); await new Promise(r=>setTimeout(r,80)); } });
 console.log(await p.evaluate(()=>pfText()));
 await p.evaluate(()=>{ PF.all=true; }); await p.waitForTimeout(300);
 const el=await p.$('#perfBox'); if(el) await el.screenshot({path:'/tmp/claude-0/timings.png'});
 console.log(errs); await b.close(); })();
