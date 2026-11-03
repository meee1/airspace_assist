const {chromium,devices}=require('playwright');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({...devices['iPhone 13']}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YTYA&alt=1500&trk=&gs=0'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(300);
 await p.evaluate(()=>{document.getElementById('calls').open=true;});
 for(const v of ['ABC','vh-abc','VH ABC','ALPHA BRAVO CHARLIE','RESCUE','POLAIR 31','QFA123','24-1234','GHB']){
   await p.fill('#cSign',''); await p.type('#cSign',v); const prev=await p.textContent('#cSay');
   const mid=(await p.$eval('#callsList .say',x=>x.innerText)).split(',')[1];
   await p.press('#cSign','Enter'); await p.locator('#cType').focus();
   console.log(v.padEnd(20),'| preview:',prev.padEnd(36),'| call:',mid,'| box after:',await p.inputValue('#cSign'));
 }
 await p.reload(); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(300);
 console.log('after reload box:', await p.inputValue('#cSign'), errs); await b.close(); })();
