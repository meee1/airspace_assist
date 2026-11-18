// Bring the inbound / transit call back by tapping the → CTAF or CTAF tile (18 Nov 2026). node play/inbrecall.js  (app on :8811)
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(), errs=[], fail=[]; const ok=(c,m)=>{ console.log((c?'ok   ':'FAIL ')+m); if(!c) fail.push(m); };
  const clock=()=>{ const D=Date, off=D.parse('2026-11-01T01:30:00Z')-D.now(); window.Date=class extends D{ constructor(...a){ super(...(a.length?a:[D.now()+off])); } static now(){ return D.now()+off; } }; };   // tower hours (12:30 local)
  const go=async(p,q,ad)=>{ await p.goto('http://localhost:8811/index.html?sim='+q); await p.waitForFunction(()=>typeof render==='function'&&st.pos); await p.waitForTimeout(500);
    if(ad) await p.evaluate(i=>{ const a=DATA.ap.find(x=>x.i===i); setGo({k:'AD',c:a.i,n:a.n,la:a.la,lo:a.lo}); render(); },ad); await p.waitForTimeout(300); };
  const row=p=>p.evaluate(()=>$('sInbound').hidden? '' : $('sInbound').textContent);
  // classic, tile zoom off: one tap
  { const ctx=await b.newContext({...PX9,storageState:{cookies:[],origins:[{origin:'http://localhost:8811',localStorage:[{name:'rc_fsMap',value:'false'},{name:'rc_tileZoom',value:'false'}]}]}}); await ctx.addInitScript(clock);
    const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
    await go(p,'-37.80,145.22&alt=1500&trk=070&gs=90','YLIL');   // ~7 NM WSW of Lilydale: already inside 10 NM, so no reminder by itself
    ok(!(await row(p)),'inside 10 NM from the start: no reminder by itself');
    await p.click('#gCtafBox'); let r=await row(p);
    ok(/INBOUND CALL/.test(r)&&/Lilydale traffic/i.test(r)&&/inbound/.test(r),'tap → CTAF: inbound call back: '+r.slice(0,110));
    await p.click('#sInbound'); ok(!(await row(p)),'tap the row: dismissed');
    await p.click('#gCtafBox'); ok(/INBOUND CALL/.test(await row(p)),'tap again: back');
    await p.evaluate(()=>{ $('sInbound').click(); });
    // inside 4 NM it stays (it would clear itself there when it came up at 10 NM)
    await p.evaluate(()=>{ $('simPos').value='-37.735,145.32'; simApply(); }); await p.waitForTimeout(300); await p.click(await p.evaluate(()=>$('gCtafBox').hidden)? '#sCtafBox' : '#gCtafBox'); await p.waitForTimeout(1200);   // close in, the → tiles hide (they'd repeat the top ones): the CTAF tile is the same field
    ok(/INBOUND CALL/.test(await row(p)),'brought back 3 NM out: stays up');
    await p.evaluate(()=>{ $('sInbound').click(); });
    // beyond 15 NM: nothing
    await p.evaluate(()=>{ $('simPos').value='-37.95,145.0'; simApply(); }); await p.waitForTimeout(300); await p.click('#gCtafBox').catch(()=>{});
    ok(!(await row(p)),'20 NM away: nothing');
    // CTAF tile, a field you're not landing at (no Go to): transit call
    await p.evaluate(()=>{ setGo(null); $('simPos').value='-37.80,145.22'; simApply(); }); await p.waitForTimeout(500);
    const ad=await p.evaluate(()=>st.ctafTileAd&&st.ctafTileAd.i); await p.click('#sCtafBox'); r=await row(p);
    ok(/TRANSIT CALL/.test(r)&&/transiting/.test(r),'tap CTAF tile ('+ad+'), not landing there: transit call: '+r.slice(0,100));
    await p.evaluate(()=>{ $('sInbound').click(); });
    // Moorabbin in tower hours: as your Go to (landing): the tower inbound call; only passing: no CTAF call
    await go(p,'-37.93,145.00&alt=1500&trk=090&gs=90','YMMB'); await p.click('#gCtafBox'); r=await row(p);
    ok(/INBOUND CALL/.test(r)&&/Moorabbin Tower/.test(r),'YMMB Go to, tower open: tower inbound call: '+r.slice(0,100));
    await p.evaluate(()=>{ $('sInbound').click(); setGo(null); render(); }); const t=await p.evaluate(()=>st.ctafTileAd&&st.ctafTileAd.i);
    if(t==='YMMB'){ await p.click('#sCtafBox'); ok(!(await row(p)),'passing YMMB (tower open, not landing): no call'); }
    else ok(await p.evaluate(()=>{ const a=DATA.ap.find(x=>x.i==='YMMB'); const r=inbRecall(a); return !r&&$('sInbound').hidden; }),'passing YMMB (tower open, not landing): no call (CTAF tile was '+t+')');
    await ctx.close(); }
  // full screen phone, tile zoom on: the first tap enlarges, the second brings the call back and doesn't open the whole bar
  { const ctx=await b.newContext({...PX9,storageState:{cookies:[],origins:[{origin:'http://localhost:8811',localStorage:[{name:'rc_fsMap',value:'true'}]}]}}); await ctx.addInitScript(clock);
    const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
    await go(p,'-37.80,145.22&alt=1500&trk=070&gs=90','YLIL'); await p.evaluate(()=>{ setGo(null); render(); }); await p.waitForTimeout(300);
    await p.click('#sCtafBox'); ok(!(await row(p))&&await p.evaluate(()=>!!document.querySelector('#sCtafBox[data-zb]')),'full screen: first tap enlarges the tile');
    await p.click('#sCtafBox'); const r=await row(p), bar=await p.evaluate(()=>document.body.classList.contains('fsm-bar'));
    ok(/CALL/.test(r)&&!bar,'second tap: call back, whole bar not opened ('+r.slice(0,60)+')');
    await p.screenshot({path:__dirname+'/inbrecall_fs.png'});
    await p.evaluate(()=>{ $('sInbound').click(); }); await p.click('#sAreaBox'); await p.click('#sAreaBox');
    ok(await p.evaluate(()=>document.body.classList.contains('fsm-bar')),'other tiles still open the whole bar');
    await ctx.close(); }
  console.log(fail.length? fail.length+' FAILED':'all passed'); console.log(errs); await b.close(); process.exit(fail.length?1:0); })();
