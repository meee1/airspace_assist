// Where the Go to comes from, on the PLAN tile and the → tiles: GO TO (no plan), PLAN n/N (the plan's active waypoint),
// DIRECT (a direct-to pausing the plan); and on the top CTAF tile: SELECTED ✕ when an aerodrome is picked instead of the
// closest: CARD YMMB ✕ when it's another aerodrome than the tile's (tap it to go back), CARD xxx when the plan chose it.
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const p=await (await b.newContext({...PX9,deviceScaleFactor:2})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YBRS&alt=1500&trk=045&gs=90'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(600);
 const st_=()=>p.evaluate(()=>{ const c=id=>$(id).hidden?'-':$(id).textContent; return `PLAN tile "${$('sPlanLbl').textContent}" · → tiles ${$('gCtafBox').hidden?'(hidden)':c('gCtafSrc')+' / '+c('gAreaSrc')} · top CTAF ${$('sCtafAd').textContent} ${c('sCtafSrc')} · card "${$('adMode').textContent}" ${$('adId').textContent}`; });
 console.log('nothing set:     ', await st_());
 await p.evaluate(()=>{ setGo({...DATA.ap.find(x=>x.i==='YLIL'),k:'AD',c:'YLIL'}); render(); }); console.log('Go to YLIL:      ', await st_());
 await p.setInputFiles('#fpFile',__dirname+'/fixtures/ybrs.gpx'); await p.waitForFunction(()=>FP); await p.evaluate(()=>render()); console.log('plan loaded:     ', await st_());
 await p.evaluate(()=>{ const a=DATA.ap.find(x=>x.i==='YMAV'); setGo({k:'AD',c:'YMAV',n:a.n,la:a.la,lo:a.lo}); render(); }); console.log('direct to YMAV:  ', await st_());
 await p.screenshot({path:'play/gosrc_dct.png',clip:{x:0,y:0,width:427,height:330}});
 await p.evaluate(()=>{ fpResume(); render(); }); console.log('resume plan:     ', await p.evaluate(()=>$('sPlanLbl').textContent));
 await p.evaluate(()=>{ st.pin='YMMB'; render(); }); console.log('YMMB selected:   ', await st_());
 await p.screenshot({path:'play/gosrc_pin.png',clip:{x:0,y:0,width:427,height:330}});
 await p.click('#sCtafSrc'); await p.waitForTimeout(100); console.log('tap SELECTED ✕:  ', await st_(), '· pin', await p.evaluate(()=>st.pin));
 console.log(errs); await b.close(); })();
