// Moorabbin to Norlane (19 Nov 2026, Michael: "getting Avalon Tower even though I'm not landing, it should be Avalon Approach"):
// a Go to a town doesn't mean landing at the aerodrome nearest it (Avalon). node play/norlane.js  (app on :8811)
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(), errs=[], fail=[]; const ok=(c,m)=>{ console.log((c?'ok   ':'FAIL ')+m); if(!c) fail.push(m); };
  const ctx=await b.newContext({...PX9,storageState:{cookies:[],origins:[{origin:'http://localhost:8811',localStorage:[{name:'rc_fsMap',value:'false'}]}]}});
  await ctx.addInitScript(()=>{ const D=Date, off=D.parse('2026-11-01T01:30:00Z')-D.now(); window.Date=class extends D{ constructor(...a){ super(...(a.length?a:[D.now()+off])); } static now(){ return D.now()+off; } }; });
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=240&gs=90'); await p.waitForFunction(()=>typeof render==='function'&&st.pos); await p.waitForTimeout(500);
  const g=await p.evaluate(()=>{ const t=findPoint('NORLANE'); setGo(t); render(); const ma=DATA.ap.find(x=>x.i==='YMAV'); return {go:GO&&GO.c, k:GO&&GO.k, ad:goTarget().ad&&goTarget().ad.i, landsAvalon:adStop(ma), plannedAvalon:adPlanned(ma)}; });
  ok(g.go&&g.ad&&!g.landsAvalon&&!g.plannedAvalon,`Go to ${g.go} (${g.k}): nearest aerodrome ${g.ad}; not landing at Avalon`);
  ok(await p.evaluate(()=>{ const a=goTarget().ad; return !adStop(a); }),'a Go to a town is not a landing at its nearest aerodrome either');
  // fly the line YMMB -> Norlane at 1,500 ft
  const S=await p.evaluate(()=>{ const out=[]; for(let k=0;k<80;k++){ const [d,b0]=distBrg(st.pos[0],st.pos[1],GO.la,GO.lo); if(d<1) break; const [la,lo]=gcDest(st.pos[0],st.pos[1],b0,0.5);
      $('simPos').value=la.toFixed(5)+','+lo.toFixed(5); $('simTrk').value=String(Math.round((b0-variation(la,lo)+360)%360)); simApply(); render();
      const z=st.curBand&&st.curBand.k==='CTR'? st.curBand.n : ''; out.push({z, ctaf:$('sCtafLbl').textContent+' '+$('sCtaf').textContent, atc:$('sAreaLbl').textContent+' '+$('sArea').textContent, row:$('sInbound').hidden?'':$('sInbound').textContent, crq:$('sClrReq').hidden?'':$('sClrReq').textContent, call1:((document.querySelector('#callsList .call .when span')||{}).textContent||'')}); }
    return out; });
  const av=S.filter(x=>/AVALON/.test(x.z));
  ok(av.length>0,'the line crosses the Avalon zone ('+av.length+' samples)');
  ok(av.every(x=>/^APP 133\.55/.test(x.ctaf)||/^APP 133\.55/.test(x.atc))&&av.every(x=>!/TWR 120\.1/.test(x.ctaf+x.atc)),'in the Avalon zone: Avalon Approach 133.55, not the tower ('+[...new Set(av.map(x=>x.ctaf+' | '+x.atc))].join(' / ')+')');
  ok(S.some(x=>/CLEARANCE CALL133\.55/.test(x.crq)),'a clearance call to Avalon Approach before the zone');
  ok(av.every(x=>/^In the zone · Avalon Approach 133\.55/.test(x.call1)),'Radio calls in the zone: the transit calls on Avalon Approach');
  ok(S.every(x=>!/Avalon Tower, .*inbound/.test(x.row)),'no Avalon Tower inbound call');
  console.log(fail.length? fail.length+' FAILED':'all passed'); console.log(errs); await b.close(); process.exit(fail.length?1:0); })();
