const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext(PX9); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{ window.__said=[]; Object.defineProperty(window,'speechSynthesis',{value:{speak:u=>window.__said.push(u.text)},configurable:true}); window.SpeechSynthesisUtterance=function(t){ this.text=t; }; });
 await p.goto('http://localhost:8811/index.html?sim=YBRS&alt=1500&trk=000&gs=90'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(500);
 await p.evaluate(()=>{ localStorage.clear(); ls.set('notamUrl','http://localhost:8812'); $('cSign').value='ALPHA BRAVO CHARLIE'; MAP.range=10; MAP.up='trk'; CH.on=false; render(); });
 console.log('before', await p.evaluate(()=>$('sTraffic').hidden+' btn '+$('mapTraffic').getAttribute('aria-pressed')));
 await p.click('#mapTraffic'); await p.waitForFunction(()=>TR.t>0,{timeout:8000}); await p.waitForTimeout(300);
 console.log('targets', await p.evaluate(()=>JSON.stringify(trTargets().map(t=>[t.a.reg,t.lvl,t.d.toFixed(2),t.dA==null?null:Math.round(t.dA),t.clock]))));
 console.log('alert', await p.evaluate(()=>$('sTraffic').hidden?'(hidden)':$('sTraffic').innerText.replace(/\s+/g,' ')), '| said', await p.evaluate(()=>JSON.stringify(window.__said)));
 const m=await p.$('.mapbox'); await m.scrollIntoViewIfNeeded(); await m.screenshot({path:'play/traffic_map.png'});
 await (await p.$('.status')).screenshot({path:'play/traffic_top.png'});
 await p.waitForTimeout(10500); console.log('repoll said', await p.evaluate(()=>window.__said.length), 'stat', await p.evaluate(()=>$('trStat').textContent));
 // stale: stop proxy answers
 await p.evaluate(()=>{ ls.set('notamUrl','http://localhost:8899'); TR.t=Date.now()-40e3; render(); });
 console.log('stale msg drawn ok; alert', await p.evaluate(()=>$('sTraffic').hidden?'(hidden)':$('sTraffic').innerText.replace(/\s+/g,' ')));
 await p.click('#mapTraffic'); console.log('off', await p.evaluate(()=>$('sTraffic').hidden));
 const c=await p.$('.mapctl'); await c.screenshot({path:'play/traffic_btns.png'});
 console.log(errs); await b.close(); })();
