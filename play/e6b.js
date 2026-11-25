// Flight computer (24 Nov 2026, Michael: E6B for training; mock-ups A, B, C; "Build all three, dark theme").
// node play/e6b.js   (app on :8811)
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(), errs=[], fail=[]; const ok=(c,m)=>{ console.log((c?'ok   ':'FAIL ')+m); if(!c) fail.push(m); };
  const ctx=await b.newContext({...PX9,storageState:{cookies:[],origins:[{origin:'http://localhost:8811',localStorage:[{name:'rc_fsMap',value:'false'},{name:'rc_pcGs',value:'90'},{name:'rc_pcBurn',value:'100'},{name:'rc_pcWsrc',value:'"set"'},{name:'rc_pcWind',value:'{"dir":270,"kt":15}'}]}]}});
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'&&st.pos);
  await p.evaluate(()=>$('bE6b').click()); await p.waitForTimeout(300);
  ok(await p.evaluate(()=>$('e6bDlg').open&&!$('e6bComp').hidden),'More → Flight computer opens on the computer side');
  // computer side: 60 under 110 -> 55 NM over 30 min, 38.5 NM over 21 min
  let r=await p.evaluate(()=>{ const C=E6.comp; C.setIndex(110); const o=[]; for(const d of [55,38.5]){ C.cur=e6L(d); C.draw(); o.push(e6V(C.cur-C.rot)); } return {idx:C.idx(), t:o, rd:$('e6bCompRd').innerText}; });
  ok(Math.abs(r.idx-11)<0.01&&Math.abs(r.t[0]-30)<0.05&&Math.abs(r.t[1]-21)<0.05,`slide rule: 60 under 11.0 → 55 over ${r.t[0].toFixed(1)}, 38.5 over ${r.t[1].toFixed(1)} (readout ${r.rd.replace(/\n/g,' ')})`);
  await p.locator('#e6bDlg').screenshot({path:__dirname+'/e6b_comp.png'});
  // drag the disc a quarter turn
  const sv=await p.locator('#e6bCompSvg').boundingBox(); const cx=sv.x+sv.width/2, cy=sv.y+sv.height/2, k=sv.width/390;
  const r0=await p.evaluate(()=>E6.comp.rot);
  await p.mouse.move(cx, cy-100*k); await p.mouse.down(); await p.mouse.move(cx+70*k, cy-70*k,{steps:4}); await p.mouse.move(cx+100*k, cy,{steps:4}); await p.mouse.up();
  const r1=await p.evaluate(()=>E6.comp.rot); ok(Math.abs(((r1-r0+540)%360)-180-90)<4,`dragging the disc turns it (${r0.toFixed(1)} → ${r1.toFixed(1)}°)`);
  // wind side: TC 157, TAS 90, wind 270/15 -> windTri
  await p.evaluate(()=>e6Tab('wind'));
  r=await p.evaluate(()=>{ const W=E6.wind; W.solve(157,90,270,15); const q=W.dots[0], g=W.dotGrid(q), w=W.dotWind(q), T=windTri(157,90,270,15); return {G:W.G, arc:g.arc, drift:g.drift, wd:w.dir, wk:w.kt, gs:T.gs, wca:T.wca, rd:$('e6bWindRd').innerText}; });
  ok(Math.abs(r.arc-90)<0.01&&Math.abs(r.G-r.gs)<0.3&&Math.abs(r.drift-r.wca)<0.3&&Math.abs(r.wd-270)<0.01&&Math.abs(r.wk-15)<0.01,`wind side agrees with the wind triangle: GS ${r.G.toFixed(1)} (${r.gs.toFixed(1)}), drift ${r.drift.toFixed(1)}° (${r.wca.toFixed(1)}°)`);
  await p.locator('#e6bDlg').screenshot({path:__dirname+'/e6b_wind.png'});
  // pencil: mark tool then a tap 20 kt above the grommet with 000 under the index -> wind 360/20
  await p.evaluate(()=>{ const W=E6.wind; W.dots=[]; W.rotP=0; W.G=100; W.draw(); }); await p.click('#e6bWind [data-w="mark"]');
  const ws=await p.locator('#e6bWindSvg').boundingBox(), kw=ws.width/390, gx=ws.x+195*kw, gy=ws.y+235*kw;
  await p.mouse.click(gx, gy-20*(140/60)*kw);
  r=await p.evaluate(()=>{ const q=E6.wind.dots[0]; return q&&E6.wind.dotWind(q); });
  ok(r&&Math.abs(r.kt-20)<0.6&&(r.dir<2||r.dir>358),`✎ Mark: a tap 20 kt up marks wind ${r&&r.dir.toFixed(0)}° / ${r&&r.kt.toFixed(1)} kt`);
  // turning the ring
  await p.mouse.move(gx, gy-155*kw); await p.mouse.down(); await p.mouse.move(gx+155*kw, gy,{steps:6}); await p.mouse.up();
  r=await p.evaluate(()=>E6.wind.rotP); ok(Math.abs(r-270)<7,`turning the ring a quarter clockwise puts ${r.toFixed(0)}° under the index`);
  // problems: random wind problem, Show me -> steps done, the right answer checks
  await p.evaluate(()=>{ $('e6bPSrc').value='rand'; $('e6bPType').value='wind'; e6Tab('prob'); e6New(); });
  r=await p.evaluate(()=>{ e6Show(); const P=E6P.p, set=(k,v)=>{ $('e6bPAns').querySelector(`input[data-k="${k}"]`).value=v; };
    const steps=[...$('e6bPSteps').children].map(d=>d.className); set('hdg',P.hdg); set('gs',Math.round(P.gs)); set('wca',(P.wca>=0?'R':'L')+Math.abs(Math.round(P.wca))); e6Check(); return {steps, res:$('e6bPRes').innerText, sc:E6P.sc}; });
  ok(r.steps.slice(0,4).every(c=>c==='ok')&&/Right/.test(r.res)&&r.sc.ok>=1,`wind problem: Show me ticks steps 1-4, the right answer checks (${r.res.slice(0,70)})`);
  await p.locator('#e6bDlg').screenshot({path:__dirname+'/e6b_prob.png'});
  r=await p.evaluate(()=>{ e6New(); const P=E6P.p, set=(k,v)=>{ $('e6bPAns').querySelector(`input[data-k="${k}"]`).value=v; }; set('hdg',(P.hdg+10)%360); set('gs',Math.round(P.gs)); set('wca','R1'); e6Check(); return {res:$('e6bPRes').innerText, bad:[...$('e6bPAns').querySelectorAll('label.bad')].map(l=>l.dataset.k)}; });
  ok(/Not quite/.test(r.res)&&r.bad.includes('hdg'),'a wrong heading is marked wrong ('+r.bad.join(',')+')');
  // time and fuel problems
  for(const t of ['tsd','fuel']){ r=await p.evaluate(t=>{ $('e6bPType').value=t; e6New(); e6Show(); const P=E6P.p, steps=[...$('e6bPSteps').children].map(d=>d.className), k=t==='tsd'?'min':'fuel', v=t==='tsd'?P.min:P.fuel;
      $('e6bPAns').querySelector(`input[data-k="${k}"]`).value=(v*1.01).toFixed(1); e6Check(); return {steps, res:$('e6bPRes').innerText, txt:$('e6bPCard').innerText, idx:E6.pc.idx()}; },t);
    ok(r.steps.slice(0,2).every(c=>c==='ok')&&/Right/.test(r.res),`${t}: Show me ticks the steps, 1% off still right · ${r.txt.split('\n').slice(-1)[0].slice(0,70)}`); }
  // from the plan: the YBRS legs with Plan check's wind
  await p.setInputFiles('#fpFile',__dirname+'/fixtures/ybrs.gpx'); await p.waitForFunction(()=>FP&&FP.pts.length>5);
  r=await p.evaluate(()=>{ $('e6bPSrc').value='plan'; $('e6bPType').value='wind'; E6P.legI=0; e6New(); return {card:$('e6bPCard').innerText, P:E6P.p}; });
  ok(r.P.plan&&r.P.pw&&r.P.wd===270&&r.P.wk===15&&r.P.tas===90&&/Leg YBRS → NAV2/.test(r.card),`from the plan: ${r.card.replace(/\n/g,' ').slice(0,110)}`);
  await p.evaluate(()=>{ document.documentElement.dataset.theme='light'; }); await p.waitForTimeout(100);
  const bg=await p.evaluate(()=>getComputedStyle($('e6bDlg')).backgroundColor); ok(bg==='rgb(13, 20, 23)','dark even with the light theme ('+bg+')');
  // ✕ closes it (26 Nov 2026, Michael: "The flight computer cross to exit isn't working": its handler had been commented out)
  await p.evaluate(()=>{ document.documentElement.dataset.theme=''; if(!$('e6bDlg').open) $('bE6b').click(); }); await p.waitForTimeout(200);
  await p.locator('#e6bClose').click(); await p.waitForTimeout(200); ok(await p.evaluate(()=>!$('e6bDlg').open),'✕ closes the flight computer');
  console.log(fail.length? fail.length+' FAILED':'all passed'); console.log(errs); await b.close(); process.exit(fail.length?1:0); })();
