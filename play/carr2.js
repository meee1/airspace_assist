// Arriving at Moorabbin via CARR with no plan or Go to (as in a GPX replay): every tower read-out says West 123.0
// (ERSA: RWY 17/35, ARR from the S via CARR on 123.0); from the east it's East 118.1; with RWY 04 picked, CARR is East
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({...PX9}); await ctx.addInitScript(()=>{ const D=Date, off=D.parse('2026-11-02T01:30:00Z')-D.now(); window.Date=class extends D{ constructor(...a){ super(...(a.length?a:[D.now()+off])); } static now(){ return D.now()+off; } }; });
 const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=330&gs=90'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(800);
 await p.evaluate(()=>{ localStorage.removeItem('rc_fp'); FP=null; setGo(null); $('cType').value='Bell 206'; $('cSign').value='ABC'; });
 const at=(f,from,rwy)=>p.evaluate(([f,from,rwy])=>{ const A=DATA.ap.find(x=>x.i==='YMMB'), C=VWby.get('CARR'), S=from==='E'? {la:A.la+0.02,lo:A.lo+0.2} : {la:C.la+(C.la-A.la)*0.9,lo:C.lo+(C.lo-A.lo)*0.9};   // start beyond CARR on the same line
   const la=S.la+(A.la-S.la)*f, lo=S.lo+(A.lo-S.lo)*f, trk=Math.round((Math.atan2((A.lo-S.lo)*Math.cos(A.la*Math.PI/180),A.la-S.la)*180/Math.PI+360)%360);
   $('cRwy').value=rwy||''; $('simPos').value=la.toFixed(5)+','+lo.toFixed(5); $('simTrk').value=String(trk).padStart(3,'0'); simApply(); render(); render();
   const t=id=>{ const e=$(id); return e&&!e.hidden? e.innerText.replace(/\s+/g,' ') : ''; }, pick=x=>(x.match(/(Twr ?[EW]|TWR ?[EW]|Tower (?:East|West))?[^0-9]{0,30}(118\.1|123\.0)/)||[''])[0].replace(/\s+/g,' ').trim();
   const d=distBrg(la,lo,A.la,A.lo)[0], dc=distBrg(la,lo,C.la,C.lo)[0];
   return `${d.toFixed(1).padStart(4)} NM (CARR ${dc.toFixed(1)}) | CTAF tile: ${pick(t('sCtafBox'))||t('sCtafBox').slice(0,30)} | ATC tile: ${pick(t('sAreaBox'))||'-'} | ctl row: ${pick(t('sCtl'))||'-'} | NEXT CLASS: ${pick(t('sNxCls'))||'-'} | calls: ${$('callsAt').textContent}`; },[f,from,rwy]);
 console.log('--- from the south via CARR (no plan, no Go to)'); for(const f of [0,0.3,0.5,0.65,0.8]) console.log(await at(f,'S'));
 console.log('--- from the east'); for(const f of [0.3,0.6]) console.log(await at(f,'E'));
 console.log('--- via CARR with RWY 04 picked'); console.log(await at(0.5,'S','04'));
 // plan check via CARR
 const pc=await p.evaluate(()=>{ $('cRwy').value=''; const A=DATA.ap.find(x=>x.i==='YMMB'), C=VWby.get('CARR'); fpSet({name:'T',pts:[{n:'S',la:C.la-0.15,lo:C.lo+0.05},{n:'CARR',c:'CARR',la:C.la,lo:C.lo},{n:'YMMB',c:'YMMB',la:A.la,lo:A.lo}],i:1});
   const r=planCheck(1500,90,Date.now()); return JSON.stringify(r).match(/Moorabbin Twr [EW][^"]{0,30}|TWR [EW] [0-9.]+ Moorabbin Tower/g); });
 console.log('--- plan check via CARR:', JSON.stringify([...new Set(pc||[])]));
 console.log(errs); await b.close(); })();
