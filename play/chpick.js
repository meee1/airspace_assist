// Chart downloads: locator map of Australia, a thumbnail per chart, "charts in this map view" (18 Nov 2026).
// node play/chpick.js   (app served on :8811)
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(), errs=[], fail=[]; const ok=(c,m)=>{ console.log((c?'ok   ':'FAIL ')+m); if(!c) fail.push(m); };
  const ctx=await b.newContext(PX9); await ctx.addInitScript(()=>{ if(!localStorage.getItem('rc_chartSel')) localStorage.setItem('rc_chartSel',JSON.stringify(['ML-VNC'])); });
  await ctx.route(/\/charts\/.+\.jpg$/,r=>r.abort());   // no tile downloads in the test
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
  p.on('dialog',d=>d.accept());
  await p.goto('http://localhost:8811/index.html?sim=-37.95,145.0&alt=1500&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'&&st.pos&&CH.site.length);
  await p.evaluate(()=>{ MAP.range=20; render(); }); await p.waitForTimeout(400);
  // footprints: back through chartPt lands on the clip, for every panel of every sheet
  const rt=await p.evaluate(()=>{ let worst=0, n=0; for(const sh of CHART_SHEETS) for(const pan of sh.panels){ if(!pan.clip||!(pan.aff||pan.sim)) continue; const L=panLL(pan);
      for(let k=0;k<L.length;k+=7){ const q=chartPt(pan,L[k][0],L[k][1]); n++; let best=1e9; for(let i=0;i<pan.clip.length;i++){ const A=pan.clip[i], B=pan.clip[(i+1)%pan.clip.length], dx=B[0]-A[0], dy=B[1]-A[1], t=Math.max(0,Math.min(1,((q[0]-A[0])*dx+(q[1]-A[1])*dy)/(dx*dx+dy*dy||1))); best=Math.min(best,Math.hypot(A[0]+dx*t-q[0],A[1]+dy*t-q[1])); } worst=Math.max(worst,best); } }
    return {worst,n}; });
  ok(rt.worst<0.01,`footprints round-trip onto the clip (${rt.n} points, worst ${rt.worst.toExponential(1)} pt)`);
  ok(await p.evaluate(()=>sheetHas('ML-VTC',-37.98,145.1)&&sheetHas('ML-VNC',-37.98,145.1)&&!sheetHas('ML-VTC',-33.9,151.2)),'Moorabbin is on the Melbourne VTC and VNC, Sydney is not on the Melbourne VTC');
  const inView=await p.evaluate(()=>chartsInView(''));
  ok(inView.includes('ML-VTC')&&inView.includes('ML-VNC')&&!inView.some(id=>/SYD|BRIS|PERTH/i.test(id)),'charts in view at Melbourne, 20 NM: '+inView.join(', '));
  ok(JSON.stringify(await p.evaluate(()=>chartsInView('VTC')))==='["ML-VTC"]','VTC only: Melbourne VTC');
  await p.click('#bOpts'); await p.waitForTimeout(500);
  let r=await p.evaluate(()=>({ov:$('chOv').width, th:document.querySelectorAll('#optsCharts canvas.chth').length, rows:CH.site.length, btn:$('chView').textContent, note:$('chViewNote').textContent}));
  ok(r.ov>0&&r.th===r.rows,'overview drawn, a thumbnail on each of '+r.rows+' rows');
  ok(/Tick \d+ more in this map view/.test(r.btn),'button: '+r.btn);
  await p.locator('#chMapBox').screenshot({path:__dirname+'/chpick_map.png'});
  await p.locator('#optsCharts').screenshot({path:__dirname+'/chpick_list.png'});
  await p.click('#chView'); await p.waitForTimeout(300);
  r=await p.evaluate(()=>({sel:[...chartSel()], btn:$('chView').textContent}));
  ok(inView.every(id=>r.sel.includes(id))&&/All charts in this map view are ticked/.test(r.btn),'Tick: every chart in view ticked ('+r.sel.join(', ')+')');
  // tap Sydney on the locator map: the Sydney VTC (smallest sheet there) is ticked
  const xy=await p.evaluate(()=>{ const cv=$('chOv'), P=chProj(cv.clientWidth,cv.clientHeight,CH_FR); return P(-33.9,151.1); });
  const before=await p.evaluate(()=>[...chartSel()]);
  await p.click('#chOv',{position:{x:xy[0],y:xy[1]}}); await p.waitForTimeout(300);
  r=await p.evaluate(b=>[...chartSel()].filter(x=>!b.includes(x)),before);
  ok(r.length===1&&/SYD/i.test(r[0])&&/VTC/.test(r[0]),'tap on Sydney ticks '+r.join(','));
  await p.click('#chOv',{position:{x:xy[0],y:xy[1]}}); await p.waitForTimeout(300);
  ok((await p.evaluate(b=>[...chartSel()].length===b.length,before)),'tap again unticks it');
  // only this view
  await p.evaluate(()=>{ const s=chartSel(); s.add('PERTH-VNC'); chartSetSel(s); }); await p.waitForTimeout(200);
  await p.click('#chOnly'); await p.waitForTimeout(300);
  r=await p.evaluate(()=>[...chartSel()]);
  ok(!r.includes('PERTH-VNC')&&inView.every(id=>r.includes(id)),'Only this view drops Perth: '+r.join(', '));
  await p.locator('#chMapBox').screenshot({path:__dirname+'/chpick_map2.png'});
  // the chart underlay pop-up's button
  await p.click('#optsClose'); await p.evaluate(()=>{ chartSetSel(new Set(['ML-VNC'])); $('chartBox').open=true; }); await p.waitForTimeout(200);
  r=await p.evaluate(()=>({t:$('chartView').textContent, n:$('chartViewNote').textContent}));
  ok(/Turn on every chart in this view \(\+\d+\)/.test(r.t),'pop-up: '+r.t);
  await p.click('#chartView'); ok(await p.evaluate(v=>v.every(id=>chartSel().has(id)),inView),'pop-up button turns them on');
  // no position: buttons off
  const ctx2=await b.newContext(PX9); await ctx2.route(/\/charts\/.+\.jpg$/,r=>r.abort()); const p2=await ctx2.newPage(); await p2.goto('http://localhost:8811/index.html'); await p2.waitForFunction(()=>typeof render==='function'&&CH.site.length);
  await p2.evaluate(()=>{ optsRender(); }); ok(await p2.evaluate(()=>$('chView').disabled&&/need the map/.test($('chViewNote').textContent)),'without a position the view buttons are off');
    await p.click('#bOpts'); await p.waitForTimeout(400); await p.evaluate(()=>{ document.querySelector('#optsCharts').scrollIntoView(); }); await p.locator('#optsCharts label').nth(0).screenshot({path:__dirname+'/chpick_row.png'});
  const box=await p.evaluate(()=>{ const r=$('optsCharts').getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:Math.min(r.height,420)}; }); await p.screenshot({path:__dirname+'/chpick_list.png',clip:box});
  console.log(fail.length? fail.length+' FAILED':'all passed'); console.log(errs); await b.close(); process.exit(fail.length?1:0); })();
