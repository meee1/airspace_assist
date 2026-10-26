const {chromium,devices}=require('playwright'); const fs=require('fs');
// Fly a GPX flight plan through the app in simulation and record what it shows at every 0.5 NM.
// usage: node playthrough.js <plan.gpx> <startUTC> <out.json> [LAND,CODES] [base url]
//   e.g. node tools/playthrough.js ybrs.gpx 2026-10-26T22:00:00Z run.json YLIL,YMMB http://localhost:8811/index.html
// Needs the app served over http (simulate.sh) and Playwright. Altitude: 1,000 ft above the highest terrain on each
// leg (min 1,500), kept 500 ft below the base of controlled airspace (Class D zones of landing aerodromes excepted),
// climbing/descending over 3 NM at departures and landings, CTR entry altitude from ERSA inside the last leg.
const GPX=process.argv[2], START=Date.parse(process.argv[3]), OUT=process.argv[4];
const LANDS=(process.argv[5]||'').split(',').filter(Boolean), BASE=process.argv[6]||'http://localhost:8811/index.html';
(async()=>{
 const b=await chromium.launch(); const ctx=await b.newContext({...devices['iPhone 13']}); const p=await ctx.newPage();
 const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error') errs.push('console: '+m.text()); });
 await p.clock.setFixedTime(START);
 await p.goto(BASE+'?sim=-30,135&alt=0&trk=&gs=0'); await p.waitForTimeout(600);
 await p.setInputFiles('#fpFile',GPX); await p.waitForTimeout(300);
 await p.evaluate(async()=>{ document.getElementById('calls').open=true;
   for(const [id,v] of [['cSign','ECHO ALPHA NOVEMBER'],['cType','Helicopter']]){ document.getElementById(id).value=v; document.getElementById(id).dispatchEvent(new Event('input')); }
   const c=document.getElementById('cCat'); c.value='H'; c.dispatchEvent(new Event('change'));
   });
 const fp=await p.evaluate(()=>FP.pts.map(q=>({c:(q.c||q.n).toUpperCase(),la:q.la,lo:q.lo})));
 await p.evaluate(async fp=>{ const n=new Set(); for(const q of fp) n.add(tName(Math.floor(q.la),Math.floor(q.lo))); if(TER.ok) await Promise.all([...n].filter(x=>TER.have.has(x)).map(x=>terLoad(x))); },fp);
 const ap=await p.evaluate(ids=>Object.fromEntries(ids.map(i=>{const a=DATA.ap.find(x=>x.i===i); return a?[i,{la:a.la,lo:a.lo,e:a.e||0,entry:a.keys&&a.keys.entry?parseInt(a.keys.entry.replace(',','')):null}]:[i,null]}).filter(x=>x[1])),[...new Set(fp.map(q=>q.c))]);
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
 // landings: listed codes plus the final point; departures: the first point and each landing
 S.forEach((s,i)=>Object.assign(s,env[i]));
 // ---- altitude profile ----
 const LAND={}, DEP={};
 if(ap[fp[0].c]) DEP[0]=fp[0].c;
 fp.forEach((q,k)=>{ if(k>0 && ap[q.c] && (LANDS.includes(q.c)||k===fp.length-1)){ LAND[k]=q.c; if(k<fp.length-1) DEP[k]=q.c; } });
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
   const en=LAND[endIdx]&&ap[LAND[endIdx]].entry, ex=DEP[startIdx]&&ap[DEP[startIdx]].entry;
   if(en){ const e=ap[LAND[endIdx]].e; alt=Math.min(alt,en); if(toEnd<2.5) alt=Math.min(alt,e+(en-e)*toEnd/2.5); }   // ERSA CTR entry altitude, then descend
   if(ex && s.ctr) alt=Math.min(alt,ex);
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
 if(DEP[0]) await ground(DEP[0],0);
 const GS=90;
 for(let i=0;i<S.length;i++){ const s=S[i];
   await step({...s,gs:GS,label:`${s.from}->${s.to} ${(s.L-s.s).toFixed(1)} NM to go`});
   if(LAND[s.leg+1] && s.s>=s.L-1e-6){ await ground(LAND[s.leg+1], s.leg+1===fp.length-1?0:20); prev={la:s.la,lo:s.lo}; }
 }
 fs.writeFileSync(OUT,JSON.stringify({start:START,legCruise,fp,errs,rows},null,1));
 // summary: one line each time the aerodrome, call frequency or airspace changes
 let last='';
 for(const r of rows){ const k=[r.ad,r.adMode,r.callsAt,r.cls,r.cap].join('|'); if(k===last && !/ground/.test(r.label)) continue; last=k;
   const inb=(r.calls.find(c=>/^inbound/i.test(c.w))||{}).s||'';
   console.log(`${r.local} ${r.label.slice(0,30).padEnd(30)} ${String(r.alt).padStart(5)} ft | ${r.cls.padEnd(5)} ${r.cap.padEnd(8)} | ${r.ad} ${r.adDist.padStart(7)} ${r.adMode.slice(0,34).padEnd(34)} | ${r.callsAt.slice(0,30).padEnd(30)} | ${inb.slice(0,110)}`); }
 const real=errs.filter(e=>!/Failed to load resource/.test(e));
 console.log(`\n${rows.length} positions, ${real.length} script errors`, real.slice(0,5));
 await b.close(); })();
