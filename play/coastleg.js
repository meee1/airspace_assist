// Coast legs: in Edit, ≈ on a leg makes it follow the coast a set distance off the shore with hops over open water up to a
// set gap (turn points CST1… go into the plan), ≈ again makes it direct; new settings redo every coast leg. Checked against
// the tiles with an independent point-to-polygon distance (not the app's grid): between the end joins the route stays over
// water at least half the offset off and mostly near the offset; with no hops allowed the route can't cross the Rip. No
// tiles -> a clear message. Needs app/coast/ (tools/coast.py).
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); require('./classic.js')(b); const ctx=await b.newContext({...PX9,serviceWorkers:'block'}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));   // no service worker: the offline check below can block the tiles
 await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(500);
 await p.evaluate(()=>{ ls.set('coastOff',500); ls.set('coastGap',2); COAST.off=500; COAST.gap=2; $('fpCoastOff').value='500'; $('fpCoastGap').value='2'; fpSet({name:'Bay',kind:'map',pts:[fpPt(findPoint('YMMB')),fpPt(findPoint('YBRS'))],i:1}); FP_EDIT=true; render(); });
 await p.waitForTimeout(300);
 // independent check: distance from a point to the nearest land, from the tile polygons (point in polygon, else nearest edge)
 const far=()=>p.evaluate(async()=>{ await coastIndex(); const names=new Set(); for(const q of FP.pts){ for(let a=-1;a<=1;a++) for(let o=-1;o<=1;o++) names.add(tName(Math.floor(q.la)+a,Math.floor(q.lo)+o)); }
   const rings=[]; for(const n of names){ if(!COAST.c.has(n)) continue; for(const poly of await coastTile(n)) for(const r of poly){ const pts=[]; let x=r[0],y=r[1]; pts.push([x/1e4,y/1e4]); for(let k=2;k<r.length;k+=2){ x+=r[k]; y+=r[k+1]; pts.push([x/1e4,y/1e4]); } rings.push(pts); } }
   const cl=Math.cos(FP.pts[0].la*Math.PI/180);
   const dLand=(la,lo)=>{ let inside=false; for(const r of rings){ for(let i=0,j=r.length-1;i<r.length;j=i++){ const [xi,yi]=r[i],[xj,yj]=r[j]; if((yi>la)!==(yj>la)&&lo<(xj-xi)*(la-yi)/(yj-yi)+xi) inside=!inside; } }
     if(inside) return 0; let m=1e9; for(const r of rings) for(let i=0,j=r.length-1;i<r.length;j=i++){ const ax=(r[j][0]-lo)*cl*60, ay=(r[j][1]-la)*60, bx=(r[i][0]-lo)*cl*60, by=(r[i][1]-la)*60, dx=bx-ax, dy=by-ay, L=dx*dx+dy*dy, t=L? Math.max(0,Math.min(1,-(ax*dx+ay*dy)/L)) : 0; m=Math.min(m,Math.hypot(ax+t*dx,ay+t*dy)); } return m; };
   let D=0, ds=[], hop=0; for(let k=1;k<FP.pts.length;k++){ const a=FP.pts[k-1], q=FP.pts[k], L=distBrg(a.la,a.lo,q.la,q.lo)[0]; D+=L; if(k===1||k===FP.pts.length-1) continue; const n=Math.ceil(L/0.02);
     let run=0; for(let s=0;s<=n;s++){ const la=a.la+(q.la-a.la)*s/n, lo=a.lo+(q.lo-a.lo)*s/n, d=dLand(la,lo)*6076; ds.push(d); run= d>2000? run+L/n : 0; hop=Math.max(hop,run); } }
   ds.sort((x,y)=>x-y); const q_=f=>ds.length? Math.round(ds[Math.floor((ds.length-1)*f)]) : null;
   return {pts:FP.pts.length, D:+D.toFixed(1), minFt:q_(0), medFt:q_(0.5), p90Ft:q_(0.9), farRunNm:+hop.toFixed(2)}; });
 console.log('direct:', JSON.stringify(await far()));
 const t0=Date.now(); await p.click('#fpLegs li[data-k="1"] [data-a="cst"]'); await p.waitForFunction(()=>FP.pts.length>2||/No /.test($('fpCoastStat').textContent),undefined,{timeout:20000});
 const r1=await far(); console.log('500 ft, 2 NM hops:', JSON.stringify(r1), Date.now()-t0, 'ms ·', await p.textContent('#fpCoastStat'));
 if(!(r1.minFt>=375)) errs.push('500 ft leg comes within '+r1.minFt+' ft of land'); if(!(r1.medFt>450&&r1.medFt<650)) errs.push('500 ft leg median '+r1.medFt+' ft off');
 if(!(r1.farRunNm>0.8&&r1.farRunNm<=2.05)) errs.push('no hop across the Rip (longest stretch over 2000 ft from land: '+r1.farRunNm+' NM)');
 const act=await p.evaluate(()=>FP.pts[FP.i].n); console.log('  active:', act); if(act!=='CST1') errs.push('flying the leg: active should be CST1, is '+act);
 console.log('  list:', await p.evaluate(()=>FP.pts.map(q=>(q.c||q.n)+(q.via?'['+q.via+']':'')+(q.cg?'*':'')).join(' ')));
 await (await p.$('#map')).scrollIntoViewIfNeeded(); await p.evaluate(()=>{ MAP.range=20; MAP.up='north'; MAP.pan=[-38.2,144.75]; CH.on=false; render(); }); await p.waitForTimeout(400);
 await (await p.$('.mapwrap')).screenshot({path:'play/coastleg_map.png'});
 await (await p.$('#fpBox')).screenshot({path:'play/coastleg_list.png'});
 // 1,000 ft off
 await p.selectOption('#fpCoastOff','1000'); await p.waitForFunction(()=>FP.pts.find(q=>q.via==='coast')?.coff===1000,undefined,{timeout:30000});
 const r2=await far(); console.log('1000 ft, 2 NM hops:', JSON.stringify(r2), '·', await p.textContent('#fpCoastStat')); if(!(r2.minFt>=750&&r2.medFt>900&&r2.medFt<1300)) errs.push('1000 ft leg: '+JSON.stringify(r2));
 // no hops: the line follows the coast in and out of every inlet (the Rip is wide enough to stay on the line through), longer
 await p.selectOption('#fpCoastGap','0'); await p.waitForFunction(()=>FP.pts.find(q=>q.via==='coast')?.cgap===0||/No coast route/.test($('fpCoastStat').textContent),undefined,{timeout:60000});
 const r4=await far(); console.log('1000 ft, no hops:', JSON.stringify(r4), '·', await p.textContent('#fpCoastStat')); if(!(r4.D>r2.D+3&&r4.minFt>=750)) errs.push('no hops: '+JSON.stringify(r4));
 await p.selectOption('#fpCoastGap','2'); await p.selectOption('#fpCoastOff','500'); await p.waitForFunction(()=>FP.pts.find(q=>q.via==='coast')?.coff===500&&FP.pts.find(q=>q.via==='coast')?.cgap===2,undefined,{timeout:60000});
 // share link: the coast flag and the leg's settings, not the turn points; opening it works the leg out again with the
 // link's settings (here 500 ft / 2 NM, while the phone that opens it is set to 300 ft / no hops)
 const link=await p.evaluate(()=>planLink(FP.name,FP.pts)), arr=await p.evaluate(l=>JSON.parse(new TextDecoder().decode(b64u.dec(l.split('#plan=')[1]))),link);
 console.log('share link:', link.length, 'chars', JSON.stringify(arr)); if(arr[2].length!==2||JSON.stringify(arr[2][1][6])!=='[500,2]') errs.push('share link: '+JSON.stringify(arr));
 { const p2=await ctx.newPage(); p2.on('pageerror',e=>errs.push(e.message)); p2.on('dialog',d=>{ console.log('  confirm:', d.message().replace(/\n+/g,' | ')); d.accept(); });
   await p2.addInitScript(()=>{ try{ localStorage.setItem('rc_coastOff','300'); localStorage.setItem('rc_coastGap','0'); }catch(e){} });
   await p2.goto(link.replace(/^[^#]*/,'http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=000&gs=0'));
   await p2.waitForFunction(()=>typeof FP!=='undefined'&&FP&&FP.pts.some(q=>q.cg),undefined,{timeout:30000});
   const got=await p2.evaluate(()=>{ const e=FP.pts.find(q=>q.via==='coast'); return {n:FP.pts.length, off:e.coff, gap:e.cgap, settings:[COAST.off,COAST.gap], route:fplRoute(FP.pts)}; });
   console.log('  opened:', JSON.stringify(got)); if(got.off!==500||got.gap!==2||got.n<50) errs.push('opened link: '+JSON.stringify(got)); await p2.close(); }
 // reversed (the Reverse button, and a saved plan loaded backwards): the coast flag moves to the new end, the turn points run
 // the other way and are renumbered; Reverse twice gives the plan back
 { const before=await p.evaluate(()=>JSON.stringify(FP.pts.map(q=>[q.n,q.la,q.lo,q.via||'',q.cg||'']))); await p.click('#fpRev'); await p.waitForTimeout(200);
   const r=await p.evaluate(()=>{ const P=FP.pts, e=P[P.length-1], k=P.findIndex(q=>q.via==='coast'); return {first:P[0].c||P[0].n, last:e.c||e.n, coastAt:k, n:P.length, cst1:P[1].n, desc:P[1].desc, cstLast:P[P.length-2].n, firstVia:P[0].via||'', share:JSON.stringify(JSON.parse(new TextDecoder().decode(b64u.dec(planEncode('r',P))))[2])}; });
   console.log('reversed:', JSON.stringify(r));
   if(r.first!=='YBRS'||r.last!=='YMMB'||r.coastAt!==r.n-1||r.cst1!=='CST1'||r.cstLast!=='CST'+(r.n-2)||!/to YMMB/.test(r.desc)||r.firstVia) errs.push('reversed: '+JSON.stringify(r));
   await p.click('#fpRev'); await p.waitForTimeout(200); const back=await p.evaluate(()=>JSON.stringify(FP.pts.map(q=>[q.n,q.la,q.lo,q.via||'',q.cg||''])));
   if(back!==before) errs.push('reverse twice differs'); else console.log('reverse twice: same plan');
   const sv=await p.evaluate(()=>{ fplSaveCur('Bay coast'); const id=PLANS.find(x=>x.name==='Bay coast').id; fplLoad(id,true); const P=FP.pts; return [P[0].c, P[P.length-1].c, P[P.length-1].via, P.filter(q=>q.cg).length]; });
   console.log('saved plan loaded backwards:', JSON.stringify(sv)); if(sv[0]!=='YBRS'||sv[2]!=='coast') errs.push('fplLoad rev: '+JSON.stringify(sv));
   await p.evaluate(()=>{ const id=PLANS.find(x=>x.name==='Bay coast').id; fplLoad(id,false); FP_EDIT=true; render(); }); }
 // back to direct
 await p.click('#fpLegs li[data-k="'+(await p.evaluate(()=>FP.pts.length-1))+'"] [data-a="cst"]'); await p.waitForTimeout(300);
 console.log('direct again:', await p.evaluate(()=>FP.pts.map(q=>q.c||q.n).join(' ')+' via '+(FP.pts[1].via||'direct')));
 // deleting the end of a coast leg removes its turn points
 await p.evaluate(()=>{ fpSet({name:'x',kind:'map',pts:[fpPt(findPoint('YMMB')),fpPt(findPoint('YBRS')),fpPt(findPoint('YAPO'))],i:1}); FP_EDIT=true; render(); });
 await p.click('#fpLegs li[data-k="1"] [data-a="cst"]'); await p.waitForFunction(()=>FP.pts.length>3,undefined,{timeout:20000});
 const n0=await p.evaluate(()=>FP.pts.length); const kEnd=await p.evaluate(()=>FP.pts.findIndex(q=>q.via==='coast'));
 await p.click(`#fpLegs li[data-k="${kEnd}"] [data-a="del"]`); await p.waitForTimeout(300);
 console.log('delete the coast leg\'s end:', n0, 'points ->', await p.evaluate(()=>FP.pts.map(q=>q.c||q.n).join(' ')));
 // no coastline data: a message, nothing changes
 await p.route('**/coast/**',r=>r.fulfill({status:404,body:''})); await p.evaluate(()=>{ COAST.idx=null; COAST.tiles.clear(); });
 await p.click('#fpLegs li[data-k="1"] [data-a="cst"]'); await p.waitForTimeout(800);
 console.log('offline:', await p.textContent('#fpCoastStat'), '·', await p.evaluate(()=>FP.pts.length));
 console.log(errs); await b.close(); })();
