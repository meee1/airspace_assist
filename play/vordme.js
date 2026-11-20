// Navaids on the map: hidden by default, shown from the legend (21 Nov 2026, Michael: "Add ability to hide vor and dme,
// off by default", then "And ndb"). node play/vordme.js  (app on :8811)
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(), errs=[], fail=[]; const ok=(c,m)=>{ console.log((c?'ok   ':'FAIL ')+m); if(!c) fail.push(m); };
  const ctx=await b.newContext({...PX9,storageState:{cookies:[],origins:[{origin:'http://localhost:8811',localStorage:[{name:'rc_fsMap',value:'false'}]}]}});
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8811/index.html?sim=-37.85,144.95&alt=3000&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'&&st.pos);
  await p.evaluate(()=>{ MAP.range=20; render(); }); await p.waitForTimeout(400);
  const nav=()=>p.evaluate(()=>{ const h=MAP.hits.filter(x=>x.p.k==='NAV'); return {vor:h.filter(x=>x.p.t!=='NDB').map(x=>x.p.c+' '+x.p.t), ndb:h.filter(x=>x.p.t==='NDB').length, leg:$('mapLeg').querySelector('[data-leg="VOR"]').getAttribute('aria-pressed')}; });
  let r=await nav(); ok(!r.vor.length&&!r.ndb&&r.leg==='false','default: no navaids on the map, legend item off');
  await p.locator('#mapLeg [data-leg="VOR"]').click(); await p.waitForTimeout(300);
  r=await nav(); ok(r.vor.length>=3&&r.ndb>0&&r.leg==='true','legend tap: shown ('+r.vor.join(', ')+' and '+r.ndb+' NDB)');
  await p.locator('#mapSec').screenshot({path:__dirname+'/vordme_on.png'});
  await p.reload(); await p.waitForFunction(()=>typeof render==='function'&&st.pos); await p.evaluate(()=>{ MAP.range=20; render(); }); await p.waitForTimeout(400);
  r=await nav(); ok(r.vor.length>=3&&r.leg==='true','kept after a reload');
  await p.locator('#mapLeg [data-leg="VOR"]').click(); await p.waitForTimeout(300); r=await nav(); ok(!r.vor.length&&!r.ndb,'tap again: hidden');
  ok(await p.evaluate(()=>!!findPoint('ML')),'still found by search / Go to');
  console.log(fail.length? fail.length+' FAILED':'all passed'); console.log(errs); await b.close(); process.exit(fail.length?1:0); })();
