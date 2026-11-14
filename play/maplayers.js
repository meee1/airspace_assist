// Map buttons with outline icons and labels; on the full-screen map the ten layer buttons are in a grid opened by
// Layers (it stays open while switching layers, closes on a tap elsewhere); classic page: icons beside the labels in the row.
// Phone and tablet. Pictures: play/maplayers_*.png
const {chromium}=require('playwright'); const {PX9,TAB}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const errs=[];
 for(const [nm,prof,fs] of [['phone',PX9,true],['tablet',TAB,true],['phone_classic',PX9,false]]){
  const ctx=await b.newContext({...prof}); await ctx.addInitScript(fs=>{ try{ localStorage.setItem('rc_fsMap',JSON.stringify(fs)); localStorage.setItem('rc_mapUp','"north"'); }catch(e){} },fs);
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(nm+': '+e.message)); await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(800);
  const icons=await p.evaluate(()=>['mapCtaf','mapTer','mapSat','mapChart','mapLead','mapWire','mapRadar','mapMeas','mapRange','mapLog','mapTraffic','mapUp'].filter(id=>!$(id).querySelector('svg')));
  if(icons.length) errs.push(nm+' no icon: '+icons);
  if(fs){
    const vis=await p.evaluate(()=>({layers:!!$('mapLayers').offsetParent, grid:$('layPop').hidden, inGrid:$('mapCtaf').parentElement.id}));
    console.log(nm, 'closed:', JSON.stringify(vis)); if(!vis.layers||!vis.grid||vis.inGrid!=='layPop') errs.push(nm+' closed '+JSON.stringify(vis));
    await (await p.$('#mapSec')).screenshot({path:`play/maplayers_${nm}.png`});
    await p.click('#mapLayers'); await p.waitForTimeout(200);
    const r=await p.evaluate(()=>{ const q=$('layPop').getBoundingClientRect(), m=$('mapSec').getBoundingClientRect(); return {open:!$('layPop').hidden, inside:q.left>=m.left&&q.top>=m.top&&q.right<=m.right&&q.bottom<=m.bottom, box:[q.left,q.top,q.width,q.height].map(Math.round)}; });
    console.log(nm, 'open:', JSON.stringify(r)); if(!r.open||!r.inside) errs.push(nm+' open '+JSON.stringify(r));
    await p.click('#mapTer'); await p.waitForTimeout(150); await p.click('#mapLog'); await p.waitForTimeout(150);
    const t=await p.evaluate(()=>({ter:MAP.ter, log:MAP.log, stillOpen:!$('layPop').hidden})); console.log(nm, 'toggled Terrain and Log:', JSON.stringify(t)); if(!t.stillOpen) errs.push(nm+' closed on toggle');
    await (await p.$('#mapSec')).screenshot({path:`play/maplayers_${nm}_open.png`});
    const m=await (await p.$('#map')).boundingBox(); await p.mouse.click(m.x+30,m.y+m.height*0.5); await p.waitForTimeout(150);
    const c=await p.evaluate(()=>$('layPop').hidden); console.log(nm, 'tap on the map closes it:', c); if(!c) errs.push(nm+' not closed');
  } else {
    const row=await p.evaluate(()=>({parent:$('mapCtaf').parentElement.className, layersBtn:!!$('mapLayers').offsetParent})); console.log(nm, JSON.stringify(row)); if(row.parent!=='mapctl'||row.layersBtn) errs.push(nm+' classic '+JSON.stringify(row));
    await (await p.$('.mapctl')).screenshot({path:`play/maplayers_${nm}.png`}); }
  await ctx.close(); }
 console.log(errs); await b.close(); })();
