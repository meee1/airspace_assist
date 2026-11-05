// chart underlay at 56 NM on a Pixel 9 (classic + full screen): does the cache keep repainting (tile thrash) and does the picture flip?
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); for(const fs of [false,true]){ const ctx=await b.newContext({...PX9}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(v=>{ try{ localStorage.setItem('rc_fsMap',v); localStorage.setItem('rc_mapRange','56'); }catch(e){} }, String(fs));
 await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=090&gs=0'); await p.waitForFunction(()=>typeof render==='function');
 await p.evaluate(()=>{ MAP.range=56; render(); });
 const hs=[]; for(let i=0;i<14;i++){ await p.waitForTimeout(700); hs.push(await p.evaluate(()=>{ const c={}; for(const v of CH.imgs.values()){ const k=typeof v==='string'?v:'img'; c[k]=(c[k]||0)+1; } const g=$('map').getContext('2d').getImageData(0,0,$('map').width,$('map').height).data; let h=0; for(let i=0;i<g.length;i+=4097) h=(h*31+g[i])|0; return {n:CHC.n,imgs:c.img||0,load:c.loading||0,none:c.none||0,h,range:MAP.range,dirty:CHC.dirty}; })); }
 console.log(fs?'full screen':'classic', hs.map(x=>`rep${x.n} img${x.imgs}/ld${x.load} h${(x.h>>>0)%1000}`).join(' · '), 'range', hs[0].range, errs);
 await ctx.close(); } await b.close(); })();
