const {chromium,devices}=require('playwright');
(async()=>{ const b=await chromium.launch(); require('./classic.js')(b); const p=await (await b.newContext({...devices['iPhone 13']})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YBRS&alt=1500&trk=&gs=0'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(500);
 console.log('towns', await p.evaluate(()=>TOWNS.length), await p.evaluate(()=>JSON.stringify(TOWNS.find(t=>t.n==='Barwon Heads'))));
 for(const q of ['lily','Lilydale','geelng','barwon','torquy','CARR','wallan','moora','bacchus','ocean gr','AV','dandenong']){
   const r=await p.evaluate(q=>searchPoints(q,5).map(o=>o.p.k+':'+(o.p.k==='TOWN'?o.p.n:o.p.c)+'('+Math.round(o.sc)+')').join(', '),q); console.log(q.padEnd(10),r); }
 await p.click('#goIn'); await p.type('#goIn','lilyd'); await p.waitForTimeout(200);
 console.log('list', await p.$$eval('#goList li',l=>l.map(x=>x.innerText.replace(/\s+/g,' '))));
 await p.screenshot({path:'play/search.png',clip:{x:0,y:0,width:390,height:520}});
 await p.click('#goList li:nth-child(1)'); await p.waitForTimeout(200);
 console.log('go', await p.evaluate(()=>GO&&GO.c), 'card', await p.textContent('#adId'));
 await p.fill('#goIn',''); await p.type('#goIn','geelong'); await p.waitForTimeout(150); await p.press('#goIn','Enter'); await p.waitForTimeout(150);
 console.log('enter go', await p.evaluate(()=>GO&&[GO.k,GO.c,GO.n]), await p.textContent('#goName'), await p.textContent('#goSub'));
 // map town labels
 await p.evaluate(()=>{ CH.on=false; MAP.range=10; render(); }); await p.waitForTimeout(300); const m=await p.$('#map'); await m.scrollIntoViewIfNeeded(); await m.screenshot({path:'play/towns_map.png'});
 console.log(errs); await b.close(); })();
