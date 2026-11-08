// Saved flight plans (Flight plan → Plans): save the current plan by name, list, load (and load reversed), find, replace,
// delete; kept after a reload and in the settings backup.
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({...PX9}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 let dlg=[]; p.on('dialog',d=>{ dlg.push(d.message()); d.accept(); });
 await p.goto('http://localhost:8811/index.html?sim=YBRS&alt=1500&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(400);
 const list=()=>p.evaluate(()=>[...document.querySelectorAll('#plList li')].map(li=>li.innerText.replace(/\s*\n\s*/g,' / ').replace(/ Load.*$/,'')).join(' || '));
 await p.click('#fpPlans'); await p.waitForTimeout(200); console.log('empty:', await list(), '· save disabled', await p.evaluate(()=>$('plSave').disabled)); await p.click('#plClose');
 await p.setInputFiles('#fpFile',__dirname+'/fixtures/ybrs.gpx'); await p.waitForFunction(()=>FP);
 await p.evaluate(()=>{ FP.pts[2].alt=3500; ls.set('fp',FP); });   // an edit that should be saved
 await p.click('#fpPlans'); await p.fill('#plName','Home loop'); await p.click('#plSave'); await p.waitForTimeout(200);
 console.log('saved:', await p.textContent('#plStat'), '·', await list());
 // a second plan: two points
 await p.evaluate(()=>{ const pt=c=>{ const a=DATA.ap.find(x=>x.i===c); return {n:a.n,c:a.i,la:a.la,lo:a.lo}; }; fpSet({name:'YBRS – YMMB',pts:[pt('YBRS'),pt('YMMB')],i:1}); fplRender(); });
 await p.fill('#plName','To Moorabbin'); await p.click('#plSave'); await p.waitForTimeout(200); console.log('two:', await list());
 // load the first back (current plan is saved, so no question)
 dlg=[]; await p.click('#plList li:nth-child(2) [data-a="load"]'); await p.waitForTimeout(300);
 console.log('loaded:', await p.evaluate(()=>FP.name+' · '+FP.pts.length+' pts · alt kept '+(FP.pts[2]||{}).alt+' · active '+FP.i+' · dialog closed '+!$('plDlg').open), '· questions', dlg.length);
 // reversed
 await p.click('#fpPlans'); await p.click('#plList li:nth-child(1) [data-a="rev"]'); await p.waitForTimeout(300);
 console.log('reversed:', await p.evaluate(()=>FP.name+' · '+FP.pts.map(q=>q.c||q.n).join('>')));
 // the reversed plan isn't saved: loading another asks first before it's replaced
 dlg=[]; await p.click('#fpPlans'); await p.click('#plList li:nth-child(1) [data-a="load"]'); await p.waitForTimeout(300); console.log('unsaved current → asked:', dlg.join(' | '));
 // saving under an existing name asks first
 await p.evaluate(()=>{ FP.pts[1].alt=4500; FP.plan=null; ls.set('fp',FP); }); dlg=[]; await p.click('#fpPlans'); await p.fill('#plName','to moorabbin'); await p.click('#plSave'); await p.waitForTimeout(200);
 console.log('same name:', dlg.join(' | '), '·', await p.textContent('#plStat'), '· plans', await p.evaluate(()=>PLANS.length));
 // find (shown with 6+ plans)
 await p.evaluate(()=>{ for(let k=0;k<5;k++){ PLANS.push({id:'x'+k,name:'Extra '+k,t:Date.now(),pts:[{n:'A',c:'YLIL',la:-37.7,lo:145.37},{n:'B',c:'YTYA',la:-38.27,lo:145.18}]}); } ls.set('plans',PLANS); fplRender(); });
 console.log('filter shown', await p.evaluate(()=>!$('plFilterRow').hidden)); await p.fill('#plFilter','YTYA'); await p.waitForTimeout(100); console.log('find YTYA:', await p.evaluate(()=>document.querySelectorAll('#plList li').length), 'plans');
 await p.fill('#plFilter',''); await p.waitForTimeout(100);
 dlg=[]; await p.click('#plList li[data-id="x0"] [data-a="del"]'); await p.waitForTimeout(200); console.log('delete:', dlg.join(' | '), '·', await p.textContent('#plStat'), '· plans', await p.evaluate(()=>PLANS.length));
 await p.reload(); await p.waitForFunction(()=>typeof render==='function'); console.log('after reload:', await p.evaluate(()=>PLANS.map(e=>e.name).slice(0,3).join(', ')+' … '+PLANS.length), '· in backup', await p.evaluate(()=>'rc_plans' in JSON.parse(gdBackup()).keys));
 console.log(errs); await b.close(); })();
