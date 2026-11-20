// A track/distance box on each flight-plan leg, like the one on the line to the selected aerodrome (21 Nov 2026, Michael).
// YBRS plan: every leg on screen at 80 NM has a box with the magnetic track (fmt3 of bearing - variation at its start) and
// distance; a coast leg has one "coast/n NM" box. node play/legbox.js  (app on :8811)
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(), errs=[], fail=[]; const ok=(c,m)=>{ console.log((c?'ok   ':'FAIL ')+m); if(!c) fail.push(m); };
  const ctx=await b.newContext({...PX9,storageState:{cookies:[],origins:[{origin:'http://localhost:8811',localStorage:[{name:'rc_fsMap',value:'true'},{name:'rc_mapCharts',value:'false'}]}]}});
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8811/index.html?sim=-38.10,144.70&alt=1500&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'&&st.pos);
  await p.setInputFiles('#fpFile',__dirname+'/fixtures/ybrs.gpx'); await p.waitForFunction(()=>FP&&FP.pts.length>5);
  // record what brgBox draws
  await p.evaluate(()=>{ window.__bx=[]; const f=brgBox; window.brgBox=brgBox=(...a)=>{ __bx.push({lab:a[4],ang:a[3]}); return f(...a); }; });
  await p.evaluate(()=>{ MAP.range=20; MAP.up='north'; MAP.pan=[-38.02,145.05]; render(); }); await p.waitForTimeout(500);
  const r=await p.evaluate(()=>{ __bx=[]; render(); const exp=[]; for(let k=0;k+1<FP.pts.length;k++){ const a=FP.pts[k], q=FP.pts[k+1], d=distBrg(a.la,a.lo,q.la,q.lo); exp.push(`${fmt3(d[1]-variation(a.la,a.lo))}°/${d[0]<9.95?d[0].toFixed(1):Math.round(d[0])}NM`); } return {got:__bx.map(x=>x.lab), exp}; });
  console.log('     drawn: '+r.got.join('  '));
  const legs=r.got.filter(l=>r.exp.includes(l));
  ok(legs.length>=4,`${legs.length} leg boxes match the legs' track and distance (${legs.join(', ')})`);
  ok(r.got.every(l=>r.exp.includes(l)||!/NM$/.test(l)||/^\d{3}°\/\d+NM$/.test(l)),'nothing else odd drawn');
  await p.screenshot({path:__dirname+'/legbox_20.png'});
  // a coast leg: one box for it
  const c=await p.evaluate(async()=>{ ls.set('coastOff',500); ls.set('coastGap',2); COAST.off=500; COAST.gap=2; fpSet({name:'t',kind:'map',pts:[fpPt(findPoint('YBRS')),fpPt(findPoint('YMMB'))],i:1}); await fpCoastSet(FP.pts[1],true); __bx=[]; MAP.range=40; MAP.pan=[-38.15,144.75]; render(); return {n:FP.pts.filter(q=>q.cg).length, labs:__bx.map(x=>x.lab)}; });
  ok(c.n>10&&c.labs.filter(l=>/^coast\//.test(l)).length===1,`coast leg (${c.n} turn points): one box ${c.labs.find(l=>/^coast/.test(l))}`);
  await p.screenshot({path:__dirname+'/legbox_coast.png'});
  console.log(fail.length? fail.length+' FAILED':'all passed'); console.log(errs); await b.close(); process.exit(fail.length?1:0); })();
