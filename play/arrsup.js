// AIP SUPs, AIRAC changes, arrival card, power lines/obstacles on the side view, profile and brief (25 Nov 2026, Michael chose
// suggestions 9, 10, 11, 12). node play/arrsup.js (app on :8811; uses app/powerlines.json and play/fixtures/naips_obst.txt)
const {chromium}=require('playwright'); const {PX9}=require('./px9.js'); const fs=require('fs');
(async()=>{ const b=await chromium.launch(), errs=[], fail=[]; const ok=(c,m)=>{ console.log((c?'ok   ':'FAIL ')+m); if(!c) fail.push(m); };
  const ctx=await b.newContext({...PX9,storageState:{cookies:[],origins:[{origin:'http://localhost:8811',localStorage:[{name:'rc_fsMap',value:'false'},{name:'rc_airacTest',value:'true'},{name:'rc_mapSide',value:'true'}]}]}});
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'&&st.pos);
  // 9. SUPs
  let r=await p.evaluate(()=>{ render(); const a=DATA.ap.find(x=>x.i==='YMMB'), L=supFor(a), el=$('adSup');
    return {n:SUPS.items.length, sum:SUPS.summary, L:L.map(x=>x.id), card:!el.hidden&&el.textContent, menu:(()=>{ mapMenu(200,200); const t=$('mapMenu').innerText; $('mapMenu').hidden=true; return t; })(),
      loc:['H43/26','H125/26','H149/26','H137/26'].map(id=>{ const x=SUPS.items.find(y=>y.id===id); const L_=supLoc(x); return id+':'+(L_?L_.how:'general'); }) }; });
  ok(r.n===61&&r.sum==='26 NOV 2026'&&r.L.join()==='H62/26'&&/SUP H62\/26[\s\S]*Obstacle Infringements[\s\S]*airservicesaustralia\.com/.test(r.card),`SUP H62/26 on the Moorabbin card (${r.n} items in the ${r.sum} summary)`);
  ok(r.loc.join()==='H43/26:place,H125/26:area,H149/26:place,H137/26:general',`placed: ${r.loc.join(' ')}`);
  // 10. AIRAC changes: the dialog, the filters, the one-time notice
  await p.evaluate(()=>airacOpen()); await p.waitForFunction(()=>AIRAC.d&&$('airacBody').innerText.length>20);
  r=await p.evaluate(()=>{ const near=$('airacBody').textContent; $('airacF').querySelector('[data-f="all"]').click(); const all=$('airacBody').textContent; return {head:$('airacHead').textContent, near, all, n:AIRAC.d.items.length}; });
  ok(/ERSA 03 SEP 2026[\s\S]*ERSA 26 NOV 2026/.test(r.head)&&/YBSS[\s\S]*circuits none → 01 RH/.test(r.near)&&r.all.length>r.near.length&&/VFR waypoints \(\d+\)/.test(r.all),`AIRAC changes 03 SEP → 26 NOV: ${r.n} in all; near Moorabbin: ${r.near.split('\n').filter(l=>/:/.test(l)).slice(0,2).join(' | ')}`);
  await p.locator('#airacDlg').screenshot({path:__dirname+'/arrsup_airac.png'}); await p.evaluate(()=>$('airacDlg').close());
  await p.evaluate(()=>{ ls.set('airacSeen',''); airacNotice(); }); await p.waitForFunction(()=>!$('airacBar').hidden,null,{timeout:8000}).catch(()=>{});
  r=await p.evaluate(()=>({bar:!$('airacBar').hidden&&$('airacGo').textContent})); await p.evaluate(()=>$('airacX').click());
  r.seen=await p.evaluate(()=>{ airacNotice(); return {seen:ls.get('airacSeen'), hidden:$('airacBar').hidden}; });
  ok(/AIRAC 26 NOV 2026: \d+ changes? near you/.test(r.bar)&&r.seen.seen&&r.seen.hidden,`notice "${r.bar}", dismissed once and not shown again`);
  // 11. arrival card, with an ATIS heard (wind 340/15 magnetic) and a plan to YMMB
  await p.evaluate(()=>{ ATIS.YMMB={l:'B',q:1013,t:Date.now(),heard:Date.now(),f:{info:'B',wind:'340°/15 kt',qnh:1013}}; st.gs=100; st.pos=[-37.80,145.05]; arrOpen(DATA.ap.find(a=>a.i==='YMMB')); });
  r=await p.evaluate(()=>{ const t=$('arrBody').textContent, best=$('arrBody').querySelector('tr.best'); return {t, best:best&&best.innerText.replace(/\s+/g,' ')}; });
  ok(/ATIS\s*120\.9\s*listen first \(you have Bravo\)/.test(r.t)&&/TWR West\s*123\.0\s*Moorabbin Tower/.test(r.t)&&/Squawk 3000/.test(r.t)&&/wind 340°M 15 kt \(ATIS B heard/.test(r.t)&&/^35[LR] ✓ head 1[45]/.test(r.best)&&/ETA \d{4}Z/.test(r.t),`arrival card: frequencies in order, squawk, wind from the ATIS heard, best runway "${r.best}"`);
  await p.locator('#arrDlg').screenshot({path:__dirname+'/arrsup_arrival.png'}); await p.evaluate(()=>$('arrDlg').close());
  await p.evaluate(()=>{ INB.on='YMMB'; INB.kind='inb'; INB.t=Date.now(); INB.man=true; inboundUI(); });
  r=await p.evaluate(()=>{ const btn=$('sInbound').querySelector('[data-arr]'); if(!btn) return {btn:false}; btn.click(); return {btn:true, open:$('arrDlg').open, row:!$('sInbound').hidden}; });
  ok(r.btn&&r.open&&r.row,'inbound call row: "Arrival card" opens it and the row stays');
  await p.evaluate(()=>$('arrDlg').close());
  // 12. power lines and obstacles: brief, side view, profile (briefing with an obstacle on the route)
  await p.setInputFiles('#fpFile',__dirname+'/fixtures/ybrs.gpx'); await p.waitForFunction(()=>FP&&FP.pts.length>5);
  await p.waitForFunction(()=>{ plLoad(); return !!PL.d; },null,{timeout:15000,polling:300});
  r=await p.evaluate(()=>{ const P_=FP.pts, cum=[0]; for(let k=1;k<P_.length;k++) cum.push(cum[k-1]+distBrg(P_[k-1].la,P_[k-1].lo,P_[k].la,P_[k].lo)[0]);
    const hz=pathHaz(P_.map((p,k)=>[p.la,p.lo,cum[k]]),0.5);
    // independent check of the first crossing: the line and the leg really cross there (point on both within 50 m)
    const w=hz.W[0], xy=PL.d.L[w.k].xy; let dl=1e9; for(let i=0;i<xy.length-2;i+=2) dl=Math.min(dl,segDist(xy[i+1],xy[i],xy[i+3],xy[i+2],w.la,w.lo)[0]);
    const s=w.seg, dleg=segDist(P_[s-1].la,P_[s-1].lo,P_[s].la,P_[s].lo,w.la,w.lo)[0];
    return {nW:hz.W.length, dl:dl*1852, dleg:dleg*1852, D:w.D, kv:w.kv}; });
  ok(r.nW>5&&r.dl<50&&r.dleg<50,`plan route crosses ${r.nW} power lines; the first (${r.kv} kV at ${r.D.toFixed(1)} NM) is on both the line (${r.dl.toFixed(0)} m) and the leg (${r.dleg.toFixed(0)} m)`);
    // a NOTAM obstacle 0.2 NM off the first leg (no NAIPS fixture with one: ntObstacles stands in, as the briefing would give it)
  r=await p.evaluate(()=>{ const a=FP.pts[0], b2=FP.pts[1], la=(a.la+b2.la)/2+0.2/60, lo=(a.lo+b2.lo)/2; const o={n:{id:'C999/26'}, la, lo, ft:1400, hAgl:null, lit:true, what:'crane'};
    window.ntObstacles=()=>[o]; PROF=null;
    const X=hazBrief(o.ft-200); return {o:{ft:o.ft,what:o.what}, html:X.html, txt:X.txt}; });
  ok(r&&/▲/.test(r.html)&&new RegExp(r.o.ft.toLocaleString('en-AU')+' ft AMSL').test(r.html)&&/class="w"/.test(r.html)&&/above you/.test(r.html),`brief: NOTAM obstacle ${r&&r.o.what} ${r&&r.o.ft} ft on the route, flagged red at 200 ft below it`);
  await p.evaluate(()=>{ $('fpCheck').onclick(); }); await p.waitForTimeout(800);
  r=await p.evaluate(()=>{ const s=[...$('pcOut').querySelectorAll('.pc-sec')].map(e=>e.textContent); return {pl:s.find(x=>/Power lines and obstacles/.test(x)), sup:s.find(x=>/AIP Supplements/.test(x)), copy:/Power lines and obstacles/.test(PC.text)&&/AIP SUP\/AIC/.test(PC.text)}; });
  ok(r.pl&&r.sup&&r.copy,`Pre-flight brief sections: "${r.pl}" and "${r.sup}", both in Copy text`);
  await p.evaluate(()=>$('pcDlg').close());
  // side view: fly the plan's first leg; marks drawn and the caption names the next line
  await p.evaluate(()=>{ FP.i=1; st.pos=[FP.pts[0].la,FP.pts[0].lo]; st.alt=600; st.gs=90; st.trk=distBrg(FP.pts[0].la,FP.pts[0].lo,FP.pts[1].la,FP.pts[1].lo)[1]; SIDE.on=true; SIDE.key=''; SIDE.t=0; sideUI(); });
  await p.waitForTimeout(1200); await p.evaluate(()=>{ SIDE.key=''; SIDE.t=0; sideUI(); });
  r=await p.evaluate(()=>({txt:$('sideTxt').textContent, hz:SIDE.hz&&{W:SIDE.hz.W.length,O:SIDE.hz.O.length}}));
  ok(r.hz&&(r.hz.W+r.hz.O)>0&&/(power line|kV|ft in)/.test(r.txt),`side view: ${r.hz&&r.hz.W} line crossings, ${r.hz&&r.hz.O} obstacles · "${r.txt}"`);
  await p.locator('#sideBox').screenshot({path:__dirname+'/arrsup_side.png'}).catch(()=>{});
  await p.evaluate(()=>{ $('fpBody').hidden=false; PROF_BG.key=''; drawProf(); });
  r=await p.evaluate(()=>PROF_BG.hz&&{W:PROF_BG.hz.W.length,O:PROF_BG.hz.O.length}); ok(r&&r.W>5&&r.O>=1,`profile: ${r&&r.W} line crossings and ${r&&r.O} obstacle drawn`);
  await p.locator('#fpProf').screenshot({path:__dirname+'/arrsup_prof.png'}).catch(()=>{});
  console.log(fail.length? fail.length+' FAILED':'all passed'); console.log(errs); await b.close(); process.exit(fail.length?1:0); })();
