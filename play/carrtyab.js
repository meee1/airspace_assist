// Go to CARR from Tyabb (18 Nov 2026): the Moorabbin inbound call at 10 NM; no transit calls for other fields within 10 NM of
// where you land; the tower side stays West over the field (arriving via CARR, not "departing towards CARR"); departing
// Moorabbin with a Go to on CARR still counts as departing. node play/carrtyab.js  (app on :8811)
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(), errs=[], fail=[]; const ok=(c,m)=>{ console.log((c?'ok   ':'FAIL ')+m); if(!c) fail.push(m); };
  for(const [lab,iso] of [['day','2026-11-01T01:30:00Z'],['night','2026-11-01T12:30:00Z']]){
    const ctx=await b.newContext({...PX9,storageState:{cookies:[],origins:[{origin:'http://localhost:8811',localStorage:[{name:'rc_fsMap',value:'false'}]}]}});
    await ctx.addInitScript(t=>{ const D=Date, off=D.parse(t)-D.now(); window.Date=class extends D{ constructor(...a){ super(...(a.length?a:[D.now()+off])); } static now(){ return D.now()+off; } }; },iso);
    const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
    await p.goto('http://localhost:8811/index.html?sim=YTYA&alt=1500&trk=330&gs=90'); await p.waitForFunction(()=>typeof render==='function'&&st.pos); await p.waitForTimeout(400);
    const R=await p.evaluate(()=>{ const P=VWby.get('CARR'), A=DATA.ap.find(x=>x.i==='YMMB'), T=DATA.ap.find(x=>x.i==='YTYA'); setGo({...P}); render();
      const out={inb:null, trn:[], tile0:null}; const fly=(a,c)=>{ const n=Math.ceil(distBrg(a[0],a[1],c[0],c[1])[0]/0.5);
        for(let k=0;k<=n;k++){ const la=a[0]+(c[0]-a[0])*k/n, lo=a[1]+(c[1]-a[1])*k/n; $('simPos').value=la.toFixed(5)+','+lo.toFixed(5); simApply(); render();
          const d=distBrg(la,lo,A.la,A.lo)[0], row=$('sInbound').hidden? '' : $('sInbound').textContent;
          if(/INBOUND/.test(row)&&!out.inb) out.inb={d, row}; if(/TRANSIT/.test(row)) out.trn.push(d.toFixed(1)+': '+row.slice(0,50));
          if(d<0.6) out.tile0=$('sCtafLbl').textContent+' '+$('sCtaf').textContent; } };
      fly([T.la,T.lo],[P.la,P.lo]); fly([P.la,P.lo],[A.la-0.4/60,A.lo]); return out; });
    ok(R.inb&&R.inb.d<=10.2&&R.inb.d>9&&(lab==='day'? /123\.0/.test(R.inb.row)&&/SQUAWK 3000/.test(R.inb.row) : /118\.1/.test(R.inb.row)),`${lab}: inbound at ${R.inb&&R.inb.d.toFixed(1)} NM: ${R.inb&&R.inb.row.slice(0,70)}`);
    ok(!R.trn.length,`${lab}: no transit calls on the way in${R.trn.length?' — '+R.trn.join(' | '):''}`);
    if(lab==='day') ok(/^TWR W 123\.0$/.test(R.tile0),'day: 0.4 NM south of the field the tile stays '+R.tile0);
    await ctx.close(); }
  // departing Moorabbin (started on the field, never 3 NM away) with a Go to on CARR: a departure, by CARR's bearing
  { const ctx=await b.newContext({...PX9,storageState:{cookies:[],origins:[{origin:'http://localhost:8811',localStorage:[{name:'rc_fsMap',value:'false'}]}]}});
    await ctx.addInitScript(()=>{ const D=Date, off=D.parse('2026-11-01T01:30:00Z')-D.now(); window.Date=class extends D{ constructor(...a){ super(...(a.length?a:[D.now()+off])); } static now(){ return D.now()+off; } }; });
    const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
    await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=100&trk=170&gs=0'); await p.waitForFunction(()=>typeof render==='function'&&st.pos); await p.waitForTimeout(400);
    const r=await p.evaluate(()=>{ setGo({...VWby.get('CARR')}); render(); const a=DATA.ap.find(x=>x.i==='YMMB'), d=twrDep(a); return {dep:!!d, pt:d&&d.pt.c}; });
    ok(r.dep&&r.pt==='CARR','on the field, never away: departing towards CARR');
    // after arriving from 3 NM+ out, landing (phase event) makes it a departure again
    const r2=await p.evaluate(()=>{ const a=DATA.ap.find(x=>x.i==='YMMB'); INB.far.YMMB=Date.now()-60e3; const arr=!twrDep(a); PH.last={k:'land',t:Date.now()}; const dep=!!twrDep(a); return {arr,dep}; });
    ok(r2.arr&&r2.dep,'came in from 3 NM+: arriving; after landing: departing');
    await ctx.close(); }
  console.log(fail.length? fail.length+' FAILED':'all passed'); console.log(errs); await b.close(); process.exit(fail.length?1:0); })();
