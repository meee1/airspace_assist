// Fuel timer (More → Fuel timer, or tap the FUEL row) and the Range map button: fuel left, time and range to the reserve,
// auto start at 40 kt / stop after 3 min slow, reminder, range circle on the map. The clock is moved with a fake Date.
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({...PX9,deviceScaleFactor:2}); const errs=[];
 await ctx.addInitScript(()=>{ const D=Date; let off=D.parse('2026-11-08T23:00:00Z')-D.now(); window.__adv=ms=>{ off+=ms; }; window.Date=class extends D{ constructor(...a){ super(...(a.length?a:[D.now()+off])); } static now(){ return D.now()+off; } }; });
 const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); const spoken=[];
 await p.exposeFunction('__said',t=>spoken.push(t));
 await p.addInitScript(()=>{ Object.defineProperty(window,'speechSynthesis',{value:{speak:u=>window.__said(u.text)},configurable:true}); window.SpeechSynthesisUtterance=function(t){ this.text=t; }; });
 await p.goto('http://localhost:8811/index.html?sim=YBRS&alt=1500&trk=045&gs=0'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(500);
 console.log('before set: row hidden', await p.evaluate(()=>$('sFuel').hidden));
 await p.evaluate(()=>{ $('mapRange').click(); }); console.log('Range with no fuel set opens the timer:', await p.evaluate(()=>$('fuDlg').open));
 await p.fill('#fuFob','300'); await p.fill('#fuBurn','100'); await p.selectOption('#fuRem','20'); await p.click('#fuSet');
 console.log('set 300 L at 100 L/h:', await p.evaluate(()=>$('fuNow').innerText.replace(/\n/g,' · ')));
 await p.click('#fuClose');
 // fly: GS 100 kt -> auto start; 1 h later
 await p.evaluate(()=>{ $('simGs').value='100'; simApply(); }); await p.waitForTimeout(5500);
 console.log('moving at 100 kt: running', await p.evaluate(()=>FUEL.on));
 await p.evaluate(()=>{ __adv(60*60e3); fuTick(); render(); }); await p.waitForTimeout(300);
 console.log('after 1 h:', await p.evaluate(()=>$('sFuel').innerText.replace(/\n/g,' ')), '· reminder fired', await p.evaluate(()=>Date.now()-FUEL.remT<10e3), '· spoken', JSON.stringify(spoken.slice(-1)));
 await p.evaluate(()=>{ $('mapRange').click(); MAP.range=160; MAP.up='north'; CH.on=false; render(); }); await p.waitForTimeout(500);
 const m=await p.$('#map'); await m.scrollIntoViewIfNeeded(); await m.screenshot({path:'play/fuel_range.png'});
 console.log('range on:', await p.evaluate(()=>ls.get('rangeRing')), '· range NM', await p.evaluate(()=>Math.round(fuState().rangeNM)));
 // 50 more min: amber, then below reserve
 await p.evaluate(()=>{ __adv(50*60e3); fuTick(); }); console.log('after 1:50:', await p.evaluate(()=>$('sFuel').className+' | '+$('sFuel').innerText.replace(/\n/g,' ')));
 await p.evaluate(()=>{ __adv(20*60e3); fuTick(); }); console.log('after 2:10:', await p.evaluate(()=>$('sFuel').className+' | '+$('sFuel').innerText.replace(/\n/g,' ')));
 // land: slow for 3+ min -> stops
 await p.evaluate(()=>{ $('simGs').value='0'; simApply(); }); await p.waitForTimeout(5500); await p.evaluate(()=>{ __adv(4*60e3); fuTick(); fuTick(); });
 console.log('stopped after 3 min slow:', await p.evaluate(()=>!FUEL.on), '· kept after reload', await (async()=>{ await p.reload(); await p.waitForFunction(()=>typeof render==='function'); return p.evaluate(()=>FUEL.fob===300&&!FUEL.on&&FUEL.run>0); })());
 await p.evaluate(()=>$('bOpts').click()); await p.waitForTimeout(300);
 console.log('Options tiles without a sample:', await p.evaluate(()=>[...document.querySelectorAll('#optsTiles label')].filter(l=>!l.querySelector('.tpv .status').innerHTML.trim()).map(l=>l.textContent.trim()).join(', ')||'none'));
 console.log(errs); await b.close(); })();
