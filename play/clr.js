// clearance request call (trial) when controlled airspace is ahead within 10 NM
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext(PX9);
 await ctx.addInitScript(()=>{ const D=Date, off=D.parse('2026-10-31T01:00:00Z')-D.now(); window.Date=class extends D{ constructor(...a){ super(...(a.length?a:[D.now()+off])); } static now(){ return D.now()+off; } }; });
 const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YBRS&alt=1500&trk=000&gs=90'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(500);
 await p.evaluate(()=>{ $('cType').value='Bell 206'; $('cSign').value='ABC'; $('cSign').dispatchEvent(new Event('change')); $('calls').open=true; });
 for(const [n,pos,alt,trk,go] of [['ybrs_n','-38.30,144.40',1500,10,null],['to_ymmb','-38.02,145.20',1500,290,'YMMB'],['to_ymav','-38.30,144.40',1500,10,'YMAV'],['no_ctl','-37.2,143.0',1500,0,null]]){
  await p.evaluate(([pos,alt,trk,go])=>{ GO=null; if(go){ const a=DATA.ap.find(x=>x.i===go); setGo({k:'AD',c:go,n:a.n,la:a.la,lo:a.lo}); } $('simPos').value=pos; $('simAlt').value=String(alt); $('simTrk').value=String(trk); $('simGs').value='90'; simApply(); render(); render(); },[pos,alt,trk,go]); await p.waitForTimeout(400);
  console.log(n, '|', await p.evaluate(()=>{ const c=document.querySelector('#callsList .call'); return (NX.cls?('NX '+NX.cls.k+' '+NX.cls.d.toFixed(1)+(NX.cls.prd?' prd':'')+(NX.cls.b?' b':'')+' | '):'NX none | ')+$('sNxCls').innerText.replace(/\n/g,' ')+' | '+c.innerText.replace(/\n/g,' || ').slice(0,140); })); }
 await p.evaluate(()=>{ GO=null; $('simPos').value='-38.30,144.40'; $('simTrk').value='10'; simApply(); render(); render(); }); await p.waitForTimeout(300);
 const c=await p.$('#callsList .call'); await c.scrollIntoViewIfNeeded(); await c.screenshot({path:'play/clr.png'});
 console.log(errs); await b.close(); })();
