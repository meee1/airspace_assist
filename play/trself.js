// traffic: own aircraft is never a target (callsign, learnt hex, moves-with-you)
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const p=await (await b.newContext(PX9)).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=090&gs=100'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(800);
 const run=(ac)=>p.evaluate(ac=>{ $('cSign').value='ABC'; MAP.traffic=true; $('simPos').value='-38.0,145.3'; $('simTrk').value='090'; $('simGs').value='100'; $('simAlt').value='1500'; simApply();
   TR.ac=ac; TR.t=Date.now(); render(); return {targets:trTargets().map(t=>(t.a.hex)+':'+t.lvl).join(' '), alert:$('sTraffic').hidden?'-':$('sTraffic').innerText, own:TROWN.hex&&TROWN.hex.h}; },ac);
 const me={hex:'7c0001',la:-38.0,lo:145.3-0.4/60/Math.cos(38*Math.PI/180),trk:92,gs:98,ab:1800,seen:4};   // 0.4 NM behind (lag), pressure alt +300
 const head={hex:'7c0002',reg:'VH-XYZ',type:'C172',la:-38.0,lo:145.3+1.5/60/Math.cos(38*Math.PI/180),trk:270,gs:100,ab:1600,seen:1};
 const cross={hex:'7c0003',reg:'VH-CRS',la:-38.0+0.5/60,lo:145.3,trk:180,gs:100,ab:1500,seen:1};
 const regme={hex:'7c0004',reg:'VH-ABC',la:-37.9,lo:145.4,trk:0,gs:100,ab:1500,seen:1};
 console.log('poll1', JSON.stringify(await run([me,head,cross,regme])));
 console.log('poll2', JSON.stringify(await run([me,head,cross,regme])));
 // now the learnt hex is ignored even when it drifts away (bad GPS / turn)
 console.log('poll3 drift', JSON.stringify(await run([{...me,lo:me.lo-0.6/60,trk:150},head])));
 console.log('no self, only head-on', JSON.stringify(await run([head])));
 console.log(errs); await b.close(); })();
