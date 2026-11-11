// Editing a plan with a coast leg works the leg out again where the change touches it (with the leg's own settings):
// a waypoint added at the end leaves it alone; one inserted before it (a new start) redoes it from there; one inserted
// among its turn points splits it into two coast legs; its end replaced makes the new waypoint the coast leg's end; a
// waypoint moved ahead of it changes its start; Reverse then an edit elsewhere doesn't redo it. Uses the Victorian tiles.
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({...PX9,serviceWorkers:'block'}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(500);
 const settle=()=>p.waitForFunction(()=>!COAST.busy&&!COAST.chkPending,undefined,{timeout:60000}).then(()=>p.waitForTimeout(400)).then(()=>p.waitForFunction(()=>!COAST.busy,undefined,{timeout:60000}));
 const plan=()=>p.evaluate(()=>{ const P=FP.pts, legs=[]; let start=null, n=0;
   for(const q of P){ if(q.cg){ n++; continue; } if(start) legs.push(`${start}→${q.c||q.n}${q.via==='coast'?` coast(${n} pts, ${q.coff} ft/${q.cgap} NM)`:n?` ?(${n} stray)`:' direct'}`); start=q.c||q.n; n=0; }
   const ok=P.every((q,k)=>!q.cg||P.slice(k).find(x=>!x.cg)?.cgid===q.cg); return {legs, n:P.length, ok}; });
 await p.evaluate(()=>{ ls.set('coastOff',500); ls.set('coastGap',2); COAST.off=500; COAST.gap=2; fpSet({name:'Bay',kind:'map',pts:[fpPt(findPoint('YMMB')),fpPt(findPoint('YBRS'))],i:1}); FP_EDIT=true; render(); });
 await p.evaluate(()=>fpCoastSet(FP.pts[1],true,{off:1000,gap:2})); let s0=await plan(); console.log('coast leg (1000 ft):', JSON.stringify(s0));
 const sig=()=>p.evaluate(()=>FP.pts.filter(q=>q.cg).map(q=>q.la.toFixed(4)+','+q.lo.toFixed(4)).join(';'));
 // a) add at the end: the coast leg isn't redone
 const g0=await sig(); await p.evaluate(()=>fpAdd(fpPt(findPoint('YAPO')))); await p.waitForTimeout(600); await settle();
 let s=await plan(); console.log('a) add YAPO at the end:', JSON.stringify(s)); if((await sig())!==g0||!/YBRS→YAPO direct/.test(s.legs.join())) errs.push('a '+JSON.stringify(s));
 // b) insert a waypoint before the coast leg (a new start): redone from it, with the leg's 1000 ft
 await p.evaluate(()=>fpEdit(P=>P.splice(1,0,fpPt(findPoint('CARR'))))); await p.waitForTimeout(600); await settle();
 s=await plan(); console.log('b) insert CARR before it:', JSON.stringify(s)); if(!/YMMB→CARR direct/.test(s.legs.join())||!/CARR→YBRS coast\(\d+ pts, 1000 ft/.test(s.legs.join())||!s.ok) errs.push('b '+JSON.stringify(s));
 // c) a waypoint among its turn points (as Add's best fit can put it): split into two coast legs
 await p.evaluate(()=>{ const P=FP.pts, cs=P.filter(q=>q.cg), m=cs[Math.floor(cs.length/2)], k=P.indexOf(m); fpEdit(Q=>Q.splice(k,0,{n:'MID',la:m.la,lo:m.lo,desc:'test point'})); }); await p.waitForTimeout(600); await settle();
 s=await plan(); console.log('c) a waypoint among its turn points:', JSON.stringify(s)); if(!/CARR→MID coast/.test(s.legs.join())||!/MID→YBRS coast/.test(s.legs.join())||!s.ok) errs.push('c '+JSON.stringify(s));
 // d) its end replaced (⇄): the new waypoint is the coast leg's end
 const gc=await sig();
 await p.evaluate(()=>{ const k=FP.pts.findIndex(q=>(q.c||q.n)==='YBRS'); fpEdit(P=>{ P[k]=fpPt(findPoint('YQCF')); }); }); await p.waitForTimeout(600); await settle();
 s=await plan(); console.log('d) YBRS replaced by YQCF:', JSON.stringify(s)); const dEnd=await p.evaluate(()=>{ const P=FP.pts, k=P.findIndex(q=>(q.c||q.n)==='YQCF'), c=P[k-1]; return +distBrg(c.la,c.lo,P[k].la,P[k].lo)[0].toFixed(1); }); console.log('   last turn point to YQCF:', dEnd, 'NM · turn points changed:', (await sig())!==gc);
 if(!/MID→YQCF coast\(\d+ pts, 1000 ft/.test(s.legs.join())||!s.ok||(await sig())===gc) errs.push('d '+JSON.stringify(s));
 // e) delete the middle waypoint: one coast leg CARR→YQCF... (MID's own leg goes with it; YQCF's start is now CARR)
 await p.evaluate(()=>{ const k=FP.pts.findIndex(q=>q.n==='MID'), gid=FP.pts[k].cgid; fpEdit(P=>{ P.splice(k,1); if(gid) for(let j=P.length-1;j>=0;j--) if(P[j].cg===gid) P.splice(j,1); }); }); await p.waitForTimeout(600); await settle();
 s=await plan(); console.log('e) delete MID:', JSON.stringify(s)); if(!/CARR→YQCF coast/.test(s.legs.join())||!s.ok) errs.push('e '+JSON.stringify(s));
 // f) Reverse, then add at the end: the reversed coast leg stays as it is
 await p.click('#fpRev'); await p.waitForTimeout(300); const g1=await sig(); await p.evaluate(()=>fpAdd(fpPt(findPoint('YLIL')))); await p.waitForTimeout(600); await settle();
 s=await plan(); console.log('f) reversed, add YLIL:', JSON.stringify(s)); if((await sig())!==g1||!/YQCF→CARR coast/.test(s.legs.join())) errs.push('f '+JSON.stringify(s));
 console.log(errs); await b.close(); })();
