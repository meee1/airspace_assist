// The inbound call's "estimate circuit at time mm" follows the plan (21 Nov 2026, Michael: "Does the inbound time include a
// coastal route? Or include a waypoint?" -> "Yes" to fixing): along a coast leg and through the waypoints before the
// aerodrome, at the same speeds as the TOT tile; a plain Go to stays the straight line. Clock at night so Moorabbin is a
// CTAF (the CTAF inbound call carries the estimate). node play/inbeta.js  (app on :8811)
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(), errs=[], fail=[]; const ok=(c,m)=>{ console.log((c?'ok   ':'FAIL ')+m); if(!c) fail.push(m); };
  const ctx=await b.newContext({...PX9,storageState:{cookies:[],origins:[{origin:'http://localhost:8811',localStorage:[{name:'rc_fsMap',value:'false'}]}]}});
  await ctx.addInitScript(()=>{ const D=Date, off=D.parse('2026-11-21T12:00:00Z')-D.now(); window.Date=class extends D{ constructor(...a){ super(...(a.length?a:[D.now()+off])); } static now(){ return D.now()+off; } }; });
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8811/index.html?sim=YBRS&alt=1500&trk=090&gs=90'); await p.waitForFunction(()=>typeof render==='function'&&st.pos);
  // the estimate in the call, the straight-line one and the plan one, at a given position
  const est=()=>p.evaluate(()=>{ const a=DATA.ap.find(x=>x.i==='YMMB'), [d,bb]=distBrg(st.pos[0],st.pos[1],a.la,a.lo), c=inboundCall(a,d,bb), m=/estimate circuit at time (\d\d)/.exec(c.txt);
    const mm=t=>String(new Date(t).getUTCMinutes()).padStart(2,'0'), pe=planEtaTo(a);
    return {call:m&&m[1], straight:mm(Date.now()+d/st.gs*3600e3), plan:pe&&mm(pe.t), D:pe&&pe.D, d, tot:$('nTotV').textContent+' '+$('nTotS').textContent}; });
  // 1. coast leg YBRS -> YMMB, flying it from a turn point about two thirds of the way back
  await p.evaluate(async()=>{ ls.set('coastOff',500); ls.set('coastGap',2); COAST.off=500; COAST.gap=2; fpSet({name:'t',kind:'map',pts:[fpPt(findPoint('YBRS')),fpPt(findPoint('YMMB'))],i:1}); await fpCoastSet(FP.pts[1],true); });
  await p.evaluate(()=>{ const n=FP.pts.length, k=Math.round(n*0.35), q=FP.pts[k]; fpPick(k+1); $('simPos').value=q.la.toFixed(5)+','+q.lo.toFixed(5); simApply(); render(); });
  let r=await est(); console.log(`     coast: ${r.D.toFixed(1)} NM along the route vs ${r.d.toFixed(1)} direct · call :${r.call}, plan :${r.plan}, straight :${r.straight} · TOT ${r.tot}`);
  ok(r.call===r.plan&&r.D>r.d+3,'coast leg: the call uses the time along the coast route');
  ok(new RegExp('^\\d\\d'+r.call+'Z YMMB ').test(r.tot),'and it matches the TOT tile\'s time for YMMB ('+r.tot+')');
  ok(r.call!==r.straight,'(and isn\'t the straight-line time)');
  // 2. the YBRS plan, YLIL then ACE then YMMB: from near YLIL with ACE active
  await p.setInputFiles('#fpFile',__dirname+'/fixtures/ybrs.gpx'); await p.waitForFunction(()=>FP&&FP.pts.length===14);
  await p.evaluate(()=>{ const y=FP.pts.findIndex(q=>q.c==='YLIL'); fpPick(y+1); $('simPos').value='-37.70,145.05'; simApply(); render(); });
  r=await est(); const via=await p.evaluate(()=>FP.pts[FP.i].c);
  console.log(`     via ${via}: ${r.D.toFixed(1)} NM along the plan vs ${r.d.toFixed(1)} direct · call :${r.call}, plan :${r.plan}, straight :${r.straight}`);
  ok(via==='ACE'&&r.call===r.plan&&r.D>r.d+2,'waypoint before the aerodrome: the call goes via ACE');
  // 3. a Go to Moorabbin, no plan: the straight line
  await p.evaluate(()=>{ fpSet(null); setGo(findPoint('YMMB')); render(); });
  r=await est(); ok(r.plan===null&&r.call===r.straight,`Go to only: straight line (:${r.call})`);
  console.log(fail.length? fail.length+' FAILED':'all passed'); console.log(errs); await b.close(); process.exit(fail.length?1:0); })();
