const {chromium,devices}=require('playwright'); const fs=require('fs');
const START=Date.parse(process.argv[2]||'2026-10-26T22:00:00Z');   // 09:00 local Tue (AEDT)
const OUT=process.argv[3]||'/home/claude/build/play/run.json';
(async()=>{
 const b=await chromium.launch(); require('./classic.js')(b); const ctx=await b.newContext({...devices['iPhone 13']}); const p=await ctx.newPage();
 const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error') errs.push('console: '+m.text()); });
 await p.clock.setFixedTime(START);
 await p.goto('http://localhost:8811/index.html?sim=YBRS&alt=50&trk=&gs=0'); await p.waitForTimeout(600);
 await p.setInputFiles('#fpFile',__dirname+'/fixtures/ybrs.gpx'); await p.waitForTimeout(300);
 await p.evaluate(async()=>{ document.getElementById('calls').open=true;
   for(const [id,v] of [['cSign','ALPHA BRAVO CHARLIE'],['cType','Helicopter']]){ document.getElementById(id).value=v; document.getElementById(id).dispatchEvent(new Event('input')); }
   const c=document.getElementById('cCat'); c.value='H'; c.dispatchEvent(new Event('change'));
   await Promise.all(['S38E144','S38E145','S39E144','S39E145'].map(n=>terLoad(n))); });
 const fp=await p.evaluate(()=>FP.pts.map(q=>({c:q.c||q.n,la:q.la,lo:q.lo})));
 const ap=await p.evaluate(ids=>Object.fromEntries(ids.map(i=>{const a=DATA.ap.find(x=>x.i===i); return [i,{la:a.la,lo:a.lo,e:a.e}]})),['YBRS','YLIL','YMMB']);
 const dist=(a,b)=>p.evaluate(([a,b])=>distBrg(a[0],a[1],b[0],b[1]),[a,b]);
 // ---- pass A: samples, terrain, base of controlled airspace (excluding Moorabbin CTR) ----
 const S=[];
 for(let k=0;k<fp.length-1;k++){
   const A=fp[k],B=fp[k+1]; const [L,brg]=await dist([A.la,A.lo],[B.la,B.lo]);
   const n=Math.max(2,Math.ceil(L/0.5));
   for(let j=(k===0?0:1);j<=n;j++){ const f=j/n;
     // great-circle interpolation is overkill at these distances: linear lat/lon
     S.push({leg:k,from:A.c,to:B.c,s:L*f,L,la:A.la+(B.la-A.la)*f,lo:A.lo+(B.lo-A.lo)*f}); } }
 const env=await p.evaluate(S=>S.map(s=>{ const t=terrainFt(s.la,s.lo); const AS=airStack(s.la,s.lo,t||0);
   const hit=ASP.filter(x=>inAsp(x,s.la,s.lo)&&'A C D E'.split(' ').includes(x.k));
   const base=hit.length?Math.min(...hit.map(x=>limFt(x.lo,x.lok,t||0,0))):99999;
   const ctr=ASP.some(x=>x.k==='CTR'&&inAsp(x,s.la,s.lo)); return {t,base,ctr}; }),S);
 S.forEach((s,i)=>Object.assign(s,env[i]));
 // ---- altitude profile ----
 const LAND={6:'YLIL',8:'YMMB',13:'YBRS'}, DEP={0:'YBRS',6:'YLIL',8:'YMMB'};
 const legCruise={};
 for(const k of [...new Set(S.map(s=>s.leg))]){ const ss=S.filter(s=>s.leg===k);
   const maxT=Math.max(...ss.map(s=>s.t||0)), cap=Math.min(...ss.map(s=>s.base));
   let want=Math.max(1500,Math.ceil((maxT+1000)/500)*500), alt=Math.min(want,Math.floor((cap-500)/500)*500);
   legCruise[k]={want,alt,maxT:Math.round(maxT),cap,terrClear:Math.round(alt-maxT)}; }
 let tmin=0, t0=START;
 for(const s of S){ const k=s.leg; let alt=legCruise[k].alt;
   const toEnd=s.L-s.s;
   const endIdx=k+1, startIdx=k;
   if(DEP[startIdx]){ const e=ap[DEP[startIdx]].e; alt=Math.min(alt, e+(alt-e)*Math.min(1,s.s/3)); }
   if(LAND[endIdx]){ const e=ap[LAND[endIdx]].e; alt=Math.min(alt, e+(alt-e)*Math.min(1,toEnd/3)); }
   if(fp[endIdx].c==='YMMB'){ alt=Math.min(alt,1000); if(toEnd<2.5) alt=Math.min(alt,55+(1000-55)*toEnd/2.5); }  // CTR entry 1,000 FT at ACE, then descend
   if(fp[startIdx].c==='YMMB' && s.ctr) alt=Math.min(alt,1000);
   s.alt=Math.round(alt); }
 // ---- pass B: fly it ----
 const rows=[]; let clock=START, prev=null;
 const ground=async(code,mins)=>{ const a=ap[code]; await step({la:a.la,lo:a.lo,alt:a.e,gs:0,trk:null,leg:-1,from:code,to:code,label:'on ground '+code}); clock+=mins*60e3; };
 async function step(s){
   if(prev && s.gs){ const [d]=await dist([prev.la,prev.lo],[s.la,s.lo]); clock+=d/s.gs*3600e3; }
   await p.clock.setFixedTime(clock);
   const r=await p.evaluate(s=>{ st.pos=[s.la,s.lo]; st.alt=s.alt; st.gs=s.gs; 
     if(FP&&FP.pts[FP.i]&&s.gs){ const q=FP.pts[FP.i]; const [dd,bb]=distBrg(s.la,s.lo,q.la,q.lo); st.trk= dd>0.05? bb : st.trk; }
     else if(s.gs) {} else st.trk=null;
     simStatus(); render();
     const T=id=>(document.getElementById(id)?.innerText||'').replace(/\s+/g,' ').trim();
     const calls=[...document.querySelectorAll('#callsList .call')].map(c=>({w:c.querySelector('.when').innerText.trim(),s:c.querySelector('.say').innerText.replace(/\s+/g,' ').trim()}));
     const fr=[...document.querySelectorAll('#stack .fr')].map(x=>({k:x.querySelector('.k').innerText.trim(),v:x.querySelector('.v').innerText.trim(),who:x.querySelector('.who').innerText.replace(/\s+/g,' ').trim()}));
     return {ad:T('adId'),adName:T('adName'),adDist:T('adDist'),adBrg:T('adBrg'),adMode:T('adMode'),ctaf:T('ctafRow'),callsAt:T('callsAt'),mode:T('callsMode').slice(0,160),
       calls,note:T('callsNote').slice(0,300),cls:T('sCls'),cap:T('sCap'),ll:T('sLL'),agl:T('sAgl'),hdg:T('sHdg'),fp:T('fpSum'),fpNext:T('fpNext'),go:T('goBox').slice(0,200),fr,
       fpi:FP?FP.i:null, trk:st.trk};
   },s);
   const local=new Date(clock+11*3600e3).toISOString().slice(11,16);
   rows.push({...s,clock:new Date(clock).toISOString(),local,...r}); prev=s;
 }
 await ground('YBRS',0);
 const GS=90;
 for(let i=0;i<S.length;i++){ const s=S[i];
   await step({...s,gs:GS,label:`${s.from}->${s.to} ${(s.L-s.s).toFixed(1)} NM to go`});
   if(LAND[s.leg+1] && s.s>=s.L-1e-6){ await ground(LAND[s.leg+1], s.leg+1===13?0:20); prev={la:s.la,lo:s.lo}; }
 }
 fs.writeFileSync(OUT,JSON.stringify({start:START,legCruise,fp,errs,rows},null,1));
 console.log('rows',rows.length,'errors',errs.length, errs.slice(0,5)); console.log(legCruise);
 await b.close(); })();
