// Michael's tablet (TAB in px9.js: 1470x970 CSS px @1.5, landscape): classic and full-screen layouts, with a flight plan,
// fuel row and measure on. Checks the tablet layout is used, nothing scrolls sideways and the map fills the space; screenshots.
const {chromium}=require('playwright'); const {TAB}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const errs=[];
 for(const fs of [false,true]){ const ctx=await b.newContext({...TAB,storageState:{cookies:[],origins:[{origin:'http://localhost:8811',localStorage:[{name:'rc_fsMap',value:String(fs)},{name:'rc_fuel',value:JSON.stringify({fob:250,burn:100,run:600e3,on:true,t1:Date.now(),auto:false,rem:0})}]}]}});
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8811/index.html?sim=YBRS&alt=1500&trk=045&gs=90'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(800);
  await p.setInputFiles('#fpFile',__dirname+'/fixtures/ybrs.gpx'); await p.waitForFunction(()=>FP); await p.evaluate(()=>{ MAP.range=20; render(); }); await p.waitForTimeout(1500);
  const r=await p.evaluate(()=>{ const m=$('map').getBoundingClientRect(); return {cls:document.body.className, sideways:document.documentElement.scrollWidth>innerWidth+1, map:`${Math.round(m.width)}x${Math.round(m.height)}`, vw:innerWidth+'x'+innerHeight+' @'+devicePixelRatio}; });
  console.log(fs?'full screen':'classic', JSON.stringify(r));
  await p.screenshot({path:`play/tab1470_${fs?'fs':'classic'}.png`}); await ctx.close(); }
 console.log(errs); await b.close(); })();
