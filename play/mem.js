// Memory line in the Render timing panel and its Copy text (20 Nov 2026, Michael: "Can we see memory usage?").
// node play/mem.js   (app on :8811)
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(), errs=[], fail=[]; const ok=(c,m)=>{ console.log((c?'ok   ':'FAIL ')+m); if(!c) fail.push(m); };
  const ctx=await b.newContext({...PX9,storageState:{cookies:[],origins:[{origin:'http://localhost:8811',localStorage:[{name:'rc_fsMap',value:'false'},{name:'rc_perfOn',value:'true'}]}]}});
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=000&gs=90'); await p.waitForFunction(()=>typeof render==='function'&&st.pos);
  await p.waitForFunction(()=>$('pfMem')&&/stored/.test($('pfMem').textContent),null,{timeout:20000});
  const t=await p.evaluate(()=>$('pfMem').textContent); console.log('     '+t);
  ok(/^Memory: page JS heap \d+ MB \(allocated \d+ MB, limit [\d.]+ (MB|GB)\)/.test(t)&&/stored [\d.]+ (MB|GB) of/.test(t),'panel shows the heap and storage');
  ok(!/speech model/.test(t),'no speech model line while it isn\'t loaded');
  ok(/^Memory: page JS heap/m.test(await p.evaluate(()=>pfText())),'in the Copy text');
  console.log(fail.length? fail.length+' FAILED':'all passed'); console.log(errs); await b.close(); process.exit(fail.length?1:0); })();
