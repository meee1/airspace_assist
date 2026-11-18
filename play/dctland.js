// A direct-to an aerodrome during a flight plan counts as landing there (18 Nov 2026). node play/dctland.js  (app on :8811)
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(), errs=[], fail=[]; const ok=(c,m)=>{ console.log((c?'ok   ':'FAIL ')+m); if(!c) fail.push(m); };
  const ctx=await b.newContext({...PX9,storageState:{cookies:[],origins:[{origin:'http://localhost:8811',localStorage:[{name:'rc_fsMap',value:'false'}]}]}});
  await ctx.addInitScript(()=>{ const D=Date, off=D.parse('2026-11-01T01:30:00Z')-D.now(); window.Date=class extends D{ constructor(...a){ super(...(a.length?a:[D.now()+off])); } static now(){ return D.now()+off; } }; });
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8811/index.html?sim=-38.10,145.45&alt=1500&trk=000&gs=90'); await p.waitForFunction(()=>typeof render==='function'&&st.pos);
  await p.setInputFiles('#fpFile',__dirname+'/fixtures/ybrs.gpx'); await p.waitForFunction(()=>FP&&FP.pts.length>5);
  const fly=()=>p.evaluate(()=>{ const a=DATA.ap.find(x=>x.i==='YSCP'), s=[st.pos[0],st.pos[1]], n=40; let row='', at=null;
    for(let k=0;k<=n;k++){ const la=s[0]+(a.la-s[0])*k/n, lo=s[1]+(a.lo-s[1])*k/n; $('simPos').value=la.toFixed(5)+','+lo.toFixed(5); simApply(); render();
      if(!$('sInbound').hidden&&!row){ row=$('sInbound').textContent; at=distBrg(la,lo,a.la,a.lo)[0]; } }
    return {row, at, stop:adStop(a), dct:!!FP.dct}; });
  // plan only (no direct-to): Caribbean Park isn't in it -> transit
  let r=await fly(); ok(!r.stop&&/TRANSIT CALL/.test(r.row),'plan, YSCP not in it: transit call ('+r.row.slice(0,60)+')');
  // direct-to Caribbean Park: a diversion -> inbound
  await p.evaluate(()=>{ $('simPos').value='-38.10,145.45'; simApply(); INB.on=null; INB.armed={}; const a=DATA.ap.find(x=>x.i==='YSCP'); setGo({k:'AD',c:a.i,n:a.n,la:a.la,lo:a.lo}); render(); });
  r=await fly(); ok(r.dct&&r.stop&&/INBOUND CALL/.test(r.row)&&/Caribbean Park traffic/.test(r.row)&&r.at<=10.2,'direct-to YSCP: inbound call at '+(r.at&&r.at.toFixed(1))+' NM ('+r.row.slice(0,70)+')');
  // resume the plan: not a stop any more
  await p.evaluate(()=>{ fpResume(); render(); }); ok(!(await p.evaluate(()=>adStop(DATA.ap.find(x=>x.i==='YSCP')))),'Resume plan: YSCP no longer counted as landing');
  console.log(fail.length? fail.length+' FAILED':'all passed'); console.log(errs); await b.close(); process.exit(fail.length?1:0); })();
