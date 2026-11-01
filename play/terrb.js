// rainbow topographic terrain (Options): grey relief vs rainbow; above-you hatching
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const p=await (await b.newContext(PX9)).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YMBT&alt=4500&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(800);
 for(const [n,rb] of [['grey',false],['rainbow',true]]){
  await p.evaluate(rb=>{ ls.set('terRainbow',rb); $('optTerRainbow').checked=rb; CH.on=false; MAP.ter=true; MAP.ctaf=false; MAP.range=20; MAP.up='north'; MAP.pan=null; legUI(); render(); },rb);
  await p.waitForFunction(()=>TER.busy.size===0,{timeout:20000}).catch(()=>{}); await p.waitForTimeout(2500); await p.evaluate(()=>render()); await p.waitForTimeout(500);
  const m=await p.$('#mapSec'); await m.screenshot({path:`play/terrb_${n}.png`}); console.log(n, await p.evaluate(()=>TER.tiles.size+' tiles, legend '+(!$('terRbLeg').hidden))); }
 await p.click('#bOpts'); await p.waitForTimeout(300); const o=await p.$('#optTerRainbow'); await o.scrollIntoViewIfNeeded(); await p.screenshot({path:'play/terrb_opts.png'});
 console.log(errs); await b.close(); })();
