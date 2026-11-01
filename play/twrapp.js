// a towered aerodrome you're only passing shows its approach frequency in the CTAF tile; tower when it's the plan/Go to or you're in its zone
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext(PX9);
 await ctx.addInitScript(()=>{ const D=Date, T=D.parse('2026-10-30T01:00:00Z'), off=T-D.now(); window.Date=class extends D{ constructor(...a){ super(...(a.length?a:[D.now()+off])); } static now(){ return D.now()+off; } }; });
 const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=2500&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(600);
 const tile=()=>p.evaluate(()=>[$('sCtafLbl').textContent,$('sCtaf').textContent,$('sCtafAd').textContent].join(' '));
 const at=async(pos,alt)=>{ await p.evaluate(([pos,alt])=>{ $('simPos').value=pos; $('simAlt').value=String(alt); simApply(); render(); },[pos,alt]); await p.waitForTimeout(300); return tile(); };
 await p.evaluate(()=>{ FP=null; GO=null; ls.set('fp',null); });
 console.log('near YMMB outside its zone, 4500 ft :', await at('-38.04,145.18',4500));
 console.log('inside YMMB zone, 1500 ft         :', await at('-37.98,145.12',1500));
 console.log('near YMAV outside its zone, 4000 ft :', await at('-38.13,144.55',4000));
 console.log('near YMEN (in YMML zone) 3000 ft    :', await at('-37.70,144.95',3000));
 await p.evaluate(()=>{ const a=DATA.ap.find(x=>x.i==='YMAV'); setGo({k:'AD',c:'YMAV',n:a.n,la:a.la,lo:a.lo}); });
 console.log('near YMAV, Go to YMAV               :', await at('-38.13,144.55',4000));
 await p.evaluate(()=>{ GO=null; FP={name:'t',i:0,pts:[{n:'YBRS',c:'YBRS',la:-38.2581,lo:144.4275},{n:'YMMB',c:'YMMB',la:-37.9758,lo:145.1022}]}; });
 console.log('near YMMB, YMMB in the plan         :', await at('-38.04,145.18',4500));
 console.log(errs); await b.close(); })();
