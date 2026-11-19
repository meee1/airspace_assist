// Avalon zone transit (19 Nov 2026): the CLEARANCE CALL row before the zone, the zone's calls in Radio calls while inside
// (not the CTAF calls of the strips under it), nothing at night, and a landing at the zone's aerodrome still gets tower calls.
// node play/avtransit.js   (app served on :8811)
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(), errs=[], fail=[]; const ok=(c,m)=>{ console.log((c?'ok   ':'FAIL ')+m); if(!c) fail.push(m); };
  const mk=async iso=>{ const ctx=await b.newContext({...PX9,storageState:{cookies:[],origins:[{origin:'http://localhost:8811',localStorage:[{name:'rc_fsMap',value:'false'}]}]}});
    await ctx.addInitScript(t=>{ const D=Date, off=D.parse(t)-D.now(); window.Date=class extends D{ constructor(...a){ super(...(a.length?a:[D.now()+off])); } static now(){ return D.now()+off; } }; },iso);
    const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
    await p.goto('http://localhost:8811/index.html?sim=-38.30,144.40&alt=1500&trk=000&gs=90'); await p.waitForFunction(()=>typeof render==='function'&&st.pos); await p.waitForTimeout(500); return {ctx,p}; };
  // fly along the app's own (true) track, 0.5 NM a step
  const fly=(p,n)=>p.evaluate(n=>{ const out=[]; for(let k=0;k<n;k++){ const [la,lo]=gcDest(st.pos[0],st.pos[1],st.trk,0.5); $('simPos').value=la.toFixed(5)+','+lo.toFixed(5); simApply(); render();
      const first=document.querySelector('#callsList .call .when span'), say=document.querySelector('#callsList .call .say');
      out.push({inZone:!!(st.curBand&&st.curBand.k==='CTR'), row:$('sClrReq').hidden?'':$('sClrReq').textContent, call1:first?first.textContent:'', say1:say?say.textContent:'', calls:[...document.querySelectorAll('#callsList .call .say')].map(e=>e.textContent).join(' | '), nx:NX.cls&&NX.cls.d}); }
    return out; },n);
  // tower hours
  { const {ctx,p}=await mk('2026-11-01T01:30:00Z'); const S=await fly(p,56);     const firstRow=S.find(x=>x.row), iRow=S.indexOf(firstRow), inside=S.filter(x=>x.inZone);
    ok(firstRow&&/CLEARANCE CALL133\.55/.test(firstRow.row)&&/Avalon Approach, .*request clearance/.test(firstRow.row)&&firstRow.nx<=5,'before the zone: CLEARANCE CALL row on 133.55 at '+(firstRow&&firstRow.nx.toFixed(1))+' NM: '+(firstRow&&firstRow.row.slice(0,90)));
    ok(S.slice(0,iRow).every(x=>!x.row)&&S.slice(0,iRow).some(x=>x.nx>5),'not shown while the zone is still more than 5 NM ahead');
    ok(inside.length>4&&inside.every(x=>!x.row),'inside the zone: the reminder is gone');
    ok(inside.every(x=>/^In the zone · Avalon Approach 133\.55/.test(x.call1)&&!/ traffic,/.test(x.calls)),'inside: Radio calls shows the zone\'s calls, no CTAF calls: '+(inside[0]&&inside[0].say1));
    ok(inside.some(x=>/clear of control zone/.test(x.calls)),'inside: the "clear of control zone" call is listed');
    const after=S.slice(S.lastIndexOf(inside[inside.length-1])+1); ok(after.length&&after.every(x=>!/^In the zone/.test(x.call1)),'after the zone: back to normal calls ('+(after[0]&&after[0].call1)+')');
    // dismiss: tap the row, it stays away for this zone
    await p.evaluate(()=>{ $('simPos').value='-38.30,144.40'; simApply(); render(); CRQ.dis={}; CRQ.on=null; });
    let seen=false; for(let k=0;k<30&&!seen;k++){ const r=await fly(p,1); seen=!!r[0].row; }
    if(seen){ await p.click('#sClrReq'); const S3=await fly(p,2); ok(S3.every(x=>!x.row),'tap: dismissed, stays away'); } else ok(false,'row for the dismiss check');
    await ctx.close(); }
  // night: the zone is class G/E, no clearance, no zone calls
  { const {ctx,p}=await mk('2026-11-01T12:30:00Z'); const S=await fly(p,56);
    ok(S.every(x=>!x.row&&!/^In the zone|^Clearance request/.test(x.call1)),'night: no clearance call, no zone calls'); await ctx.close(); }
  // landing at Avalon (Go to YMAV) inside its zone: tower calls, not "In the zone"
  { const {ctx,p}=await mk('2026-11-01T01:30:00Z'); await p.evaluate(()=>{ const a=DATA.ap.find(x=>x.i==='YMAV'); $('simPos').value='-38.08,144.43'; simApply(); setGo({k:'AD',c:a.i,n:a.n,la:a.la,lo:a.lo}); render(); });
    const r=await p.evaluate(()=>({inZone:st.curBand&&st.curBand.k, call1:(document.querySelector('#callsList .call .when span')||{}).textContent||''}));
    ok(r.inZone==='CTR'&&!/^In the zone/.test(r.call1),'landing at Avalon (Go to YMAV) in its zone: its tower calls ('+r.call1+')'); await ctx.close(); }
  console.log(fail.length? fail.length+' FAILED':'all passed'); console.log(errs); await b.close(); process.exit(fail.length?1:0); })();
