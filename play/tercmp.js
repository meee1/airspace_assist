// terrain layer: cached (this build) vs drawn every frame (old build on :8813), same place/altitude/heading, rainbow and grey
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const out=[];
 for(const [port,tag] of [[8811,'new'],[+(process.env.OLD||8813),'old']]) for(const rbw of [true,false]){
  const ctx=await b.newContext({...PX9}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.addInitScript(r=>{ try{ localStorage.setItem('rc_fsMap','false'); localStorage.setItem('rc_terRainbow',String(r)); }catch(e){} }, rbw);
  await p.goto(`http://localhost:${port}/index.html?sim=YMEN&alt=2600&trk=045&gs=0`); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(1500);
  await p.evaluate(()=>{ $('simPos').value='-37.43,144.52'; simApply(); CH.on=false; MAP.range=10; render(); });
  await p.waitForTimeout(3000); await p.evaluate(()=>{ for(let i=0;i<5;i++){ st.pos=[st.pos[0]+0.002,st.pos[1]+0.002]; render(); } });
  await p.waitForTimeout(300); const m=await p.$('#map'); await m.scrollIntoViewIfNeeded(); await m.screenshot({path:`/tmp/claude-0/ter_${tag}_${rbw?'rb':'grey'}.png`});
  out.push(tag+' '+(rbw?'rainbow':'grey')+' '+JSON.stringify(errs)+' rb='+await p.evaluate(()=>ls.get('terRainbow',true)));
  await ctx.close(); }
 console.log(out.join('\n')); await b.close(); })();
