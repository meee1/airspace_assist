// Tablet full screen: the divider between the tile column and the map (19 Nov 2026), and the wires warning spoken only when low
// at the line. node play/tabsplit.js   (app served on :8811)
const {chromium}=require('playwright'); const {TAB,PX9}=require('./px9.js'); const fs=require('fs');
(async()=>{ const b=await chromium.launch(), errs=[], fail=[]; const ok=(c,m)=>{ console.log((c?'ok   ':'FAIL ')+m); if(!c) fail.push(m); };
  const ctx=await b.newContext({...TAB,storageState:{cookies:[],origins:[{origin:'http://localhost:8811',localStorage:[{name:'rc_fsMap',value:'true'}]}]}});
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8811/index.html?sim=-37.95,145.0&alt=1500&trk=000&gs=90'); await p.waitForFunction(()=>typeof render==='function'&&st.pos); await p.waitForTimeout(600);
  const geo=()=>p.evaluate(()=>({col:Math.round(document.querySelector('.wrap>.status').getBoundingClientRect().width), map:Math.round($('mapSec').getBoundingClientRect().left), sheet:Math.round($('fsSheet').getBoundingClientRect().left),
    sp:(r=>Math.round(r.left+r.width/2))($('fsSplit').getBoundingClientRect()), vis:getComputedStyle($('fsSplit')).display, sw:document.documentElement.scrollWidth<=innerWidth}));
  let g=await geo(); ok(g.vis==='block'&&g.col===300&&g.map===300&&Math.abs(g.sp-300)<=1,'default: 300 px column, divider on its edge');
  const drag=async x=>{ const s=await p.$('#fsSplit'), bb=await s.boundingBox(); await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2); await p.mouse.down(); await p.mouse.move(x,bb.y+bb.height/2,{steps:6}); await p.mouse.up(); await p.waitForTimeout(300); };
  await drag(460); g=await geo(); ok(Math.abs(g.col-460)<=2&&g.map===g.col&&g.sheet===g.col&&g.sw,`dragged to 460: column ${g.col}, map and sheet from ${g.map}/${g.sheet}`);
  await p.screenshot({path:__dirname+'/tabsplit_460.png'});
  await drag(100); g=await geo(); ok(g.col===240,'not narrower than 240 px ('+g.col+')');
  await drag(1400); g=await geo(); ok(g.col<=Math.round(1470*0.45)+1&&g.col>600,'not wider than 45% of the screen ('+g.col+')');
  await drag(420); await p.reload(); await p.waitForFunction(()=>typeof render==='function'&&st.pos); await p.waitForTimeout(500); g=await geo();
  ok(Math.abs(g.col-420)<=2&&g.map===g.col,'kept after a reload ('+g.col+')');
  await p.focus('#fsSplit'); await p.keyboard.press('ArrowRight'); g=await geo(); ok(Math.abs(g.col-440)<=2,'arrow key: +20 px ('+g.col+')');
  await ctx.close();
  // the phone has no divider
  { const c=await b.newContext({...PX9,storageState:{cookies:[],origins:[{origin:'http://localhost:8811',localStorage:[{name:'rc_fsMap',value:'true'}]}]}}); const q=await c.newPage();
    await q.goto('http://localhost:8811/index.html?sim=-37.95,145.0&alt=1500&trk=000&gs=90'); await q.waitForFunction(()=>typeof render==='function'&&st.pos);
    ok(await q.evaluate(()=>getComputedStyle($('fsSplit')).display==='none'),'phone: no divider'); await c.close(); }
  // wires: the row below 500 ft AGL, spoken only below 300 ft above the ground at the line
  { const c=await b.newContext({...PX9,storageState:{cookies:[],origins:[{origin:'http://localhost:8811',localStorage:[{name:'rc_fsMap',value:'false'}]}]}});
    await c.addInitScript(()=>{ window.__said=[]; Object.defineProperty(window,'speechSynthesis',{value:{speak:u=>window.__said.push(u.text),cancel(){}},configurable:true}); window.SpeechSynthesisUtterance=function(t){ this.text=t; }; });
    const pl=fs.readFileSync(__dirname+'/fixtures/powerlines_sample.json'); await c.route(/powerlines\.json/,r=>r.fulfill({body:pl,contentType:'application/json'}));
    const q=await c.newPage(); q.on('pageerror',e=>errs.push(e.message));
    await q.goto('http://localhost:8811/index.html?sim=YMMB&alt=300&trk=000&gs=90'); await q.waitForFunction(()=>typeof render==='function'&&st.pos); await q.waitForTimeout(800);
    // find a line crossing: fly north from points south of one until the row shows, at a given height above the ground
    const at=agl=>q.evaluate(agl=>{ __said.length=0; PL.said.clear(); for(let k=0;k<200;k++){ const la=-37.90-k*0.002, lo=145.079; const t=terrainFt(la,lo)||0; $('simPos').value=la.toFixed(5)+','+lo; $('simAlt').value=String(Math.round(t+agl)); simApply(); render();
        if(PL.hit) return {hit:true, agl:PL.hit.agl, row:!$('sWires').hidden, said:__said.slice()}; } return {hit:false}; },agl);
    let r=await at(450); ok(r.hit&&r.row&&!r.said.length,`450 ft above the ground: WIRES row shown (${r.agl} ft), not spoken`);
    r=await at(200); ok(r.hit&&r.row&&r.said.some(s=>/^Wires ahead/.test(s)),`200 ft above the ground: shown and spoken (${JSON.stringify(r.said)})`);
    await c.close(); }
  console.log(fail.length? fail.length+' FAILED':'all passed'); console.log(errs); await b.close(); process.exit(fail.length?1:0); })();
