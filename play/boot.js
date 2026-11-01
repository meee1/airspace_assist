// loading screen: steps with MB progress (throttled), hides when the app has started; error shown when data.json fails
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext(PX9); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 const cdp=await ctx.newCDPSession(p); await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:100,downloadThroughput:1.5e6/8*8,uploadThroughput:1e5});
 p.goto('http://localhost:8811/index.html'); await p.waitForTimeout(1800); await p.screenshot({path:'play/boot_mid.png'});
 console.log('mid', await p.evaluate(()=>[...document.querySelectorAll('#bootSteps li')].map(l=>l.className+':'+l.textContent).join(' | ')));
 await p.waitForFunction(()=>!document.getElementById('boot'),null,{timeout:60000}); console.log('boot removed; render', await p.evaluate(()=>typeof render));
 await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
 const c2=await b.newContext({...PX9,serviceWorkers:'block'}); const p2=await c2.newPage(); p2.on('pageerror',e=>errs.push(e.message)); await p2.route(/data(-next)?\.json/,r=>r.fulfill({status:404,body:'nope'})); await p2.goto('http://localhost:8811/index.html'); await p2.waitForTimeout(1000);
 console.log('err', await p2.textContent('#bootMsg')); await p2.screenshot({path:'play/boot_err.png'});
 console.log(errs); await b.close(); })();
