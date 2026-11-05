// tile-cache thrash: with the tile cache nearly full of other tiles, the chart picture must settle (no endless rebuilds / flicker)
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); for(const [port,tag] of [[8811,'this build'],[+(process.env.OLD||0),'old build']]){ if(!port) continue;
 const ctx=await b.newContext({...PX9}); const p=await ctx.newPage();
 await p.addInitScript(()=>{ try{ localStorage.setItem('rc_fsMap','true'); localStorage.setItem('rc_mapRange','56'); }catch(e){} });
 await p.goto(`http://localhost:${port}/index.html?sim=YMMB&alt=1500&trk=090&gs=0`); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(4000);
 const r=await p.evaluate(async()=>{ const n0=CHC.n; for(let i=0;i<175;i++) CH.imgs.set('x/'+i,{width:1,close(){}});   // other tiles, newer than the picture's
   MAP.range=40; render(); await new Promise(r=>setTimeout(r,300)); MAP.range=56; render();   // zoom away and back: the picture is rebuilt with the cache full
   const hs=[]; for(let i=0;i<12;i++){ await new Promise(r=>setTimeout(r,500)); hs.push(CHC.n); } return 'rebuilds over 6 s after the zoom: '+(hs[11]-hs[0])+' ('+hs.join(',')+')'; });
 console.log(tag.padEnd(11), r); await ctx.close(); } await b.close(); })();
