// 3D view: dragging the view doesn't rebuild the scene; the GPU context lost and restored -> it draws again
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch({args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']}); const ctx=await b.newContext({...PX9}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YBRS&alt=1500&trk=060&gs=0'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(1200);
 await p.evaluate(()=>{ MAP.range=20; v3dShow(true); }); await p.waitForTimeout(3000);
 console.log(await p.evaluate(async()=>{ let n=0; const o=v3dScene; window.v3dScene=function(...a){ n++; return o.apply(this,a); }; let f=0; const of=v3dFrame;
   for(let i=0;i<30;i++){ V3.view.yaw+=2; V3.key=''; v3dFrame(); f++; }
   window.v3dScene=o; return `30 view changes -> ${n} scene rebuilds`; }));
 console.log(await p.evaluate(()=>{ const t0=performance.now(); for(let i=0;i<200;i++) v3dCss('--as-c'); return '200 colour lookups '+(performance.now()-t0).toFixed(1)+' ms'; }));
 const px=()=>p.evaluate(()=>{ const gl=V3.gl; V3.key=''; v3dFrame(); const a=new Uint8Array(4); gl.readPixels(gl.drawingBufferWidth/2,10,1,1,gl.RGBA,gl.UNSIGNED_BYTE,a); return [...a].join(','); });
 console.log('before loss pixel', await px());
 await p.evaluate(()=>{ window.__lc=V3.gl.getExtension('WEBGL_lose_context'); __lc.loseContext(); }); await p.waitForTimeout(500);
 console.log('lost:', await p.evaluate(()=>V3.lost), '· frame while lost throws?', await p.evaluate(()=>{ try{ V3.key=''; v3dFrame(); return 'no'; }catch(e){ return e.message; } }));
 await p.evaluate(()=>__lc.restoreContext()); await p.waitForTimeout(2500);
 console.log('restored:', await p.evaluate(()=>!V3.lost&&!!V3.gl&&!!V3.grid), '· pixel', await px(), '· msg', await p.evaluate(()=>$('v3dMsg').textContent||'none'));
 console.log(errs); await b.close(); })();
