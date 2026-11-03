// Squawk code on the approach to a towered aerodrome you land at (YMMB 3000 from AIP, YMEN 0100 from ERSA); none when transiting
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({...PX9}); await ctx.addInitScript(()=>{ const D=Date, off=D.parse('2026-11-02T01:30:00Z')-D.now(); window.Date=class extends D{ constructor(...a){ super(...(a.length?a:[D.now()+off])); } static now(){ return D.now()+off; } }; });
 const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); await p.goto('http://localhost:8811/index.html?sim=YBRS&alt=1500&trk=270&gs=100'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(800);
 await p.evaluate(()=>{ $('cType').value='Bell 206'; $('cSign').value='ABC'; });
 const run=(icao,setup,sq)=>p.evaluate(([icao,setup,sq])=>{ const a=DATA.ap.find(x=>x.i===icao); localStorage.removeItem('rc_fp'); FP=null; GO=null; INB.on=null; INB.armed={}; INB.lastD={};
   for(const k of Object.keys(CLR)) delete CLR[k]; if(sq) CLR.sq=sq;
   const ap=i=>{ const x=DATA.ap.find(y=>y.i===i); return {n:i,c:i,la:x.la,lo:x.lo}; };
   const dep={n:'START',la:a.la+(icao==='YMMB'?-0.2:0.2),lo:a.lo+0.2};
   if(setup==='last'){ fpSet({name:'T',pts:[dep,ap(icao)],i:1}); fpEdit(P=>{ P[1].alt=icao==='YMEN'?1000:1500; }); }
   if(setup==='mid'){ fpSet({name:'T',pts:[dep,ap(icao),{n:'FAR',la:a.la+0.1,lo:a.lo-0.3}],i:1}); fpEdit(P=>{ P[1].alt=1500; P[2].alt=1500; }); }
   if(setup==='go') setGo({k:'AD',c:icao,n:a.n,la:a.la,lo:a.lo});
   const sgn=icao==='YMMB'?-1:1, la=a.la+sgn*11/60*0.7, lo=a.lo+11/60*0.7/Math.cos(a.la*Math.PI/180);   // ~11 NM SE of YMMB (Carrum way) / NE of YMEN, heading in
   let row='';
   for(const f of [1.25,1.1,1,0.95,0.9,0.85]){ $('simPos').value=(a.la+(la-a.la)*f).toFixed(5)+','+(a.lo+(lo-a.lo)*f).toFixed(5); $('simTrk').value=icao==='YMMB'?'315':'225'; simApply(); render(); const bx=$('sInbound'); if(!bx.hidden) row=bx.innerText.replace(/\n/g,' '); }
   let pc=''; if(FP){ window._pc=planCheck(1500,100,null);  try{ const r=planCheck(2500,100,null); pc=JSON.stringify(r).match(/[^"]*(squawk|TWR)[^"]*/gi); pc=pc&&pc.join(' // '); pc=pc?pc.replace(/<[^>]+>/g,'').slice(0,400):'-'; }catch(e){ pc='ERR '+e.message; } }
   $('simPos').value=(a.la+0.03).toFixed(5)+','+a.lo.toFixed(5); simApply(); render(); const cl=(($('calls').textContent.match(/Transponder.{0,90}/)||['-'])[0])+' @'+$('callsAt').textContent;
   return {row:row.slice(0,160), sq:(row.match(/SQUAWK \d{4}/)||['none'])[0], pc, card:cl.replace(/\n/g,' ').slice(0,140)}; },[icao,setup,sq]);
 for(const [n,icao,setup,sq] of [['YMMB plan ends there','YMMB','last'],['YMEN plan ends there','YMEN','last'],['YMMB Go to','YMMB','go'],['YMMB via, not landing','YMMB','mid'],['YMMB with clearance 4521','YMMB','last','4521']]){
   console.log(n.padEnd(28), JSON.stringify(await run(icao,setup,sq))); }
 await run('YMMB','last'); await p.evaluate(()=>{ const a=DATA.ap.find(x=>x.i==='YMMB'); $('simPos').value=(a.la-0.11)+','+(a.lo+0.14); simApply(); INB.on='YMMB'; INB.kind='inb'; INB.t=Date.now(); render(); $('sInbound').scrollIntoView({block:'center'}); }); await (await p.$('#sInbound')).screenshot({path:'sqk_row.png'}); console.log(errs); await b.close(); })();
