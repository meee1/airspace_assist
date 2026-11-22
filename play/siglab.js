// SIGMET labels inside their polygon (22 Nov 2026, Michael: "Sigmets text is outside the polygon") and TOT ignoring a coast
// leg's turn points ("Tot includes cst waypoints, dont"). node play/siglab.js  (app on :8811)
const {chromium}=require('playwright'); const {PX9}=require('./px9.js'); const fs=require('fs');
(async()=>{ const b=await chromium.launch(), errs=[], fail=[]; const ok=(c,m)=>{ console.log((c?'ok   ':'FAIL ')+m); if(!c) fail.push(m); };
  const ctx=await b.newContext({...PX9,storageState:{cookies:[],origins:[{origin:'http://localhost:8811',localStorage:[{name:'rc_fsMap',value:'false'},{name:'rc_mapCharts',value:'false'},{name:'rc_mapTer',value:'false'}]}]}});
  await ctx.addInitScript(()=>{ const D=Date, off=D.parse('2026-11-07T23:00:00Z')-D.now(); window.Date=class extends D{ constructor(...a){ super(...(a.length?a:[D.now()+off])); } static now(){ return D.now()+off; } }; });
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
  const j=JSON.parse(fs.readFileSync(__dirname+'/fixtures/naips_area_full.json','utf8'));
  await p.goto('http://localhost:8811/index.html?sim=-38.5,152.0&alt=15000&trk=090&gs=120'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(500);
  await p.evaluate(t=>{ nbLoad(t); },j.text);
  // record where each label is drawn: the fillText calls whose text is a SIGMET name
  await p.evaluate(()=>{ const g=$('map').getContext('2d'), f=g.fillText.bind(g); window.__lab=[]; g.fillText=(t,x,y,...r)=>{ if(/^(SIGMET|AIRMET)\b/.test(t)) __lab.push({t,x,y}); return f(t,x,y,...r); }; });
  const pip=(sp,x,y)=>{ let c=false; for(let i=0,j=sp.length-1;i<sp.length;j=i++){ const [xi,yi]=sp[i],[xj,yj]=sp[j]; if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi) c=!c; } return c; };
  let n=0, bad=0, views=0, oldOut=0;
  for(const [la,lo,rg] of [[-38.5,152.0,320],[-30,150,320],[-35,148,160],[-25,140,320],[-38.5,152,80],[-33,152,160]]){
    const r=await p.evaluate(([la,lo,rg])=>{ $('simPos').value=la+','+lo; simApply(); MAP.range=rg; MAP.up='north'; MAP.pan=null; __lab=[]; render();
      const Z=sigCur().filter(z=>z.poly).map(z=>({name:z.name, sp:z.poly.map(q=>MAP.P(q[0],q[1]))}));
      // where the old rule (corners' average, kept on screen) put it
      const old=Z.map(z=>{ const xs=z.sp.map(q=>q[0]), ys=z.sp.map(q=>q[1]); return {name:z.name, x:Math.max(60,Math.min(MAP.W-60,xs.reduce((a,b)=>a+b,0)/xs.length)), y:Math.max(20,Math.min(MAP.H-20,ys.reduce((a,b)=>a+b,0)/ys.length)), vis:!(Math.max(...xs)<0||Math.max(...ys)<0||Math.min(...xs)>MAP.W||Math.min(...ys)>MAP.H)}; });
      return {Z, lab:__lab.slice(), old}; },[la,lo,rg]);
    views++;
    for(const l of r.lab){ const zs=r.Z.filter(q=>q.name===l.t); n++; if(!zs.some(z=>pip(z.sp,l.x,l.y))){ bad++; console.log("     outside:",la,lo,rg,l.t,Math.round(l.x),Math.round(l.y),zs.length,zs.map(z=>z.sp.length)); } }
    for(const o of r.old){ const z=r.Z.find(q=>q.name===o.name); if(o.vis&&z&&!pip(z.sp,o.x,o.y)) oldOut++; } }
  ok(n>=4&&bad===0,`${n} SIGMET/AIRMET labels drawn over ${views} views, all inside their polygon (the old rule put ${oldOut} outside)`);
  // a thin chevron band like the screenshot's (two arms ~50 px thick meeting at the top): too narrow for the label, so it goes
  // at the band's deepest point, on the band; the corners' average is in the empty middle
  const band=await p.evaluate(()=>{ const W=MAP.W, H=MAP.H, sp=[[-40,H*0.40],[W*0.40,H*0.10],[W+40,H*0.45],[W+40,H*0.53],[W*0.40,H*0.20],[-40,H*0.48]];
    const pip=(x,y)=>{ let c=false; for(let i=0,j=sp.length-1;i<sp.length;j=i++){ const [xi,yi]=sp[i],[xj,yj]=sp[j]; if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi) c=!c; } return c; };
    const full=sigLabelAt(sp,W,H,240,26), deep=sigLabelAt(sp,W,H,0,0,240,26), cx=sp.reduce((a,q)=>a+q[0],0)/6, cy=sp.reduce((a,q)=>a+q[1],0)/6;
    return {full, deep, deepIn:!!deep&&pip(deep[0],deep[1]), avgIn:pip(cx,cy)}; });
  ok(!band.full&&band.deepIn&&!band.avgIn,`thin band: the label doesn't fit, so it goes on the band at ${band.deep&&band.deep.map(Math.round)} (the old average was outside it)`);
  await p.evaluate(()=>{ $('simPos').value='-30,150'; simApply(); MAP.range=320; render(); }); const m=await p.$('#map'); await m.scrollIntoViewIfNeeded(); await m.screenshot({path:__dirname+'/siglab_map.png'});
  // TOT on a coast leg: the leg's end, not CSTn
  await p.evaluate(async()=>{ nbLoad(''); ls.set('coastOff',500); ls.set('coastGap',2); COAST.off=500; COAST.gap=2; $('simPos').value='-38.29,144.50'; $('simGs').value='90'; simApply();
    fpSet({name:'t',kind:'map',pts:[fpPt(findPoint('YBRS')),fpPt(findPoint('YMMB')),fpPt(findPoint('YTYA'))],i:1}); await fpCoastSet(FP.pts[FP.pts.findIndex(q=>q.c==='YMMB')],true); });
  const t=await p.evaluate(()=>{ const k=FP.pts.findIndex(q=>q.cg)+20; fpPick(k); const q=FP.pts[k]; $('simPos').value=q.la.toFixed(5)+','+(q.lo-0.01).toFixed(5); simApply(); render();
    const y=FP.pts.findIndex(q=>q.c==='YMMB'), pe=planEtaTo(DATA.ap.find(a=>a.i==='YMMB'));
    return {act:FP.pts[FP.i].n||FP.pts[FP.i].c, tot:$('nTotS').textContent, totV:$('nTotV').textContent, dest:$('nTotD').textContent, to:$('nToS').textContent, exp:pe&&hhmmZ(pe.t)}; });
  console.log('     active '+t.act+' · TOT '+t.totV+' '+t.tot+' · dest '+t.dest+' · →HDG '+t.to);
  ok(/^YMMB /.test(t.tot)&&t.totV===t.exp,`TOT names the coast leg's end (YMMB) at the time along the route (${t.totV}, expected ${t.exp})`);
  ok(/^CST\d+/.test(t.to),'→HDG still steers to the turn point ('+t.to.split(' ')[0]+')');
  ok(/^YTYA \d{4}Z/.test(t.dest),'the destination line stays: '+t.dest);
  console.log(fail.length? fail.length+' FAILED':'all passed'); console.log(errs); await b.close(); process.exit(fail.length?1:0); })();
