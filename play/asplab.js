// airspace label spots: first frame same as a fresh search; while moving, labels keep their spot and every one that a fresh search places is drawn
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({...PX9}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{ try{ localStorage.setItem('rc_fsMap','false'); }catch(e){} });
 await p.goto('http://localhost:8811/index.html?sim=YSSY&alt=1500&trk=090&gs=90'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(1500);
 await p.evaluate(()=>{ CH.on=false; MAP.range=20; render(); });
 const m=await p.$('#map'); await m.scrollIntoViewIfNeeded();
 for(let i=0;i<15;i++){ await p.evaluate(()=>{ st.pos=[st.pos[0]+0.001,st.pos[1]+0.002]; render(); }); }
 const a=await p.evaluate(()=>$('map').toDataURL()); await m.screenshot({path:'asplab_cached.png'});
 const b2=await p.evaluate(()=>{ MAP.lab=new Map(); drawMap(...MAP.last); return $('map').toDataURL(); }); await m.screenshot({path:'asplab_fresh.png'});
 console.log('cached spots == fresh search', a===b2);
 console.log(errs); await b.close(); })();
