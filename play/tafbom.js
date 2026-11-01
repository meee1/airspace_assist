// BoM TAF guide items: T/Q interpolation, TURB, TAF3, VALID TL, CNL, NIL
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({...PX9}); await ctx.addInitScript(()=>{ const D=Date, off=D.parse('2026-11-01T21:30:00Z')-D.now(); window.Date=class extends D{ constructor(...a){ super(...(a.length?a:[D.now()+off])); } static now(){ return D.now()+off; } }; });
 const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); await p.goto('http://localhost:8811/index.html'); await p.waitForFunction(()=>typeof tafTable==='function');
 const iss=Date.parse('2026-11-01T20:00:00Z');
 console.log(await p.evaluate(i=>{ const raw='TAF YMML 012002Z 0121/0300 02012KT 9999 SHOWERS OF LIGHT RAIN NSC RMK MOD TURB BLW 5000FT FM020300 TL020900 T 14 18 18 17 Q 1013 1014 1012 1010 TAF3 VALID TL 020600';
   const d=document.createElement('div'); d.innerHTML=tafTable(raw,i,DATA.ap.find(a=>a.i==='YMML')); const tq=[...d.querySelectorAll('tr')].find(r=>/Temp/.test(r.innerText));
   return {tq:[...tq.children].slice(0,9).map(c=>c.innerText.replace(/\n/g,' ')).join(' | '), notes:[...d.querySelectorAll('.vnote')].map(n=>n.innerText).join('\n'),
     cnl:tafTable('TAF AMD YMML 012100Z 0121/0300 CNL',i), nil:tafTable('TAF YMML 012002Z NIL',i)}; },iss));
 console.log(errs); await b.close(); })();
