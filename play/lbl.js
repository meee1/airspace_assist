const {chromium,devices}=require('playwright');
(async()=>{ const b=await chromium.launch(); require('./classic.js')(b); const p=await (await b.newContext({...devices['iPhone 13']})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=&gs=0'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(500);
 await p.evaluate(()=>{ MAP.range=20; });
 const m=await p.$('#map'); await m.scrollIntoViewIfNeeded();
 for(const [k,c] of [['a',[-37.85,145.0]],['b',[-37.70,144.85]],['c',[-38.05,144.60]]]){
   const t0=Date.now(); await p.evaluate(c=>{ MAP.pan=c; render(); },c); const ms=Date.now()-t0;
   await m.screenshot({path:`play/lbl_${k}.png`}); console.log(k,'render ms',ms); }
 // profile zoom
 await p.setInputFiles('#fpFile',__dirname+'/fixtures/ybrs.gpx'); await p.waitForTimeout(800);
 await p.click('#profIn'); await p.click('#profIn'); console.log('top', await p.textContent('#profTop'));
 await (await p.$('.fp-prof')).screenshot({path:'play/prof_zoom.png'});
 await p.click('#profAuto'); console.log('top', await p.textContent('#profTop'));
 for(let i=0;i<20;i++) await p.click('#profOut'); console.log('top max', await p.textContent('#profTop'));
 console.log(errs); await b.close(); })();
