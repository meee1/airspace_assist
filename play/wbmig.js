// an old (MM-only) Bell profile gets the FM envelope on load, keeping typed values
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({...PX9}); const old={profiles:[{id:'pold',name:'Bell 206B-3 (91 gal)',u:'lb',maxW:3200,dens:6.8,src:'BHT-206A/B-SERIES-MM-2 ch 8',ew:1800,ea:116,el:0,env:'',lenv:'',
   st:[{n:'Pilot (right)',k:'seat',a:65,l:14,max:null},{n:'Baggage',k:'bag',a:null,l:0,max:null},{n:'Fuel (91 gal)',k:'fuel',a:118,l:0,max:91}]}],cur:'pold',load:{pold:[170,0,50]}};
 await ctx.addInitScript(o=>{ if(!sessionStorage.getItem('x')){ localStorage.setItem('rc_wb',JSON.stringify(o)); sessionStorage.setItem('x','1'); } },old);
 const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); await p.goto('http://localhost:8811/index.html?sim=YBRS'); await p.waitForFunction(()=>typeof wbCheck==='function');
 console.log(await p.evaluate(()=>{ const P=WB.profiles[0]; return JSON.stringify({ew:P.ew,env:P.env.split('\n').length,lenv:P.lenv.split('\n').length,minFront:P.minFront,bagMax:P.st[1].max,src:P.src,load:WB.load.pold}); }), errs); await b.close(); })();
