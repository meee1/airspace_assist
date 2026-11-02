// 10 NM reminder: inbound where you land, transit elsewhere ("transiting east to west")
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({...PX9}); await ctx.addInitScript(()=>{ const D=Date, off=D.parse('2026-11-02T01:30:00Z')-D.now(); window.Date=class extends D{ constructor(...a){ super(...(a.length?a:[D.now()+off])); } static now(){ return D.now()+off; } }; });
 const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); await p.goto('http://localhost:8811/index.html?sim=YBRS&alt=4500&trk=270&gs=100'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(800);
 await p.evaluate(()=>{ $('cType').value='Cessna 175'; $('cSign').value='ABC'; });
 // fly a straight line past an aerodrome (offset NM north of it, track), report what the reminder says at each distance
 const pass=(icao,north,trk,setup)=>p.evaluate(([icao,north,trk,setup])=>{ const a=DATA.ap.find(x=>x.i===icao); localStorage.removeItem('rc_fp'); FP=null; GO=null; INB.on=null; INB.armed={}; INB.lastD={};
   if(setup==='go') setGo({k:'AD',c:icao,n:a.n,la:a.la,lo:a.lo});
   if(setup==='plan-mid'||setup==='plan-mid-land'||setup==='plan-last'){ const dep={n:'YBRS',c:'YBRS',...(({la,lo})=>({la,lo}))(DATA.ap.find(x=>x.i==='YBRS'))}, mid={n:icao,c:icao,la:a.la,lo:a.lo}, far={n:'FAR',la:a.la,lo:a.lo-1.5};
     fpSet({name:'T',pts: setup==='plan-last'? [dep,mid] : [dep,mid,far], i:1}); if(setup==='plan-mid-land') fpEdit(P=>{ P[1].land=true; }); }
   const out=[], rad=trk*Math.PI/180, c=Math.cos(a.la*Math.PI/180);
   for(const along of [-14,-12,-11,-10.5,-9.9,-8,-5,0,5]){ const la=a.la+north/60 + Math.cos(rad)*along/60, lo=a.lo+Math.sin(rad)*along/60/c;
     $('simPos').value=la.toFixed(5)+','+lo.toFixed(5); $('simTrk').value=String(trk).padStart(3,'0'); simApply(); render();
     const bx=$('sInbound'); out.push(bx.hidden?'·':bx.querySelector('small').textContent[0]); }
   const bx=$('sInbound'); return out.join('')+'  '+(INB.lastTxt||''); },[icao,north,trk,setup]);
 await p.evaluate(()=>{ const f=inboundUI; window.inboundUI=function(){ f(); const bx=$('sInbound'); if(!bx.hidden) INB.lastTxt=bx.innerText.replace(/\n/g,' '); }; });
 for(const [n,icao,north,trk,setup] of [['no plan, pass 10 NM N of YBLT westbound','YBLT',9.5,270,''],['Go to YBLT (landing)','YBLT',0,180,'go'],['plan via YBLT (not landing)','YBLT',2,270,'plan-mid'],['plan via YBLT marked Land','YBLT',2,270,'plan-mid-land'],['plan ends at YBLT','YBLT',2,270,'plan-last'],['pass YMMB (towered, open)','YMMB',6,270,'']]){
   await p.evaluate(()=>{ INB.lastTxt=''; }); console.log(n.padEnd(42), await pass(icao,north,trk,setup)); }
 console.log(errs); await b.close(); })();
