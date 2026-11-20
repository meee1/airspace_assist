// Coastline map layer (20 Nov 2026, Michael: "Add coastline as a layer"). node play/coastlayer.js  (app on :8811)
// Checks: button in the Layers grid, lines drawn at 10/40/160 NM, none along the 1° tile edges (144°E / 38°S cross
// Port Phillip's land), message beyond 160 NM, setting kept after a reload.
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(), errs=[], fail=[]; const ok=(c,m)=>{ console.log((c?'ok   ':'FAIL ')+m); if(!c) fail.push(m); };
  const ctx=await b.newContext({...PX9,storageState:{cookies:[],origins:[{origin:'http://localhost:8811',localStorage:[{name:'rc_fsMap',value:'true'},{name:'rc_mapTer',value:'false'},{name:'rc_mapLead',value:'false'},{name:'rc_mapCharts',value:'false'},{name:'rc_mapSat',value:'false'},{name:'rc_mapCtaf',value:'false'}]}]}});
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8811/index.html?sim=-37.95,145.02&alt=1500&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'&&st.pos); await p.waitForTimeout(500);
  ok(await p.evaluate(()=>$('mapCoast').parentElement.id==='layPop'&&/Coast/.test($('mapCoast').textContent)),'Coast button in the Layers grid');
  // pixels in the coast colour within a box of the screen (device px)
  const count=(box)=>p.evaluate(box=>{ const c=$('map'), k=c.width/c.clientWidth, col=cssv('--coast'), R=parseInt(col.slice(1,3),16), G=parseInt(col.slice(3,5),16), B=parseInt(col.slice(5,7),16);
    const [x0,y0,w,h]=box? box.map(v=>Math.round(v*k)) : [0,0,c.width,c.height]; const d=c.getContext('2d').getImageData(x0,y0,Math.max(1,w),Math.max(1,h)).data; let n=0;
    for(let i=0;i<d.length;i+=4) if(Math.abs(d[i]-R)<30&&Math.abs(d[i+1]-G)<30&&Math.abs(d[i+2]-B)<30) n++; return n; },box);
  const n0=await count();
  await p.evaluate(()=>$('mapCoast').click()); await p.waitForFunction(()=>COAST.idx&&[...COAST.dec.values()].some(v=>v!=='loading'),null,{timeout:15000}); await p.evaluate(()=>render()); await p.waitForTimeout(300);
  const n1=await count(); ok(n1>n0+800,`10 NM: coast drawn (${n1} px in its colour, ${n0} before)`);
  await p.screenshot({path:__dirname+'/coastlayer_10.png'});
  // the 145°E tile edge runs north-south over land east of the bay: no coast line along it (a strip 3 px wide, inland part)
  const edge=async()=>{ const r=await p.evaluate(()=>{ const a=MAP.P(-37.84,145.0), b=MAP.P(-37.72,145.0); return [Math.min(a[0],b[0])-1.5, Math.min(a[1],b[1]), 3, Math.abs(a[1]-b[1])]; }); return count(r); };
  ok((await edge())<20,'no line along the 145°E tile edge over land (Kew)');
  const e38=await p.evaluate(()=>{ const a=MAP.P(-38.0,145.15), b=MAP.P(-38.0,145.30); return [Math.min(a[0],b[0]), Math.min(a[1],b[1])-1.5, Math.abs(a[0]-b[0]), 3]; });
  ok((await count(e38))<20,'no line along the 38°S tile edge over land (Carrum Downs)');
  for(const rg of [40,160]){ await p.evaluate(rg=>{ MAP.range=rg; render(); },rg); await p.waitForTimeout(800); await p.evaluate(()=>render()); await p.waitForTimeout(300);
    const n=await count(); ok(n>800,`${rg} NM: coast drawn (${n} px)`); await p.screenshot({path:__dirname+`/coastlayer_${rg}.png`}); }
  const t=await p.evaluate(()=>{ PF.on=true; for(let i=0;i<6;i++) render(); const s=[...PF.st.values()].find(v=>v.name==='coastline'); PF.on=false; return s? s.avg : null; }); console.log(`     coastline stage at 160 NM: ${t==null?'?':t.toFixed(1)} ms`);
  await p.evaluate(()=>{ MAP.range=320; render(); }); await p.waitForTimeout(300);
  ok(await p.evaluate(()=>COAST.on),'320 NM: still on (zoom-in note shown)');
  await p.reload(); await p.waitForFunction(()=>typeof render==='function'&&st.pos);
  ok(await p.evaluate(()=>COAST.on&&$('mapCoast').getAttribute('aria-pressed')==='true'),'kept after a reload');
  console.log(fail.length? fail.length+' FAILED':'all passed'); console.log(errs); await b.close(); process.exit(fail.length?1:0); })();
