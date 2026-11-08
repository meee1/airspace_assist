// Measure (map button): taps add points (aerodromes snap), legs with NM and °M, total and time at GS, From me, Undo, Clear,
// Done; "Measure from" in the press-and-hold menu; dragging still pans. Classic layout and full screen.
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const errs=[];
 for(const fs of [false,true]){ const ctx=await b.newContext({...PX9,deviceScaleFactor:2,storageState:{cookies:[],origins:[{origin:'http://localhost:8811',localStorage:[{name:'rc_fsMap',value:String(fs)}]}]}});
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8811/index.html?sim=YBRS&alt=1500&trk=045&gs=90'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(700);
  await p.evaluate(()=>{ MAP.range=40; MAP.up='north'; CH.on=false; render(); }); await p.waitForTimeout(300);
  await p.evaluate(()=>$('mapMeas').click()); await p.waitForTimeout(200);
  const box=await (await p.$('#map')).boundingBox(); const at=async(la,lo)=>{ const [x,y]=await p.evaluate(([la,lo])=>MAP.P(la,lo),[la,lo]); return [box.x+x,box.y+y]; };
  const tap=async(la,lo)=>{ const [x,y]=await at(la,lo); await p.mouse.click(x,y); await p.waitForTimeout(150); };
  const ymmb=await p.evaluate(()=>{ const a=DATA.ap.find(x=>x.i==='YMMB'); return [a.la,a.lo]; }), ymav=await p.evaluate(()=>{ const a=DATA.ap.find(x=>x.i==='YMAV'); return [a.la,a.lo]; });
  console.log(fs?'FULL SCREEN':'CLASSIC', '· start:', await p.evaluate(()=>$('measTxt').innerText));
  await tap(ymav[0]+0.003,ymav[1]+0.003); await tap(...ymmb);
  console.log('  YMAV → YMMB:', await p.evaluate(()=>$('measTxt').innerText.replace(/\n/g,' | ')), '· check', await p.evaluate(()=>{ const a=DATA.ap.find(x=>x.i==='YMAV'), c=DATA.ap.find(x=>x.i==='YMMB'), [d,br]=distBrg(a.la,a.lo,c.la,c.lo); return d.toFixed(1)+' NM '+Math.round((br-variation(a.la,a.lo)+360)%360)+'°M'; }));
  await tap(-38.12,144.85);
  console.log('  + a point:', await p.evaluate(()=>$('measTxt').innerText.replace(/\n/g,' | ')));
  // drag pans, doesn't add a point
  const [cx,cy]=[box.x+box.width/2,box.y+box.height/2]; await p.mouse.move(cx,cy); await p.mouse.down(); await p.mouse.move(cx+40,cy+20,{steps:4}); await p.mouse.move(cx+80,cy+40,{steps:4}); await p.mouse.up(); await p.waitForTimeout(150);
  console.log('  drag: points still', await p.evaluate(()=>MEAS.pts.length), '· panned', await p.evaluate(()=>!!MAP.pan));
  await p.click('#measUndo'); console.log('  undo: points', await p.evaluate(()=>MEAS.pts.length));
  if(!fs){ await p.evaluate(()=>{ MAP.pan=null; render(); }); await p.waitForTimeout(200); const m=await p.$('#map'); await m.scrollIntoViewIfNeeded(); await p.screenshot({path:'play/measure.png'}); }
  else await p.screenshot({path:'play/measure_fs.png'});
  await p.click('#measFrom'); await tap(-38.05,144.6); console.log('  from me → a point:', await p.evaluate(()=>$('measTxt').innerText.replace(/\n/g,' | ')));
  await p.click('#measDone'); console.log('  done: box hidden', await p.evaluate(()=>$('measBox').hidden), '· a tap now does Go to:', await (async()=>{ await tap(...ymav); return p.evaluate(()=>GO&&GO.c); })());
  if(!fs){ await p.evaluate(([la,lo])=>{ const [x,y]=MAP.P(la,lo); mapMenu(x,y); },ymmb); const items=await p.evaluate(()=>[...document.querySelectorAll('#mapMenu button')].map(b=>b.textContent).filter(t=>/Measure/.test(t)));
    console.log('  map menu:', JSON.stringify(items)); await p.evaluate(()=>[...document.querySelectorAll('#mapMenu button')].find(b=>/Measure/.test(b.textContent)).click());
    console.log('  → measuring from', await p.evaluate(()=>MEAS.on+' '+MEAS.pts.map(q=>q.n).join(','))); }
  await ctx.close(); }
 console.log(errs); await b.close(); })();
