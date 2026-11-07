const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); require('./classic.js')(b); const errs=[];
 for(const [n,o] of [['tab',{viewport:{width:1280,height:800},deviceScaleFactor:1.5,hasTouch:true}],['tabp',{viewport:{width:800,height:1280},deviceScaleFactor:1.5,hasTouch:true}],['phone',PX9]]){
  const p=await (await b.newContext(o)).newPage(); p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=270&gs=90'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(1500);
  const rows=await p.$$('#list .row'); if(rows[3]){ await rows[3].scrollIntoViewIfNeeded(); await rows[3].click(); }
  await p.waitForTimeout(1500); await p.screenshot({path:`play/ah_${n}_list.png`});
  const info=await p.evaluate(()=>{ const r=$('adCard').getBoundingClientRect(), s=document.querySelector('.status').getBoundingClientRect(); return {card:Math.round(r.top), statusBottom:Math.round(s.bottom), stickH:getComputedStyle(document.documentElement).getPropertyValue('--stickH'), sticky:getComputedStyle(document.querySelector('.status')).position}; });
  console.log(n,'list',JSON.stringify(info));
  await p.evaluate(()=>window.scrollTo(0,0)); await p.waitForTimeout(300); await p.click('#sCtl').catch(()=>{}); await p.waitForTimeout(1500);
  console.log(n,'ctl',JSON.stringify(await p.evaluate(()=>{ const r=$('adCard').getBoundingClientRect(), s=document.querySelector('.status').getBoundingClientRect(); return {card:Math.round(r.top), statusBottom:Math.round(s.bottom)}; })));
  await p.screenshot({path:`play/ah_${n}_ctl.png`}); }
 console.log(errs); await b.close(); })();
