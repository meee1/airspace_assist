// icon-only GPS tile: colour by accuracy, SIM spelled out, tooltip carries the text
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const errs=[];
 for(const [n,acc] of [['good',8],['fair',150],['poor',900]]){
  const ctx=await b.newContext({...PX9,geolocation:{latitude:-38.25,longitude:144.43,accuracy:acc},permissions:['geolocation']}); const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8811/index.html'); await p.waitForFunction(()=>typeof render==='function'); await p.evaluate(()=>{ ls.set('simOn',false); }); await p.reload(); await p.waitForFunction(()=>typeof render==='function');
  await p.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(x=>/start/i.test(x.textContent)); if(b) b.click(); }); await p.waitForTimeout(1500);
  console.log(n, await p.evaluate(()=>[$('gpsTile').title, $('gpsDot').className, getComputedStyle($('gpsDot')).color].join(' | ')));
  await (await p.$('.status')).screenshot({path:`play/gps_${n}.png`}); await ctx.close(); }
 const ctx=await b.newContext(PX9); const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(800);
 console.log('sim', await p.evaluate(()=>$('gpsTile').title)); await (await p.$('.status')).screenshot({path:'play/gps_sim.png'});
 console.log(errs); await b.close(); })();
