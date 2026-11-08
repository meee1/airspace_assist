// Pre-flight brief (Plan check) with a real NAIPS briefing at 2300Z 7 Nov 2026: ATIS on the aerodrome card, weather at the
// plan's aerodromes at ETA, area QNH, SIGMET on the route in the timeline, SIGMET AHEAD in the top bar, offline readiness.
const {chromium}=require('playwright'); const {PX9}=require('./px9.js'); const fs=require('fs');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({...PX9}); const errs=[];
 await ctx.addInitScript(()=>{ const D=Date, off=D.parse('2026-11-07T23:00:00Z')-D.now(); window.Date=class extends D{ constructor(...a){ super(...(a.length?a:[D.now()+off])); } static now(){ return D.now()+off; } }; });
 const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
 const j=JSON.parse(fs.readFileSync(__dirname+'/fixtures/naips_area_full.json','utf8'));
 await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(500);
 await p.evaluate(t=>{ nbLoad(t); st.pin='YMML'; render(); },j.text); await p.waitForTimeout(300);
 console.log('YMML card ATIS:', await p.evaluate(()=>$('adWx').querySelector('summary').textContent+' | '+[...$('adWx').querySelectorAll('.atis div')].map(e=>e.textContent).join(' / ')));
 await p.evaluate(()=>{ st.pin='YMES'; render(); }); console.log('YMES ATIS:', await p.evaluate(()=>$('adWx').querySelector('.nt .h').textContent));
 // a plan YMMB -> YMAV -> YBLT
 await p.evaluate(()=>{ st.pin=null; const pt=c=>{ const a=DATA.ap.find(x=>x.i===c); return {n:a.n,c:a.i,la:a.la,lo:a.lo}; }; FP={name:'Test',pts:[pt('YMMB'),pt('YMAV'),pt('YBLT')],i:1}; ls.set('fp',FP); render(); });
 await p.evaluate(()=>{ $('pcDep').value='10:05'; $('fpCheck').click(); }); await p.waitForTimeout(2500);
 console.log('brief:', await p.evaluate(()=>[...$('pcOut').querySelectorAll('.pc-sec')].map(e=>e.textContent).join(' | ')));
 console.log('briefing line:', await p.evaluate(()=>$('pcOut').querySelector('.pc-sec+.vnote').textContent));
 console.log('weather rows:\n  '+await p.evaluate(()=>[...$('pcOut').querySelectorAll('.pc-sec')].find(e=>/Weather/.test(e.textContent)).nextElementSibling.innerText.replace(/\n(?=[A-Z]{4}\b)/g,'\n  ').replace(/\t/g,' ')));
 console.log('area QNH:', await p.evaluate(()=>[...$('pcOut').querySelectorAll('.vnote')].map(e=>e.textContent).filter(t=>/Area QNH|SIGMET/.test(t)).join(' | ')));
 console.log('ready:', await p.evaluate(()=>{ const e=$('pcOut').querySelector('.pc-ready'); return e? e.innerText.replace(/\n/g,' | ') : '(not yet)'; }));
 await p.evaluate(()=>$('pcDlg').close());
 // SIGMET ahead: a plan from off Gabo Island east into SIGMET B11/U12 (SEV TURB A100-FL300), flying at A150
 await p.evaluate(()=>{ FP={name:'Sea',pts:[{n:'A',la:-37.6,lo:148.8},{n:'B',la:-37.6,lo:150.5}],i:1}; ls.set('fp',FP); $('simPos').value='-37.6,148.8'; $('simAlt').value='15000'; $('simGs').value='120'; $('simTrk').value='090'; simApply(); render(); }); await p.waitForTimeout(400);
 console.log('top bar at A150:', await p.evaluate(()=>$('sInSua').hidden?'(hidden)':$('sInSua').innerText.replace(/\n/g,' ')));
 await p.evaluate(()=>{ $('simAlt').value='5000'; simApply(); render(); }); await p.waitForTimeout(300);
 console.log('top bar at A050:', await p.evaluate(()=>$('sInSua').hidden?'(hidden)':$('sInSua').innerText.replace(/\n/g,' ')));
 await p.evaluate(()=>{ $('simAlt').value='15000'; simApply(); $('fpCheck').click(); $('pcAlt').value='15000'; $('pcRun').click(); }); await p.waitForTimeout(1500);
 console.log('timeline SIGMET:', await p.evaluate(()=>[...$('pcOut').querySelectorAll('tr')].filter(t=>/SIGMET/.test(t.textContent)).map(t=>t.innerText.replace(/\s+/g,' ')).join(' | ')));
 console.log(errs); await b.close(); })();
