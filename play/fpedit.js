const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext(PX9); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YLIL&alt=1500&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(600);
 await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('rc_fsMap','false'); FP=null; CH.on=false; MAP.up='north'; MAP.range=20; render(); });
 const menu=()=>p.evaluate(()=>$('mapMenu').hidden?'(closed)':[...$('mmBtns').children].map(b=>b.textContent).join(' | '));
 const press=async(la,lo)=>{ await p.evaluate(([la,lo])=>{ const [x,y]=MAP.P(la,lo); mapMenu(x,y); },[la,lo]); return menu(); };
 const click=async txt=>p.evaluate(t=>{ const b=[...$('mmBtns').children].find(b=>b.textContent.startsWith(t)); b.click(); return b.textContent; },txt);
 const plan=()=>p.evaluate(()=>FP? FP.pts.map((q,k)=>(k===FP.i?'*':'')+(q.c||q.n)).join(' → ')+'  GO='+(GO&&GO.c) : 'none');
 console.log('YLIL menu:', await press(-37.692,145.367)); console.log(await click('Start flight plan'), '=>', await plan());
 console.log('YMMB menu:', await press(-37.976,145.102)); console.log(await click('Add'), '=>', await plan());
 console.log('YMEN menu:', await press(-37.728,144.902)); console.log(await click('Add'), '=>', await plan());
 // between YLIL and YMMB there's e.g. a map point near Dandenong
 console.log('mid menu:', await press(-37.85,145.25)); console.log(await click('Insert'), '=>', await plan());
 await p.evaluate(()=>{ $('fpBody').scrollIntoView(); });
 await p.click('#fpEdit'); await p.waitForTimeout(150);
 await (await p.$('#fpLegs')).screenshot({path:'play/fpedit_list.png'});
 console.log('edit pressed:', await p.evaluate(()=>$('fpEdit').textContent+' '+$('fpLegs').className));
 await p.click('#fpLegs li[data-k="3"] [data-a="up"]'); console.log('move 4 up =>', await plan());
 await p.click('#fpLegs li[data-k="0"] [data-a="dn"]'); console.log('move 1 down =>', await plan());
 await p.click('#fpLegs li[data-k="2"] [data-a="del"]'); console.log('del 3 =>', await plan());
 await p.click('#fpLegs li[data-k="1"]'); console.log('tap row in edit (no pick) =>', await plan());
 await p.click('#fpEdit'); await p.click('#fpLegs li[data-k="2"]'); console.log('tap row after done =>', await plan());
 console.log('nx key rev', await p.evaluate(()=>FP.rev));
 // persisted
 await p.reload(); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(500); console.log('after reload =>', await plan());
 await p.evaluate(()=>$('mapSec').scrollIntoView()); const [x,y]=await p.evaluate(()=>MAP.P(-37.6,145.0)); await p.evaluate(([x,y])=>mapMenu(x,y),[x,y]); await p.waitForTimeout(150);
 await (await p.$('.mapbox')).screenshot({path:'play/fpedit_menu.png'});
 // delete all
 await p.evaluate(()=>{ mapMenuClose(); FP_EDIT=true; render(); }); for(let k=0;k<6&&await p.evaluate(()=>!!FP);k++) await p.click('#fpLegs li[data-k="0"] [data-a="del"]');
 console.log('all deleted =>', await plan(), 'edit', await p.evaluate(()=>FP_EDIT));
 console.log(errs); await b.close(); })();
