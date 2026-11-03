// inbound reminder, GPS wind (circle fit), zone highlight
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({...PX9,storageState:{cookies:[],origins:[{origin:'http://localhost:8811',localStorage:[{name:'rc_fsMap',value:'true'}]}]}});
 await ctx.addInitScript(()=>{ const D=Date, off=D.parse('2026-11-01T01:30:00Z')-D.now(); window.Date=class extends D{ constructor(...a){ super(...(a.length?a:[D.now()+off])); } static now(){ return D.now()+off; } }; });
 const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message+' '+(e.stack||'').split('\n')[1]));
 await p.goto('http://localhost:8811/index.html?sim=YBRS&alt=1500&trk=000&gs=90'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(1000);
 await p.evaluate(()=>{ $('cType').value='Bell 206'; $('cSign').value='ABC'; });
 // --- inbound: Go to YLIL (non-towered), fly in from the south
 const r=await p.evaluate(()=>{ const a=DATA.ap.find(x=>x.i==='YLIL'); setGo({k:'AD',c:'YLIL',n:a.n,la:a.la,lo:a.lo}); const out=[];
   for(const d of [14,12,11,10.6,10.1,9.5,8,5,3.8]){ $('simPos').value=(a.la-d/60).toFixed(5)+','+a.lo.toFixed(5); $('simTrk').value='000'; simApply(); render(); out.push(d+':'+($('sInbound').hidden?'-':$('sInbound').innerText.replace(/\n/g,' ')).slice(0,170)+(d===10.1?' | gflash='+$('gCtafBox').classList.contains('fqflash'):'')); } return out; });
 console.log(r.join('\n'));
 // towered destination
 console.log('YMMB', await p.evaluate(()=>{ const a=DATA.ap.find(x=>x.i==='YMMB'); setGo({k:'AD',c:'YMMB',n:a.n,la:a.la,lo:a.lo}); for(const d of [13,10]){ $('simPos').value=(a.la).toFixed(5)+','+(a.lo-d/60/Math.cos(a.la*Math.PI/180)).toFixed(5); $('simTrk').value='090'; simApply(); render(); } return $('sInbound').hidden?'-':$('sInbound').innerText.replace(/\n/g,' '); }));
 await (await p.$('#hudA')).screenshot({path:'play/f3_inbound.png'});
 console.log('dismiss', await p.evaluate(()=>{ $('sInbound').click(); render(); return $('sInbound').hidden; }));
 // --- wind: TAS 90 kt, wind from 270 at 20 kt (blowing east), a 360 turn in 60 s
 console.log('wind', await p.evaluate(()=>{ WIND.s=[]; WIND.est=null; const t0=Date.now()-70e3, wx=20*Math.sin(90*Math.PI/180), wy=20*Math.cos(90*Math.PI/180);
   for(let i=0;i<60;i++){ const h=i*6*Math.PI/180, vx=90*Math.sin(h)+wx, vy=90*Math.cos(h)+wy+ (Math.random()-.5)*2; const gs=Math.hypot(vx,vy), trk=(Math.atan2(vx,vy)*180/Math.PI+360)%360; windAdd(t0+i*1000,gs,trk); WIND.fitT=0; }
   windFit(Date.now()); windUI(); const w=WIND.est; return w? `from ${w.from.toFixed(0)}T ${w.spd.toFixed(1)} kt TAS ${w.tas.toFixed(1)} rms ${w.rms.toFixed(2)} | tile "${$('sWind').textContent}" var ${variation(st.pos[0],st.pos[1]).toFixed(1)}` : 'none'; }));
 console.log('straight only', await p.evaluate(()=>{ WIND.s=[]; WIND.est=null; for(let i=0;i<60;i++) windAdd(Date.now()-60e3+i*1000,95,90); windFit(Date.now()); return WIND.est?'est!':'none (no turn)'; }));
 // --- zone highlight: inside Avalon CTR, and inside YBRS CTAF
 await p.evaluate(()=>{ GO=null; MAP.range=10; $('simPos').value='-38.08,144.45'; $('simTrk').value='000'; simApply(); render(); }); await p.waitForTimeout(800); await p.screenshot({path:'play/f3_ctr.png'});
 await p.evaluate(()=>{ $('simPos').value='-38.22,144.47'; simApply(); render(); }); await p.waitForTimeout(800); await p.screenshot({path:'play/f3_ctaf.png'});
 await p.evaluate(()=>{ const a=DATA.ap.find(x=>x.i==='YBBF'); $('simPos').value=(a.la+0.03)+','+(a.lo+0.06); simApply(); render(); }); await p.waitForTimeout(800); await p.screenshot({path:'play/f3_split.png'});
 console.log(errs); await b.close(); })();
