// Map drawing → airspace: ms per drawMap at CPU x4, at several ranges and places
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const errs=[];
 const ctx=await b.newContext({...PX9}); const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=090&gs=90'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(1500);
 await p.evaluate(()=>{ $('optPerf').checked=true; $('optPerf').dispatchEvent(new Event('change')); CH.on=false; });
 const cdp=await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 for(const [nm,pos] of [['YMMB','-37.976,145.102'],['YBRS','-38.25,144.43'],['YSSY','-33.95,151.18']]) for(const rg of [5,10,20,40,80]){
  const r=await p.evaluate(async([pos,rg])=>{ $('simPos').value=pos; simApply(); MAP.range=rg; render(); await new Promise(r=>setTimeout(r,100));
    const T=[], A=[]; for(let i=0;i<12;i++){ st.pos=[st.pos[0],st.pos[1]+0.0003]; const t=performance.now(); drawMap(...MAP.last); T.push(performance.now()-t); A.push(window.__AT||[]); }
    const row=n=>{ const s=[...PF.st.values()].find(s=>s.tag==='map'&&s.name===n); return s?s.last.toFixed(1):'-'; };
    T.sort((a,b)=>a-b); const a=[0,1,2,3].map(k=>A.reduce((s,v)=>s+(v[k]||0),0)/A.length); return `map ${T[6].toFixed(1)} · filter ${row('asp filter')} project ${row('asp project')} airspace ${row('airspace')} (stroke ${a[0]?.toFixed(1)} labels ${a[1]?.toFixed(1)}) · ${a[2]} areas ${a[3]} pts`; },[pos,rg]);
  console.log(nm.padEnd(5), String(rg).padStart(3),'NM', r); }
 console.log(errs); await b.close(); })();
