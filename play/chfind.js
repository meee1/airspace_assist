// Chart list: kind tabs, search by name or place, tick charts along the flight plan (Options and the pre-flight brief),
// Show on the map (18 Nov 2026). node play/chfind.js   (app served on :8811)
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(), errs=[], fail=[]; const ok=(c,m)=>{ console.log((c?'ok   ':'FAIL ')+m); if(!c) fail.push(m); };
  const ctx=await b.newContext(PX9); await ctx.addInitScript(()=>{ if(!localStorage.getItem('rc_chartSel')) localStorage.setItem('rc_chartSel',JSON.stringify(['ML-VNC'])); });
  await ctx.route(/\/charts\/.+\.jpg$/,r=>r.abort());
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('http://localhost:8811/index.html?sim=-37.95,145.0&alt=1500&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'&&st.pos&&CH.site.length);
  await p.click('#bOpts'); await p.waitForTimeout(400);
  const vis=()=>p.evaluate(()=>[...document.querySelectorAll('#optsCharts label[data-row]')].filter(l=>!l.hidden).map(l=>l.dataset.row));
  let r=await p.evaluate(()=>[...document.querySelectorAll('#chTabs [data-k]')].map(b=>b.textContent));
  ok(r.length===5&&/^All\d+$/.test(r[0])&&/^Ticked1$/.test(r[4]),'tabs: '+r.join(' | '));
  await p.click('#chTabs [data-k="VTC"]'); let v=await vis(); ok(v.length>10&&v.every(id=>/VTC/.test(id)),'VTC tab: '+v.length+' VTCs');
  await p.click('#chTabs [data-k="on"]'); v=await vis(); ok(JSON.stringify(v)==='["ML-VNC"]','Ticked tab: '+v.join(','));
  await p.click('#chTabs [data-k=""]');
  await p.fill('#chFind','sydney'); await p.waitForTimeout(300); v=await vis(); ok(v.includes('SYDNEY-VTC')&&v.includes('SYDNEY-VNC')&&!v.some(id=>/^ML-|PERTH/.test(id)),'search "sydney" (names, and charts covering the town): '+v.join(','));
  await p.fill('#chFind','YMMB'); await p.waitForTimeout(300); v=await vis(); r=await p.evaluate(()=>$('chFindNote').textContent);
  ok(v.includes('ML-VTC')&&v.includes('ML-VNC')&&!v.some(id=>/SYD|PERTH/.test(id))&&/covering YMMB/.test(r),'search "YMMB" (a place): '+v.join(',')+' | '+r);
  await p.fill('#chFind','mildura'); await p.waitForTimeout(300); v=await vis(); ok(v.some(id=>/MILDURA/i.test(id)),'search "mildura": '+v.join(','));
  await p.fill('#chFind','zzzz'); await p.waitForTimeout(300); ok((await vis()).length===0&&/No chart matches/.test(await p.evaluate(()=>$('chFindNote').textContent)),'no match says so');
  await p.fill('#chFind',''); await p.waitForTimeout(300);
  ok(await p.evaluate(()=>$('chPlan').hidden),'no plan: no plan button');
  // a plan: YBRS round trip (Melbourne area)
  await p.click('#optsClose'); await p.setInputFiles('#fpFile',__dirname+'/fixtures/ybrs.gpx'); await p.waitForFunction(()=>FP&&FP.pts.length>5);
  await p.click('#bOpts'); await p.waitForTimeout(400);
  r=await p.evaluate(()=>({t:$('chPlan').textContent, L:chartsOnPlan('')}));
  ok(/Tick \d+ along the flight plan/.test(r.t)&&r.L.includes('ML-VTC')&&r.L.includes('ML-VNC'),'plan button: '+r.t+' ('+r.L.join(',')+')');
  await p.click('#chTabs [data-k="VTC"]'); r=await p.evaluate(()=>chartsOnPlan(chKindNow())); ok(JSON.stringify(r)==='["ML-VTC"]','VTC tab: plan button only the VTC');
  await p.click('#chTabs [data-k=""]');
  await p.click('#chPlan'); await p.waitForTimeout(200);
  r=await p.evaluate(()=>({sel:[...chartSel()], L:chartsOnPlan(''), t:$('chPlan').textContent}));
  ok(r.L.every(id=>r.sel.includes(id))&&/All \d+ charts along the plan are ticked/.test(r.t),'ticked along the plan: '+r.sel.join(','));
  // show on the map
  await p.click('#chFind'); await p.fill('#chFind','sydney vtc'); await p.waitForTimeout(300);
  await p.click('#optsCharts [data-go="SYDNEY-VTC"]'); await p.waitForTimeout(500);
  r=await p.evaluate(()=>({open:$('optsDlg').open, pan:MAP.pan, rng:MAP.range, hi:MAP.chHi&&MAP.chHi.id, sel:chartSel().has('SYDNEY-VTC')}));
  ok(!r.open&&r.pan&&Math.abs(r.pan[0]+33.9)<0.6&&Math.abs(r.pan[1]-151)<0.7&&r.hi==='SYDNEY-VTC'&&!r.sel,'Show: map centred on the Sydney VTC at '+r.rng.toFixed(1)+' NM, not ticked by it');
  await p.waitForTimeout(400); const box=await p.evaluate(()=>{ const q=$('map').getBoundingClientRect(); return {x:q.x,y:q.y+scrollY,width:q.width,height:q.height}; });
  await p.screenshot({path:__dirname+'/chfind_show.png',clip:box,fullPage:true});
  // the pre-flight brief's "Tick them"
  await p.evaluate(()=>{ chartSetSel(new Set(['ML-VNC'])); $('mapHome').click(); }); await p.click('#fpCheck').catch(()=>{});
  await p.evaluate(()=>{ if(!$('pcDlg').open) $('pcDlg').showModal(); pcRun(); }); await p.waitForFunction(()=>!!document.querySelector('#pcOut [data-chplan]'),{timeout:20000});
  await p.click('#pcOut [data-chplan]'); await p.waitForTimeout(400);
  r=await p.evaluate(()=>({sel:[...chartSel()], L:chartsOnPlan('')})); ok(r.L.every(id=>r.sel.includes(id)),'pre-flight brief Tick them: '+r.sel.join(','));
  console.log(fail.length? fail.length+' FAILED':'all passed'); console.log(errs); await b.close(); process.exit(fail.length?1:0); })();
