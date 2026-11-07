// Charts offline: import an AIP chart PDF (not in the repo: pass its path, or set CHART_PDF), go offline, reload, the chart still draws.
// node play/chart_off.js /path/to/Melbourne_VTC_26NOV2026.pdf
const PDF=process.argv[2]||process.env.CHART_PDF||'/tmp/claude-0/ch/Melbourne_VTC_26NOV2026.pdf';
if(!require('fs').existsSync(PDF)){ console.log('skip: no chart PDF at',PDF); process.exit(0); }
const {chromium,devices}=require('playwright');
(async()=>{ const b=await chromium.launch(); require('./classic.js')(b); const ctx=await b.newContext({...devices['iPhone 13']}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=&gs=0'); await p.waitForFunction(()=>typeof render==='function'); await p.evaluate(()=>navigator.serviceWorker.ready); await p.waitForTimeout(3000);
 const n0=await p.evaluate(()=>(CH.local||[]).length); await p.setInputFiles('#chartFile',[PDF]);
 await p.waitForFunction(n0=>!CH.busy && (CH.local||[]).length>n0,n0,{timeout:600000,polling:2000}); const n1=await p.evaluate(()=>CH.local.length);
 await ctx.setOffline(true); await p.reload(); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(2500);
 const r=await p.evaluate(n1=>({localKept:CH.local.length===n1,on:CH.on,imgs:[...CH.imgs.values()].filter(v=>v&&v.width).length,foot:document.getElementById('offl').innerText}),n1);
 console.log(JSON.stringify(r)); await (await p.$('#map')).screenshot({path:'play/ch_offline.png'}); console.log(errs); await b.close(); })();
