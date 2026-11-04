// aspNear/aspAt index: same airspaces, same order as a full ASP scan at 20,000 random points (and around Melbourne)
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({...PX9}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=090&gs=90'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(1200);
 console.log(await p.evaluate(()=>{ let bad=0, n=0, hits=0; let s=1; const rnd=()=>(s=(s*16807)%2147483647)/2147483647;
   for(let i=0;i<20000;i++){ const melb=i<8000, la= melb? -38.6+rnd()*1.4 : -44+rnd()*34, lo= melb? 144+rnd()*2 : 112+rnd()*42;
     const A=ASP.filter(x=>inAsp(x,la,lo)), B=aspAt(la,lo); n++; hits+=A.length; if(A.length!==B.length||A.some((x,k)=>x!==B[k])) bad++; }
   return `${n} points, ${hits} airspace hits, mismatches ${bad}, cells built ${ASPG.size}`; }));
 console.log(errs); await b.close(); })();
