// chart underlay with many sheets: the summary is a count, the list folds away
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const p=await (await b.newContext(PX9)).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(800);
 console.log('default', await p.textContent('#chartSum'), '|', await p.textContent('#chartAllSum'), await p.evaluate(()=>$('chartAll').open));
 await p.evaluate(()=>ls.set('chartSel',CH.site.map(e=>e.sheet))); await p.reload(); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(1500);
 console.log('all', await p.textContent('#chartSum'), '|', await p.textContent('#chartAllSum'), await p.evaluate(()=>$('chartAll').open));
 const s=await p.$('#chartBox'); await s.scrollIntoViewIfNeeded(); await s.screenshot({path:'play/chlist_sum.png'});
 await p.click('#chartBox > summary'); await p.waitForTimeout(300); await p.screenshot({path:'play/chlist_pop.png'});
 await p.click('#chartAllSum'); await p.waitForTimeout(300); console.log('open', await p.evaluate(()=>$('chartAll').open)); await p.screenshot({path:'play/chlist_open.png'});
 console.log(errs); await b.close(); })();
