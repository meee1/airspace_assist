// Area briefing PDF (NAIPS "Area Briefing Results For Area 9300", 1 Nov 2026) through the app's Open PDF path
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({...PX9}); await ctx.addInitScript(()=>{ const D=Date, off=D.parse('2026-11-01T21:30:00Z')-D.now(); window.Date=class extends D{ constructor(...a){ super(...(a.length?a:[D.now()+off])); } static now(){ return D.now()+off; } }; });
 const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message+' '+(e.stack||'').split('\n')[1]));
 await p.goto('http://localhost:8811/index.html?sim=YBRS&alt=1500&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(1000);
 await p.setInputFiles('#nbFile','play/fixtures/area_brief2.pdf'); await p.waitForFunction(()=>window.NTN&&NTN.title&&/9300/.test(NTN.title),null,{timeout:20000}).catch(()=>{});
 await p.waitForTimeout(800);
 console.log(await p.evaluate(()=>({stat:$('nbStat').innerText, sum:$('ntSum').textContent, items:NTN&&NTN.items.length, ids:NTN&&new Set(NTN.items.map(n=>n.id)).size, none:NTN&&NTN.none.length,
   met:NTN&&Object.keys(NTN.met).length, metar:NTN&&Object.values(NTN.met).filter(m=>m.metar).length, taf:NTN&&Object.values(NTN.met).filter(m=>m.taf).length,
   locs:NTN&&[...new Set(NTN.items.map(n=>n.loc))].join(' '), noDates:NTN&&NTN.items.filter(n=>!n.from).map(n=>n.loc+' '+n.id).join(', '),
   tafs:NTN&&Object.entries(NTN.met).filter(([k,m])=>m.taf).map(([k,m])=>k+': '+m.taf.raw).join('\n') })));
 require('fs').writeFileSync('/tmp/claude-0/ids_app.txt', (await p.evaluate(()=>NTN.items.map(n=>n.id).join('\n')))+'\n');
 console.log(errs); await b.close(); })();
