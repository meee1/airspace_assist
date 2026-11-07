// NAIPS briefing weather extras: area QNH, SIGMET / AIRMET (polygons on the map, map menu, IN row at your altitude), from a real
// proxy response (fixtures/naips_area_full.json) with the clock at 2300Z 7 Nov 2026.
const {chromium}=require('playwright'); const {PX9}=require('./px9.js'); const fs=require('fs');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({...PX9}); const errs=[];
 await ctx.addInitScript(()=>{ const D=Date, off=D.parse('2026-11-07T23:00:00Z')-D.now(); window.Date=class extends D{ constructor(...a){ super(...(a.length?a:[D.now()+off])); } static now(){ return D.now()+off; } }; });
 const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
 const j=JSON.parse(fs.readFileSync(__dirname+'/fixtures/naips_area_full.json','utf8'));
 await p.goto('http://localhost:8811/index.html?sim=-38.5,152.0&alt=15000&trk=090&gs=120'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(500);
 await p.evaluate(t=>{ nbLoad(t); CH.on=false; MAP.range=320; MAP.up='north'; render(); },j.text); await p.waitForTimeout(400);
 console.log('area QNH:', await p.evaluate(()=>NTN.aq.map(aqTxt).join(' | ')));
 console.log('SIGMET/AIRMET:', await p.evaluate(()=>NTN.sig.length), 'in briefing ·', await p.evaluate(()=>sigCur().map(z=>z.ids.join('/')+' '+z.wx+' '+sigLim(z)).join(' | ')));
 console.log('status:', await p.evaluate(()=>$('nbStat').textContent.split('. ').slice(-3).join('. ')));
 console.log('IN row at A150:', await p.evaluate(()=>$('sInSua').hidden?'(hidden)':$('sInSua').innerText.replace(/\n/g,' ')));
 await p.evaluate(()=>{ $('simAlt').value='35000'; simApply(); MAP.range=320; render(); }); await p.waitForTimeout(300); console.log('IN row at FL350:', await p.evaluate(()=>$('sInSua').hidden?'(hidden)':$('sInSua').innerText.replace(/\n/g,' ')));
 const m=await p.$('#map'); await m.scrollIntoViewIfNeeded(); await m.screenshot({path:'play/nbsig_map.png'});
 await p.evaluate(()=>{ const [x,y]=MAP.P(-37.5,151.0); mapMenu(x,y); }); await p.waitForTimeout(200);
 console.log('map menu:', await p.evaluate(()=>[...document.querySelectorAll('#mmSua .mm-sig summary')].map(e=>e.innerText).join(' | ')));
 await p.evaluate(()=>{ mapMenuClose(); st.pin='YMMB'; render(); }); await p.waitForTimeout(300);
 console.log('YMMB weather card:', await p.evaluate(()=>[...$('adWx').querySelectorAll('.nt')].map(e=>e.textContent).filter(t=>/Area QNH/.test(t)).join(' | ')));
 console.log(errs); await b.close(); })();
