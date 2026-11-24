// Flight computer additions (24 Nov 2026, Michael: "Add 1-4": density altitude / TAS window, conversion arrows, more problem
// types; "i cant mark up 15 kts"; "the time from distance problem shows the wind computer"). node play/e6b2.js (app on :8811)
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(), errs=[], fail=[]; const ok=(c,m)=>{ console.log((c?'ok   ':'FAIL ')+m); if(!c) fail.push(m); };
  const ctx=await b.newContext({...PX9}); const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'&&st.pos);
  await p.evaluate(()=>{ $('bE6b').click(); $('e6bPSrc').value='rand'; }); await p.waitForTimeout(200);
  // the slide-rule problems show the slide rule only
  let r=await p.evaluate(()=>{ $('e6bPType').value='tsd'; e6Tab('prob'); e6New(); const vis=id=>{ const e=$(id), q=e.getBoundingClientRect(); return q.width>0&&q.height>0&&getComputedStyle(e).display!=='none'; }; return {w:vis('e6bPWSvg'), c:vis('e6bPCSvg'), t:vis('e6bPTools')}; });
  ok(!r.w&&r.c&&!r.t,`time from distance: slide rule shown, wind computer and ✎ tools hidden (${JSON.stringify(r)})`);
  // ✎ Mark 15 kt: press 3 px right of the centre line and slide to 15 kt
  await p.evaluate(()=>{ $('e6bPType').value='wind'; for(let i=0;i<50;i++){ e6New(); if(E6P.p.wk===15) break; } const W=E6.pw; W.rotP=E6P.p.wd; W.draw(); });
  await p.locator('#e6bPWSvg').scrollIntoViewIfNeeded(); await p.click('#e6bPTools [data-pw="mark"]');
  const M=await p.evaluate(()=>{ const m=$('e6bPWSvg').getScreenCTM(); return {a:m.a,e:m.e,f:m.f}; }), k=M.a, gx=M.e+3, gy=M.f, sc=140/60*k;
  await p.mouse.move(gx,gy-8*sc); await p.mouse.down(); await p.mouse.move(gx+1,gy-12*sc,{steps:3});
  const lab=await p.evaluate(()=>{ const t=[...$('e6bPWSvg').querySelectorAll('text')].pop(); return t&&t.textContent; });
  await p.mouse.move(gx,gy-15.3*sc,{steps:3}); await p.mouse.up();
  r=await p.evaluate(()=>{ const q=E6.pw.dots[0], w=E6.pw.dotWind(q); return {dir:w.dir, kt:w.kt, wd:E6P.p.wd, step:$('e6bPSteps').children[1].className, mark:E6.pw.mark}; });
  ok(Math.abs(r.kt-15)<0.01&&Math.abs(((r.dir-r.wd+540)%360)-180)<0.01&&r.step==='ok'&&!r.mark,`✎ Mark 15 kt by press and slide (label "${lab}"): dot ${r.dir.toFixed(1)}°/${r.kt} kt on the centre line, step ticked`);
  // every slide-rule type: Show me sets the computer, the steps tick, the instrument's reading is the answer, the answer checks
  for(const t of ['tsd','gs','range','fuel','endur','cons','tas','conv','conv','conv','conv']){
    r=await p.evaluate(t=>{ $('e6bPType').value=t; e6New(); e6Show(); const P=E6P.p, C=E6.pc, steps=[...$('e6bPSteps').children].map(d=>d.className);
      const outerCur=e6V(C.cur), innerCur=e6V(C.cur-C.rot), idx=C.idx();
      const read= P.Q? (P.Q.f==='R'? idx : P.Q.f==='O'? outerCur : innerCur) : t==='tas'? outerCur : P.c[1]? innerCur : outerCur;
      const want= t==='tas'? P.tas : P.v, rel=Math.abs(Math.log10(e6N(read))-Math.log10(e6N(want)));
      const keys=[...$('e6bPAns').querySelectorAll('input')].map(i=>i.dataset.k);
      for(const k of keys){ const i=$('e6bPAns').querySelector(`input[data-k="${k}"]`); i.value= k==='tas'? Math.round(P.tas) : k==='da'? Math.round(P.da/100)*100 : (k==='min'&&P.v>=60? `${Math.floor(Math.round(P.v)/60)}:${String(Math.round(P.v)%60).padStart(2,'0')}` : P.v.toFixed(1)); }
      e6Check(); return {steps, rel, res:$('e6bPRes').innerText, card:$('e6bPCard').innerText.split('\n').slice(1).join(' '), da:t==='tas'? e6DAof(C.rot)-P.da : 0}; },t);
    ok(r.steps.slice(0,t==='tas'?2:-1).every(c=>c==='ok')&&r.rel<0.001&&Math.abs(r.da)<1&&/Right/.test(r.res),`${t}: Show me ticks the steps, the scale reads the answer · ${r.card.slice(0,90)} → ${r.res.replace(/^.*answer: /,'').slice(0,50)}`); }
  // pressure altitude from QNH (24 Nov 2026): elevation + (1013 - QNH) x 30; no computer shown; Show me gives the working
  for(const src of ['rand','plan']){ if(src==='plan'){ await p.setInputFiles('#fpFile',__dirname+'/fixtures/ybrs.gpx'); await p.waitForFunction(()=>FP&&FP.pts.length>5); }
    r=await p.evaluate(src=>{ $('e6bPSrc').value=src; $('e6bPType').value='pa'; e6New(); const P=E6P.p, vis=id=>$(id).getBoundingClientRect().height>0;
      const out={v:P.v, e:P.e, q:P.q, ad:P.ad&&P.ad.i, plan:P.plan, svg:vis('e6bPWSvg')||vis('e6bPCSvg'), card:$('e6bPCard').innerText.split(String.fromCharCode(10)).slice(1).join(' ')};
      e6Show(); out.work=[...$('e6bPSteps').querySelectorAll('.hint')].map(h=>h.textContent).join(' | ');
      const i=$('e6bPAns').querySelector('input[data-k="pa"]'); i.value=String(P.v+40); e6Check(); out.ok=/Right/.test($('e6bPRes').innerText);
      e6New(); $('e6bPAns').querySelector('input[data-k="pa"]').value=String(E6P.p.e); e6Check(); out.bad=Math.abs(E6P.p.q-1013)<=1||/Not quite/.test($('e6bPRes').innerText); return out; },src);
    ok(r.v===r.e+(1013-r.q)*30&&!r.svg&&r.work.split('|').length===3&&r.ok&&r.bad&&(src==='rand'? !!r.ad : r.plan),`pressure altitude (${src}): ${r.card.slice(0,80)} = ${r.v} ft; working "${r.work.slice(0,90)}"; ±40 right, elevation alone wrong; no computer shown`); }
  // crosswind component: Show me puts the runway under the index; the dot's offsets are the components; answers check
  for(let i=0;i<3;i++){ r=await p.evaluate(()=>{ $('e6bPSrc').value='rand'; $('e6bPType').value='xw'; e6New(); const P=E6P.p, vis=id=>$(id).getBoundingClientRect().height>0; e6Show(); const c=E6.pw.xwOf(E6.pw.dots[0]), steps=[...$('e6bPSteps').children].map(d=>d.className);
      const set=(k,v)=>{ $('e6bPAns').querySelector(`input[data-k="${k}"]`).value=v; }; set('xw',(P.xw>=0?'R':'L')+Math.round(Math.abs(P.xw))); set('hw',(P.hw<0?'T':'')+Math.round(Math.abs(P.hw))); e6Check();
      return {rw:P.rw, wd:P.wd, wk:P.wk, xw:P.xw, hw:P.hw, cx:c.x, ch:c.h, steps, grid:E6.pw.xg.style.display!=='none', svg:vis('e6bPWSvg')&&!vis('e6bPCSvg'), res:$('e6bPRes').innerText, card:$('e6bPCard').innerText.split(String.fromCharCode(10)).slice(1).join(' ')}; });
    ok(Math.abs(r.cx-r.xw)<0.01&&Math.abs(r.ch-r.hw)<0.01&&r.steps.slice(0,3).every(c=>c==='ok')&&r.grid&&r.svg&&/Right/.test(r.res)&&Math.abs(Math.hypot(r.xw,r.hw)-r.wk)<1e-9,`crosswind: ${r.card.slice(0,90)} → ${r.res.replace(/^.*answer: /,'')}`); }
  // the mark step takes a tap without ✎ Mark, and says why a dot isn't accepted
  await p.evaluate(()=>{ $('e6bPType').value='wind'; for(let i=0;i<50;i++){ e6New(); if(E6P.p.wk===15) break; } E6.pw.rotP=(E6P.p.wd+30)%360; E6.pw.draw(); });
  let Mx=await p.evaluate(()=>{ const m=$('e6bPWSvg').getScreenCTM(); return {a:m.a,e:m.e,f:m.f}; });
  await p.mouse.click(Mx.e, Mx.f-15*140/60*Mx.a);
  r=await p.evaluate(()=>({dots:E6.pw.dots.length, t:$('e6bPSteps').children[1].innerText, c:$('e6bPSteps').children[1].className}));
  ok(r.dots===0,'mark step not current while the plate is off the wind: a tap slides the grid instead ('+r.dots+' dots)');
  await p.evaluate(()=>{ E6.pw.rotP=E6P.p.wd; E6.pw.draw(); }); await p.mouse.click(Mx.e, Mx.f-15*140/60*Mx.a);
  r=await p.evaluate(()=>({dots:E6.pw.dots.length, c:$('e6bPSteps').children[1].className, mark:E6.pw.mark}));
  ok(r.dots===1&&r.c==='ok'&&!r.mark,'plate on the wind: a plain tap 15 kt up marks the dot and the step ticks (no ✎ Mark)');
  await p.evaluate(()=>{ E6.pw.dots=[]; E6.pw.draw(); }); await p.mouse.click(Mx.e, Mx.f-11*140/60*Mx.a);
  r=await p.evaluate(()=>({t:$('e6bPSteps').children[1].innerText, c:$('e6bPSteps').children[1].className}));
  ok(r.c!=='ok'&&/your dot: \d{3}°\/11 kt/.test(r.t),'a dot at 11 kt says why: '+r.t.split(String.fromCharCode(10)).join(' ').slice(0,90));
  await p.evaluate(()=>{ E6P.hint=true; e6Steps(); }); r=await p.evaluate(()=>$('e6bPSteps').innerText);
  ok(/grommet is on the 100 arc, so 15 kt up is the 115 arc/.test(r),'hint names the arc: the 100 arc, so 15 kt up is the 115 arc');
  // weight and balance: made-up aircraft without a profile, then the weighed Bell 206B; a multiplication on the computer ticks its row;
  // Show me sets the CG division (outer over the inner 10 = the CG); the answer checks against the sums and the envelope
  for(const prof of ['none','b206bw']){
    r=await p.evaluate(prof=>{ if(prof!=='none'){ WB.profiles=[]; const P=wbFromTpl(prof); WB.profiles.push(P); WB.cur=P.id; }
      $('e6bPSrc').value='rand'; $('e6bPType').value='wb'; e6New(); const P=E6P.p, C=E6.pc, rw=P.rows[0];
      C.rot=((e6L(rw.w)-e6L(10))%360+360)%360; C.cur=(e6L(rw.a)+C.rot)%360; C.draw(); const mul=e6V(C.cur), row0=$('e6bPSteps').children[0].className;
      e6Show(); const steps=[...$('e6bPSteps').children].map(d=>d.className), cgRead=e6V(C.cur);
      const set=(k,v)=>{ $('e6bPAns').querySelector(`input[data-k="${k}"]`).value=v; }; set('w',P.W.toFixed(1)); set('cg',P.cg.toFixed(1)); set('in',P.inl?'Y':'N'); e6Check();
      const S=P.real? wbSum(P.P,[]) : null;
      return {real:P.real, name:P.P.name, n:P.rows.length, W:P.W, cg:P.cg, inl:P.inl, mulErr:Math.abs(Math.log10(e6N(mul))-Math.log10(e6N(rw.m))), row0, steps, cgErr:Math.abs(Math.log10(e6N(cgRead))-Math.log10(e6N(P.cg))), res:$('e6bPRes').innerText, card:$('e6bPCard').innerText.split(String.fromCharCode(10)).slice(1,3).join(' ')}; },prof);
    ok(r.real===(prof!=='none')&&r.mulErr<0.001&&r.row0==='ok'&&r.steps.slice(0,-1).every(c=>c==='ok')&&r.cgErr<0.001&&/Right/.test(r.res),`W&B (${r.name}, ${r.n} rows): empty weight × arm on the computer ticks its row; Show me reads the CG; ${r.res.replace(/^.*answer: /,'').slice(0,80)}`); }
  await p.locator('#e6bDlg').screenshot({path:__dirname+'/e6b2_wb.png'});
  // window against ISA: PA 10,000 ft, 0 °C, CAS 100 -> TAS 117.4 kt (sigma 0.7255), DA 10,565 ft (rule of thumb 10,000 + 120 x 4.8 = 10,576)
  r=await p.evaluate(()=>{ const A=e6Air(10000,0), C=E6.pc; C.rot=((A.rot%360)+360)%360; C.cur=(e6L(100)+C.rot)%360; C.draw(); return {tas:e6V(C.cur), da:e6DAof(C.rot), rd:$('e6bCompRd').innerText}; });
  ok(Math.abs(r.tas*10-117.4)<0.3&&Math.abs(r.da-10565)<30,`PA 10,000 / 0 °C / CAS 100: TAS ${(r.tas*10).toFixed(1)} kt, DA ${r.da.toFixed(0)} ft`);
  // arrows: NAUT/STAT = 1.1508, LITRES/US GAL = 3.785, LB/KG = 2.2046
  r=await p.evaluate(()=>({s:E6ARR.STAT/E6ARR.NAUT, k:E6ARR.KM/E6ARR.NAUT, g:E6ARR.LITRES/E6ARR['US GAL'], l:E6ARR.LB/E6ARR.KG}));
  ok(Math.abs(r.s-1.15078)<1e-4&&Math.abs(r.k-1.852)<1e-4&&Math.abs(r.g-3.78541)<1e-4&&Math.abs(r.l-2.20462)<1e-4,`arrow ratios ${r.s.toFixed(4)} ${r.k.toFixed(4)} ${r.g.toFixed(4)} ${r.l.toFixed(4)}`);
  await p.evaluate(()=>{ $('e6bPType').value='tas'; e6New(); e6Show(); }); await p.locator('#e6bDlg').screenshot({path:__dirname+'/e6b2_tas.png'});
  await p.evaluate(()=>{ e6Tab('comp'); const A=e6Air(5000,20); E6.comp.rot=A.rot; E6.comp.cur=(e6L(120)+A.rot)%360; E6.comp.draw(); }); await p.locator('#e6bDlg').screenshot({path:__dirname+'/e6b2_comp.png'});
  console.log(fail.length? fail.length+' FAILED':'all passed'); console.log(errs); await b.close(); process.exit(fail.length?1:0); })();
