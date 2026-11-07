// WAC sheets under the VNC/VTC: map screenshots with every sheet ticked, at places with and without VNC/VTC cover
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({...PX9,deviceScaleFactor:1}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{ try{ localStorage.setItem('rc_fsMap','true'); localStorage.setItem('rc_mapUp','"north"'); localStorage.setItem('rc_mapTer','false'); }catch(e){} });
 await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'&&CH.site.length>0,{timeout:20000});
 console.log('sheets', await p.evaluate(()=>CH.site.map(s=>s.sheet+(s.def?'*':'')).join(' ')));
 await p.evaluate(()=>{ ls.set('chartSel',CH.site.map(s=>s.sheet)); chartMerge(); MAP.ter=false; });
 for(const [nm,pos,rg] of (process.argv[2]?JSON.parse(process.argv[2]):[['bendigo','-36.74,144.28',20],['melb40','-37.9,144.9',40],['perth','-31.94,115.97',40],['nullarbor','-31.45,129.0',80],['sydney','-33.95,151.18',80]])){
   await p.evaluate(([pos,rg])=>{ $('simPos').value=pos; simApply(); MAP.range=rg; render(); },[pos,rg]);
   for(let i=0;i<10;i++){ await p.waitForTimeout(700); if(await p.evaluate(()=>![...CH.imgs.values()].includes('loading'))) break; }
   await p.evaluate(()=>{ CHC.key=''; drawMap(...MAP.last); }); await p.waitForTimeout(300);
   await (await p.$('#map')).screenshot({path:`/tmp/claude-0/wac_${nm}.png`});
 }
 console.log(errs); await b.close(); })();
