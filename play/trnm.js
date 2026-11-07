// ADS-B traffic distance (Options → ADS-B traffic): the request asks for the chosen NM; an older proxy that caps at 40 is reported.
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({...PX9}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 const asked=[]; let cap=100;
 await ctx.route(/\/traffic\?/,r=>{ const nm=+new URL(r.request().url()).searchParams.get('nm'); asked.push(nm); const used=Math.min(cap,nm);
   r.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:{src:'mock',t:new Date().toISOString(),...(cap>40?{nm:used}:{}),n:0,ac:[]}}); });
 await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(300);
 await p.evaluate(()=>{ ls.set('notamUrl','http://proxy.test'); MAP.traffic=true; TR.t=0; trPoll(); }); await p.waitForTimeout(600);
 console.log('default asks', asked.slice(-1)[0], '· select', await p.evaluate(()=>$('optTrNm').value));
 await p.evaluate(()=>{ $('bOpts').click(); }); await p.selectOption('#optTrNm','60'); await p.waitForTimeout(600);
 console.log('60 NM asks', asked.slice(-1)[0], '· stored', await p.evaluate(()=>ls.get('trNm')), '·', await p.evaluate(()=>{ $('trStat').textContent=''; return new Promise(r=>setTimeout(()=>r($('trStat').textContent),1100)); }));
 cap=40; await p.evaluate(()=>{ TR.t=0; trPoll(); }); await p.waitForTimeout(600);
 console.log('old proxy:', await p.evaluate(()=>new Promise(r=>setTimeout(()=>r($('trStat').textContent),1100))));
 await p.reload(); await p.waitForFunction(()=>typeof render==='function'); console.log('after reload select', await p.evaluate(()=>$('optTrNm').value));
 console.log(errs); await b.close(); })();
