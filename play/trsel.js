// tap a traffic symbol: selected ring + details box (callsign, alt, direction, distance); tap again / elsewhere clears
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext(PX9); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YBRS&alt=1500&trk=000&gs=90'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(500);
 await p.evaluate(()=>{ localStorage.clear(); ls.set('notamUrl','http://localhost:8812'); $('cSign').value='ALPHA BRAVO CHARLIE'; MAP.range=10; MAP.up='trk'; CH.on=false; render(); });
 await p.click('#mapTraffic'); await p.waitForFunction(()=>TR.t>0&&MAP.trHits&&MAP.trHits.length,{timeout:8000}); await p.waitForTimeout(300);
 const box=await (await p.$('#map')).boundingBox(); const m=await p.$('.mapbox'); await m.scrollIntoViewIfNeeded();
 await m.screenshot({path:'play/trsel_0.png'});
 const tap=async hex=>{ const h=await p.evaluate(x=>MAP.trHits.find(q=>q.hex===x),hex); const bb=await (await p.$('#map')).boundingBox(); await p.mouse.click(bb.x+h.x+3,bb.y+h.y+2); await p.waitForTimeout(300); };
 const hexes=await p.evaluate(()=>MAP.trHits.map(h=>h.hex)); console.log('targets',hexes);
 await tap('7c2222'); console.log('sel',await p.evaluate(()=>TR.sel)); await m.screenshot({path:'play/trsel_1.png'});
 await tap('7c1234'); console.log('sel',await p.evaluate(()=>TR.sel)); await m.screenshot({path:'play/trsel_2.png'});
 await p.waitForTimeout(10500); console.log('after repoll sel',await p.evaluate(()=>TR.sel));
 await tap('7c1234'); console.log('tap again ->',await p.evaluate(()=>TR.sel));
 await tap('7c1234'); const bb=await (await p.$('#map')).boundingBox(); await p.mouse.click(bb.x+20,bb.y+bb.height-60); await p.waitForTimeout(300); console.log('tap elsewhere ->',await p.evaluate(()=>TR.sel), 'go', await p.evaluate(()=>st.go&&st.go.c));
 await p.evaluate(()=>{ MAP.up='north'; TR.sel='7c3333'; render(); }); await p.waitForTimeout(300); await m.screenshot({path:'play/trsel_3.png'});
 console.log(errs); await b.close(); })();
