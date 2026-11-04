// Render timing panel (Options -> Render timing): off = nothing shown and no errors; on = per-stage ms for render and drawMap, copy text
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({...PX9}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=090&gs=90'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(1500);
 console.log('off: panel hidden', await p.evaluate(()=>$('perfBox').hidden), '· stats', await p.evaluate(()=>PF.st.size));
 await p.evaluate(()=>{ $('optPerf').checked=true; $('optPerf').dispatchEvent(new Event('change')); MAP.ctaf=true; });
 for(let k=0;k<12;k++){ await p.evaluate(()=>{ render(); }); await p.waitForTimeout(120); }
 await p.waitForTimeout(600);
 console.log('on: panel shown', await p.evaluate(()=>!$('perfBox').hidden));
 const txt=await p.evaluate(()=>pfText()); console.log(txt.split('\n').filter(l=>!/Mozilla/.test(l)).join('\n'));
 const sum=await p.evaluate(()=>{ const g=t=>[...PF.st.values()].filter(s=>s.tag===t); const tot=t=>g(t).find(s=>s.name==='TOTAL').last, parts=t=>g(t).filter(s=>s.name!=='TOTAL').reduce((a,s)=>a+s.last,0); return `render total ${tot('render').toFixed(1)} vs parts ${parts('render').toFixed(1)} · map total ${tot('map').toFixed(1)} vs parts ${parts('map').toFixed(1)}`; });
 console.log('check:', sum);
 await p.screenshot({path:'perf_panel.png'});
 await p.click('#perfBox [data-pf="min"]'); console.log('minimised:', await p.evaluate(()=>$('perfBox').innerText.replace(/\s+/g,' ')));
 await p.screenshot({path:'perf_min.png'}); await p.click('#perfBox [data-pf="max"]');
 console.log('rows shown', await p.evaluate(()=>$('perfBox').querySelectorAll('tr').length)); await p.click('#perfBox [data-pf="all"]'); console.log('rows with all', await p.evaluate(()=>$('perfBox').querySelectorAll('tr').length));
 await p.click('#perfBox [data-pf="reset"]'); console.log('reset → stats', await p.evaluate(()=>PF.st.size));
 await p.click('#perfBox [data-pf="off"]'); console.log('✕ → on', await p.evaluate(()=>PF.on), 'hidden', await p.evaluate(()=>$('perfBox').hidden), 'option', await p.evaluate(()=>$('optPerf').checked));
 // reload with it saved on: no startup errors
 await p.evaluate(()=>ls.set('perfOn',true)); await p.reload(); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(1500);
 console.log('reload with it on: stats', await p.evaluate(()=>PF.st.size), 'panel', await p.evaluate(()=>!$('perfBox').hidden));
 console.log(errs); await b.close(); })();
