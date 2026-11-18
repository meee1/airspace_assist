// Nav row: HDG, →HDG (wind-corrected), GS, TOT for the next point and the destination (18 Nov 2026).
// node play/navtiles.js   (app served on :8811)
const {chromium}=require('playwright'); const {PX9,TAB}=require('./px9.js');
(async()=>{ const b=await chromium.launch(), errs=[], fail=[]; const ok=(c,m)=>{ console.log((c?'ok   ':'FAIL ')+m); if(!c) fail.push(m); };
  const T=id=>`$('${id}').textContent`;
  const ctx=await b.newContext(PX9); const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8811/index.html?sim=-38.10,144.60&alt=1500&trk=090&gs=90'); await p.waitForFunction(()=>typeof render==='function'&&st.pos);
  await p.waitForTimeout(400);
  let r=await p.evaluate(()=>({h:$('nHdgV').textContent, hs:$('nHdgS').textContent, gs:$('nGsV').textContent, to:$('nToV').textContent, tos:$('nToS').textContent}));
  ok(r.h!=='—'&&/sim/.test(r.hs)&&r.gs==='90'&&r.to==='—','no target: HDG '+r.h+' ('+r.hs+'), GS '+r.gs+', →HDG '+r.to+' ('+r.tos+')');
  // a plan: YBRS round trip, active point CARR
  await p.setInputFiles('#fpFile',__dirname+'/fixtures/ybrs.gpx'); await p.waitForFunction(()=>FP&&FP.pts.length>5);
  await p.evaluate(()=>{ fpPick(FP.pts.findIndex(q=>q.c==='CARR')); render(); }); await p.waitForTimeout(300);
  r=await p.evaluate(()=>({plan:$('sPlan').textContent, to:$('nToV').textContent, tos:$('nToS').textContent, tod:$('nToD').textContent, tot:$('nTotV').textContent, tots:$('nTotS').textContent, totd:$('nTotD').textContent,
    exp:(()=>{ const q=FP.pts[FP.i], [d]=distBrg(st.pos[0],st.pos[1],q.la,q.lo); return {z:hhmmZ(Date.now()+d/90*3600e3), d}; })()}));
  ok(r.to===r.plan&&/CARR/.test(r.tos)&&/no wind/.test(r.tos),'no wind: →HDG = PLAN '+r.plan+' ('+r.tos+')');
  ok(r.tot===r.exp.z&&/CARR \d+ min/.test(r.tots),'TOT CARR '+r.tot+' ('+r.tots+'), expected '+r.exp.z);
  ok(/^YBRS \d{3} · \d+ NM$/.test(r.tod)&&/^YBRS \d{4}Z · \d/.test(r.totd),'destination lines: '+r.tod+' | '+r.totd);
  // wind entered in Plan check: 270/20 at TAS 90, flying east -> tailwind, a crosswind correction toward CARR
  await p.evaluate(()=>{ ls.set('pcWsrc','set'); ls.set('pcWind',{dir:270,kt:20}); ls.set('pcGs',90); render(); }); await p.waitForTimeout(200);
  r=await p.evaluate(()=>{ const q=FP.pts[FP.i], [d,b]=distBrg(st.pos[0],st.pos[1],q.la,q.lo), tri=windTri(b,90,270,20), v=variation(st.pos[0],st.pos[1]);
    return {to:$('nToV').textContent, tos:$('nToS').textContent, gss:$('nGsS').textContent, exp:fmt3(tri.hdg-v), wca:tri.wca}; });
  ok(r.to===r.exp&&/WCA [LR]\d+°/.test(r.tos),'wind 270/20: →HDG '+r.to+' (expected '+r.exp+', '+r.tos+')');
  ok(/^TW 20$/.test(r.gss),'GS line: '+r.gss+' (tailwind flying 090 in a westerly)');
  // GPS wind estimate wins over the entered one
  await p.evaluate(()=>{ WIND.est={from:0,spd:15,tas:100,rms:1,t:Date.now()}; render(); });
  r=await p.evaluate(()=>{ const c=15*Math.cos((0-st.trk)*R); return {gss:$('nGsS').textContent, exp:(c>=0?'HW ':'TW ')+Math.round(Math.abs(c)), title:$('nTo').title}; });   // the sim's 090 is magnetic: the true track is ~102
  ok(r.gss===r.exp&&/\(GPS\)/.test(r.title),'GPS wind used: '+r.gss+' (expected '+r.exp+') | '+r.title.slice(0,90));
  await p.evaluate(()=>{ WIND.est=null; ls.set('pcWsrc','none'); render(); });
  // tiles off in Options: the row goes when all four are off
  await p.evaluate(()=>{ ls.set('tilesOff',['nhdg','nto']); tilesLayout(); });
  r=await p.evaluate(()=>({row:getComputedStyle($('sNav')).display, h:getComputedStyle($('nHdg')).display, g:getComputedStyle($('nGs')).display}));
  ok(r.row!=='none'&&r.h==='none'&&r.g!=='none','two off: '+JSON.stringify(r));
  await p.evaluate(()=>{ ls.set('tilesOff',['nhdg','nto','ngs','ntot']); tilesLayout(); }); ok(await p.evaluate(()=>getComputedStyle($('sNav')).display==='none'),'all four off: row hidden');
  await p.evaluate(()=>{ ls.set('tilesOff',[]); tilesLayout(); });
  await p.locator('.wrap>.status').screenshot({path:__dirname+'/navtiles_classic.png'});
  ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'classic: no sideways scroll');
  await ctx.close();
  // full screen phone, narrow phone, tablet
  for(const [n,prof,w] of [['phone',PX9,null],['se',{...PX9,viewport:{width:375,height:667},screen:{width:375,height:667}},375],['tab',TAB,null]]){
    const c=await b.newContext({...prof,storageState:{cookies:[],origins:[{origin:'http://localhost:8811',localStorage:[{name:'rc_fsMap',value:'true'}]}]}}); const q=await c.newPage(); q.on('pageerror',e=>errs.push(e.message));
    await q.goto('http://localhost:8811/index.html?sim=-38.10,144.60&alt=1500&trk=090&gs=90'); await q.waitForFunction(()=>typeof render==='function'&&st.pos);
    await q.setInputFiles('#fpFile',__dirname+'/fixtures/ybrs.gpx'); await q.waitForFunction(()=>FP&&FP.pts.length>5); await q.evaluate(()=>{ fpPick(FP.pts.findIndex(x=>x.c==='CARR')); render(); }); await q.waitForTimeout(500);
    const z=await q.evaluate(()=>({par:$('sNav').parentElement.id||$('sNav').parentElement.className, w:document.documentElement.scrollWidth, iw:innerWidth, cells:[...document.querySelectorAll('#sNav>.st')].map(e=>Math.round(e.getBoundingClientRect().width))}));
    ok(z.w<=z.iw&&z.cells.every(x=>x>40),`${n}: row in ${z.par}, cells ${z.cells.join('/')} px, no sideways scroll`);
    await q.screenshot({path:__dirname+`/navtiles_${n}.png`}); await c.close(); }
  console.log(fail.length? fail.length+' FAILED':'all passed'); console.log(errs); await b.close(); process.exit(fail.length?1:0); })();
