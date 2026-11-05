// 3D view window: opens from Options, renders terrain + layers in each camera and surface, no errors; screenshots
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch({args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']}); const ctx=await b.newContext({...PX9,deviceScaleFactor:2}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); });
 await p.addInitScript(()=>{ try{ localStorage.setItem('rc_chartSel',JSON.stringify(['ML-VNC','ML-VTC','WAC-3470','WAC-3469'])); }catch(e){} });
 const pos=process.env.POS||'-38.05,144.3', alt=process.env.ALT||'1500';
 await p.goto(`http://localhost:8811/index.html?sim=YBRS&alt=${alt}&trk=060&gs=0`); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(1500);
 await p.evaluate(([pos])=>{ $('simPos').value=pos; simApply(); MAP.range=20; const ap=i=>{ const x=DATA.ap.find(y=>y.i===i); return {n:i,c:i,la:x.la,lo:x.lo}; }; fpSet({name:'T',pts:['YBRS','YMMB','YLIL'].map(ap),i:1}); render(); },[pos]);
 await p.evaluate(()=>{ $('optV3d').checked=true; $('optV3d').dispatchEvent(new Event('change')); });
 await p.waitForTimeout(4000);
 console.log('gl', await p.evaluate(()=>!!V3.gl), 'msg', await p.evaluate(()=>$('v3dMsg').textContent), 'walls', await p.evaluate(()=>V3.nW), 'lines', await p.evaluate(()=>V3.nL), 'labels', await p.evaluate(()=>V3.lab&&V3.lab.map(l=>l[3]).join(',')), 'fp', await p.evaluate(()=>FP&&FP.pts.length), 'tex', await p.evaluate(()=>V3.texDrew));
 const win=await p.$('#v3dWin'); const shots=[];
 for(const [cam,surf] of [['cockpit','chart'],['chase','chart'],['orbit','relief'],['cockpit','relief']]){
   await p.evaluate(([cam,surf])=>{ V3.opt.cam=cam; V3.opt.surf=surf; V3.texKey=''; v3dResetView(); if(cam==='orbit'){ V3.view.dist=25000; V3.view.pitch=-30; } },[cam,surf]); await p.waitForTimeout(2500);
   const f=`/tmp/claude-0/v3d_${cam}_${surf}.png`; await win.screenshot({path:f}); shots.push(f); }
 console.log(errs.slice(0,5)); await b.close(); })();
