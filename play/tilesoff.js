// Every top-bar tile turned off in Options stays hidden, including rows that rewrite their own classes as they update
// (LAST LIGHT, FUEL, IN, …): set each tile off, force its row to show content, and check nothing of it is visible.
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const errs=[];
 for(const fs of [false,true]){ const ctx=await b.newContext({...PX9,storageState:{cookies:[],origins:[{origin:'http://localhost:8811',localStorage:[{name:'rc_fsMap',value:String(fs)},{name:'rc_fuel',value:JSON.stringify({fob:250,burn:100,run:0,on:true,t1:Date.now(),auto:false,rem:0})}]}]}});
  await ctx.addInitScript(()=>{ const D=Date, off=D.parse('2026-11-10T09:15:00Z')-D.now(); window.Date=class extends D{ constructor(...a){ super(...(a.length?a:[D.now()+off])); } static now(){ return D.now()+off; } }; });   // 20 min before last light at YBRS
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8811/index.html?sim=YBRS&alt=1500&trk=045&gs=90'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(800);
  await p.evaluate(()=>{ lastLightUI(); fuTick(); render(); });
  const vis=id=>p.evaluate(id=>{ const e=$(id); if(!e) return false; const r=e.getBoundingClientRect(); return !e.hidden&&getComputedStyle(e).display!=='none'&&r.width>0&&r.height>0; },id);
  const before={last:await vis('sLastRow'), fuel:await vis('sFuel')};
  await p.evaluate(()=>{ ls.set('tilesOff',TILES.map(t=>t[0])); tilesLayout(); render(); lastLightUI(); fuTick(); });   // all off, then the rows update themselves
  await p.waitForTimeout(5500); await p.evaluate(()=>{ lastLightUI(); fuTick(); render(); });
  const shown=[]; for(const [k,,ids] of await p.evaluate(()=>TILES)) for(const id of ids) if(await vis(id)) shown.push(k+':'+id);
  console.log(fs?'full screen':'classic', '· before: LAST LIGHT shown', before.last, '· FUEL shown', before.fuel, '· all off → still visible:', shown.join(', ')||'none');
  await ctx.close(); }
 console.log(errs); await b.close(); })();
