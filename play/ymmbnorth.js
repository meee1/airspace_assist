// Moorabbin from the north with a Go to (19 Nov 2026): the inbound call at 10 NM; no clearance request (landing there: the inbound
// call is the request); no transit calls for other fields within 15 NM of Moorabbin. node play/ymmbnorth.js  (app on :8811)
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(), errs=[], fail=[]; const ok=(c,m)=>{ console.log((c?'ok   ':'FAIL ')+m); if(!c) fail.push(m); };
  for(const [lab,iso] of [['day','2026-11-01T01:30:00Z'],['night','2026-11-01T12:30:00Z']]){
    const ctx=await b.newContext({...PX9,storageState:{cookies:[],origins:[{origin:'http://localhost:8811',localStorage:[{name:'rc_fsMap',value:'false'}]}]}});
    await ctx.addInitScript(t=>{ const D=Date, off=D.parse(t)-D.now(); window.Date=class extends D{ constructor(...a){ super(...(a.length?a:[D.now()+off])); } static now(){ return D.now()+off; } }; },iso);
    const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
    await p.goto('http://localhost:8811/index.html?sim=-37.725,145.105&alt=1000&trk=168&gs=90'); await p.waitForFunction(()=>typeof render==='function'&&st.pos); await p.waitForTimeout(400);
    const S=await p.evaluate(()=>{ const a=DATA.ap.find(x=>x.i==='YMMB'); setGo({k:'AD',c:a.i,n:a.n,la:a.la,lo:a.lo}); render(); const out=[];
      for(let k=0;k<34;k++){ const [d0,b0]=distBrg(st.pos[0],st.pos[1],a.la,a.lo); if(d0<1) break; const [la,lo]=gcDest(st.pos[0],st.pos[1],b0,0.5);
        $('simPos').value=la.toFixed(5)+','+lo.toFixed(5); $('simTrk').value=String(Math.round((b0-variation(la,lo)+360)%360)); simApply(); render();
        out.push({d:distBrg(la,lo,a.la,a.lo)[0], row:$('sInbound').hidden?'':$('sInbound').textContent, crq:!$('sClrReq').hidden, call1:((document.querySelector('#callsList .call .when span')||{}).textContent||''), nx:!$('sNxCls').hidden}); }
      return out; });
    const inb=S.find(x=>/INBOUND CALL/.test(x.row));
    ok(inb&&inb.d<=10.2&&inb.d>9.5&&(lab==='day'? /118\.1SQUAWK 3000/.test(inb.row)&&/Moorabbin Tower/.test(inb.row) : /Moorabbin traffic/.test(inb.row)),`${lab}: inbound call at ${inb&&inb.d.toFixed(1)} NM: ${inb&&inb.row.slice(0,70)}`);
    ok(S.every(x=>!x.crq)&&S.every(x=>!/^Clearance request/.test(x.call1)),`${lab}: no clearance request (row or Radio calls) while landing at Moorabbin`);
    ok(S.every(x=>!/TRANSIT CALL/.test(x.row)),`${lab}: no transit calls for other fields on the way in`);
    if(lab==='day') ok(S.some(x=>x.nx),'day: the NEXT CLASS row still shows the zone ahead');
    await ctx.close(); }
  console.log(fail.length? fail.length+' FAILED':'all passed'); console.log(errs); await b.close(); process.exit(fail.length?1:0); })();
