// Weight and balance: made-up TEST profile (not real POH numbers) — load checks, plan fuel, max fuel, fixes, plan check summary
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
const PROF={id:'ptest',name:'TEST aircraft',u:'kg',maxW:1100,ew:700,ea:2300,el:0,dens:0.72,
  st:[{n:'Pilot',k:'seat',a:2300,l:-300,max:140},{n:'Front passenger',k:'seat',a:2300,l:300,max:140},{n:'Rear seats',k:'seat',a:3200,l:0,max:200},{n:'Baggage',k:'bag',a:3700,l:0,max:50},{n:'Front locker',k:'bag',a:1900,l:0,max:30},{n:'Fuel',k:'fuel',a:2500,l:0,max:180}],
  env:'2200,700\n2200,950\n2300,1100\n2550,1100\n2550,700', lenv:'-40,700\n-40,1100\n40,1100\n40,700'};
const CASES=[['normal',[85,75,0,10,0,120]],['aft: 2 rear + full bags',[85,75,180,50,0,150]],['heavy',[110,100,200,40,0,180]],['lateral: pilot only, heavy',[140,0,0,0,0,60]],['empty fuel',[85,75,0,10,0,0]],['fwd: 2 front, nothing aft',[140,140,0,0,30,40]],['rear pax one side',[85,0,120,0,0,100]]];
(async()=>{ const b=await chromium.launch(); for(const dev of ['phone','tab']){ const ctx=await b.newContext(dev==='phone'?{...PX9}:{viewport:{width:1280,height:800},deviceScaleFactor:1.5,isMobile:true,hasTouch:true,storageState:{cookies:[],origins:[{origin:'http://localhost:8811',localStorage:[{name:'rc_fsMap',value:'true'}]}]}});
 const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); await p.goto('http://localhost:8811/index.html?sim=YBRS&alt=50&trk=000&gs=0'); await p.waitForFunction(()=>typeof wbCheck==='function'); await p.waitForTimeout(600);
 await p.evaluate(P=>{ WB={profiles:[P],cur:P.id,load:{}}; wbSave(); ls.set('pcBurn',40); ls.set('pcGs',100); const ad=i=>{ const a=DATA.ap.find(x=>x.i===i); return {n:a.i,c:a.i,la:a.la,lo:a.lo}; }; fpSet({name:'T',pts:[ad('YBRS'),ad('YLIL')],i:0}); },PROF);
 if(dev==='phone') for(const [n,v] of CASES){ const r=await p.evaluate(v=>{ WB.load.ptest=v; const P=wbCur(), r=wbCheck(P,v), mf=wbMaxFuel(P,v), fx=r.ok?[]:wbFixes(P,v);
     const f=q=>q?Math.round(q.w)+'kg@'+Math.round(q.a)+'/'+Math.round(q.l):'-'; return `${r.ok?'OK ':'OUT'} TO ${f(r.to)} LDG ${f(r.ld)} ZF ${f(r.zf)} · maxfuel ${mf} · plan need ${r.pf?Math.ceil(r.pf.need):'-'}\n     ${r.why.join(' | ')}\n     fixes: ${fx.map(x=>x.txt.replace(/<[^>]+>/g,'')).join(' | ')}`; },v); console.log(n.padEnd(28),r); }
 // the dialog
 await p.evaluate(()=>{ WB.load.ptest=[85,75,180,50,0,150]; wbSave(); }); await p.evaluate(()=>{ if(document.body.classList.contains('fsm')) $('fsTabs').querySelector('[data-fs="fpBox"]').click(); });
 await p.waitForTimeout(400); await p.evaluate(()=>$('fpWb').click()); await p.waitForTimeout(500);
 await (await p.$('#wbDlg')).screenshot({path:`play/wb_${dev}.png`}); await p.evaluate(()=>{ const d=$('wbDlg'); d.scrollTop=d.scrollHeight; }); await p.waitForTimeout(200); await (await p.$('#wbDlg')).screenshot({path:`play/wb_${dev}_2.png`});
 // type into the load: rear seats down to 80 -> back in limits
 await p.fill('#wbLoad input[data-v="2"]','80'); await p.waitForTimeout(400); console.log(dev,'after rear 80:', await p.evaluate(()=>$('wbOut').querySelector('.wb-res').innerText));
 // profile editor: a fresh profile shows what's missing
 await p.evaluate(()=>{ $('wbProf').open=true; }); await p.waitForTimeout(200); if(dev==='tab'){ await p.evaluate(()=>$('wbDlg').scrollTop=0); await (await p.$('#wbDlg')).screenshot({path:'play/wb_prof.png'}); } await p.evaluate(()=>$('wbNewP').click()); await p.waitForTimeout(200); console.log(dev,'new:', await p.evaluate(()=>$('wbOut').innerText.slice(0,160)));
 await p.evaluate(()=>{ $('wbProfSel').value='ptest'; $('wbProfSel').dispatchEvent(new Event('change')); $('wbDlg').close(); });
 if(dev==='phone'){ await p.evaluate(()=>{ $('fpCheck').click(); }); await p.waitForTimeout(800); console.log('plan check:', await p.evaluate(()=>{ const t=$('pcOut').innerText, k=t.indexOf('WEIGHT AND BALANCE'); return k<0?'(none) '+t.slice(0,80):t.slice(k,k+260); })); }
 console.log(dev,'errors',errs); await ctx.close(); } await b.close(); })();
