// split around Avalon: strips inside the zone (YAVE) mustn't cut neighbours; All on, 126.7 split off (default) and on; options dialog
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const p=await (await b.newContext(PX9)).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YMAV&alt=1500&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(600);
 console.log('127 default', await p.evaluate(()=>ls.get('ctafSplit127',false)));
 for(const [name,all,s127] of [['main',false,false],['all',true,false],['all127',true,true]]){
  await p.evaluate(([all,s127])=>{ ls.set('ctafSplit127',s127); $('simPos').value='YMAV'; simApply(); st.all=all; CH.on=false; MAP.ter=false; MAP.ctaf=true; MAP.range=20; MAP.up='north'; MAP.pan=null; render(); },[all,s127]); await p.waitForTimeout(500);
  const m=await p.$('#map'); await m.screenshot({path:`play/avsplit_${name}.png`}); }
 await p.evaluate(()=>ls.set('ctafSplit127',false)); await p.reload(); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(500);
 await p.click('#bOpts'); await p.waitForTimeout(300); await p.click('#optCtafSplit127'); console.log('after tick', await p.evaluate(()=>ls.get('ctafSplit127',false)));
 await p.click('#optCtafSplit'); console.log('disabled when split off', await p.evaluate(()=>$('optCtafSplit127').disabled)); await p.click('#optCtafSplit');
 const d=await p.$('#optCtafSplit127'); await d.scrollIntoViewIfNeeded(); await p.screenshot({path:'play/avsplit_opts.png'});
 console.log(errs); await b.close(); })();
