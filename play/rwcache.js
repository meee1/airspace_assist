// Runways list + diagram cache: cached image equals a fresh draw; aerodrome change, theme change and a resize all redraw
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({...PX9}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{ try{ localStorage.setItem('rc_fsMap','false'); }catch(e){} });
 await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=090&gs=90'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(1500);
 const img=()=>p.evaluate(()=>$('adMap').toDataURL());
 const fresh=()=>p.evaluate(()=>{ RWC.key=''; render(); return $('adMap').toDataURL(); });
 for(let i=0;i<8;i++){ await p.evaluate(()=>{ st.pos=[st.pos[0],st.pos[1]+0.0007]; render(); }); }
 const c=await img(); console.log('after moves: cached == fresh', c===await fresh());
 const l0=await p.evaluate(()=>$('rwList').innerText.split('\n')[0]);
 await p.evaluate(()=>{ $('simPos').value='-38.039,144.469'; simApply(); render(); }); await p.waitForTimeout(300);
 console.log('moved to Avalon: list', l0,'→', await p.evaluate(()=>$('rwList').innerText.split('\n')[0]), '· cached == fresh', (await img())===await fresh());
 const d0=await img(); await p.evaluate(()=>{ document.documentElement.setAttribute('data-theme', document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark'); render(); });
 const d1=await img(); console.log('theme change redrew', d0!==d1, '· == fresh', d1===await fresh());
 await p.setViewportSize({width:700,height:900}); await p.waitForTimeout(400); const e1=await img();
 console.log('resize: canvas', await p.evaluate(()=>$('adMap').width+'x'+$('adMap').height+' css '+RWC.W+'x'+RWC.H), '· == fresh', e1===await fresh());
 console.log(errs); await b.close(); })();
