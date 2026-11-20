// A tap on the map never changes Go to (21 Nov 2026, Michael: "When tapping the map, change the aerodrome tab, not the
// Goto. Goto must be selected from the menu"). With the YBRS plan flying to CARR: a tap on YMMB selects it in the
// Aerodrome card and leaves the plan's Go to; a tap on a VFR waypoint opens the map menu; its Go to button is a direct-to.
// node play/maptap.js  (app on :8811)
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(), errs=[], fail=[]; const ok=(c,m)=>{ console.log((c?'ok   ':'FAIL ')+m); if(!c) fail.push(m); };
  for(const fs of [false,true]){ const n=fs?'full screen':'classic';
    const ctx=await b.newContext({...PX9,storageState:{cookies:[],origins:[{origin:'http://localhost:8811',localStorage:[{name:'rc_fsMap',value:String(fs)}]}]}});
    const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(n+': '+e.message));
    await p.goto('http://localhost:8811/index.html?sim=-37.95,145.02&alt=1500&trk=180&gs=0'); await p.waitForFunction(()=>typeof render==='function'&&st.pos);
    await p.setInputFiles('#fpFile',__dirname+'/fixtures/ybrs.gpx'); await p.waitForFunction(()=>FP&&FP.pts.length>5);
    await p.evaluate(()=>{ fpPick(FP.pts.findIndex(q=>q.c==='CARR')); MAP.range=10; MAP.up='north'; render(); }); await p.waitForTimeout(400);
    if(!fs) await p.evaluate(()=>$('map').scrollIntoView({block:'center'}));
    const go0=await p.evaluate(()=>GO&&GO.c);
    // tap YMMB
    const tapAt=async code=>{ const xy=await p.evaluate(c=>{ const h=MAP.hits.find(x=>x.p.c===c); if(!h) return null; const r=$('map').getBoundingClientRect(); return [r.left+h.x,r.top+h.y]; },code);
      if(!xy) return false; await p.mouse.click(xy[0],xy[1]); await p.waitForTimeout(400); return true; };
    ok(await tapAt('YMMB'),`${n}: YMMB on the map`);
    let r=await p.evaluate(()=>({go:GO&&GO.c, dct:!!FP.dct, pin:st.pin, card:$('adId').textContent, menu:!$('mapMenu').hidden}));
    ok(r.go===go0&&!r.dct&&r.pin==='YMMB'&&/YMMB/.test(r.card)&&!r.menu,`${n}: tap YMMB -> Aerodrome card ${r.card}, Go to still ${r.go} (plan), no direct-to`);
    // tap a VFR waypoint (not the active one)
    const wp=await p.evaluate(()=>{ const h=MAP.hits.find(x=>x.p.k==='VFR'&&x.p.c!=='CARR'&&x.x>40&&x.y>200&&x.x<MAP.W-60&&x.y<MAP.H-60); return h&&h.p.c; });
    ok(!!wp&&await tapAt(wp),`${n}: tap ${wp}`);
    r=await p.evaluate(()=>({go:GO&&GO.c, dct:!!FP.dct, menu:!$('mapMenu').hidden, btns:[...$('mapMenu').querySelectorAll('button')].map(b=>b.textContent)}));
    ok(r.go===go0&&!r.dct&&r.menu&&r.btns.some(t=>t.startsWith('Go to '+wp)),`${n}: tap ${wp} -> menu (${r.btns.filter(t=>/^Go to/.test(t)).join(', ')}), Go to unchanged`);
    await p.evaluate(wp=>[...$('mapMenu').querySelectorAll('button')].find(b=>b.textContent.startsWith('Go to '+wp)).click(),wp); await p.waitForTimeout(300);
    r=await p.evaluate(()=>({go:GO&&GO.c, dct:!!FP.dct, act:FP.pts[FP.i]&&FP.pts[FP.i].c}));
    ok(r.go===wp&&(r.dct||r.act===wp),`${n}: menu Go to ${wp} -> ${r.dct?'direct-to (plan paused)':'its plan point '+r.act+' made active'}`);
    await ctx.close(); }
  console.log(fail.length? fail.length+' FAILED':'all passed'); console.log(errs); await b.close(); process.exit(fail.length?1:0); })();
