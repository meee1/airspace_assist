// Options popup: which site charts to download; unticking drops stored tiles; a sheet added later starts unticked and NEW
const {chromium}=require('playwright'); const {PX9}=require('./px9.js'); const fs=require('fs');
// Fake site charts (3 tiny tiles per sheet) are served from play/fixtures/charts by routing, so the real dist/charts is never touched.
const FX=__dirname+'/fixtures/charts'; let IDX='index1.json';
(async()=>{ const b=await chromium.launch(); require('./classic.js')(b); const ctx=await b.newContext(PX9); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await ctx.route(/\/charts\//,r=>{ const f=new URL(r.request().url()).pathname.split('/charts/')[1]; const fp=FX+'/'+(f==='index.json'?IDX:f);
   return fs.existsSync(fp)? r.fulfill({body:fs.readFileSync(fp),contentType:/\.json$/.test(fp)?'application/json':'image/jpeg'}) : r.fulfill({status:404,body:''}); });
 const stored=()=>p.evaluate(async()=>{ const c=await caches.open(CH_CACHE); return (await c.keys()).map(k=>new URL(k.url).pathname.split('/charts/')[1]).filter(x=>x&&x.includes('/')).map(x=>x.split('/')[0]).reduce((m,d)=>(m[d]=(m[d]||0)+1,m),{}); });
 await p.goto('http://localhost:8811/index.html?sim=YBRS&alt=1500&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForFunction(()=>CH.site.length===2&&!CH.pre&&CH.idx.length===2,{timeout:15000}); await p.waitForTimeout(500);
 console.log('first run sel',JSON.stringify(await p.evaluate(()=>ls.get('chartSel'))),'stored',JSON.stringify(await stored()));
 await p.click('#bOpts'); await p.waitForTimeout(200); await (await p.$('#optsDlg')).screenshot({path:'play/opts_1.png'});
 console.log('dialog', await p.evaluate(()=>$('optsDlg').open), await p.$$eval('#optsCharts input',x=>x.map(c=>c.dataset.sheet+':'+c.checked).join(' ')));
 await p.click('#optsCharts [data-sheet="ML-VNC"]'); await p.waitForFunction(()=>!CH.pre); await p.waitForTimeout(500);
 console.log('untick VNC sel',JSON.stringify(await p.evaluate(()=>ls.get('chartSel'))),'idx',await p.evaluate(()=>CH.idx.map(e=>e.sheet).join(',')),'stored',JSON.stringify(await stored()));
 await p.click('#optsCharts [data-sheet="ML-VNC"]'); await p.waitForFunction(()=>!CH.pre); await p.waitForTimeout(800);
 console.log('tick again stored',JSON.stringify(await stored()));
 await p.click('#optsClose'); console.log('closed', await p.evaluate(()=>!$('optsDlg').open));
 IDX='index2.json'; await p.reload(); await p.waitForFunction(()=>typeof render==='function'); await p.waitForFunction(()=>CH.site.length===3&&!CH.pre&&CH.newSheets&&CH.idx.length===2,{timeout:15000}); await p.waitForTimeout(500);
 console.log('new sheet: idx',await p.evaluate(()=>CH.idx.map(e=>e.sheet).join(',')),'new',await p.evaluate(()=>CH.newSheets.join(',')),'stored',JSON.stringify(await stored()));
 await p.click('#bOpts'); await p.waitForTimeout(200); await (await p.$('#optsDlg')).screenshot({path:'play/opts_2.png'});
 await p.click('#optsCharts [data-sheet="AD-VNC"]'); await p.waitForFunction(()=>!CH.pre); await p.waitForTimeout(800);
 console.log('tick Adelaide stored',JSON.stringify(await stored()),'new after open',await p.evaluate(()=>chartSel()&&CH.newSheets.join(',')||'none'));
 await p.keyboard.press('Escape'); console.log('esc closed', await p.evaluate(()=>!$('optsDlg').open));
 console.log(errs); await b.close(); })();
