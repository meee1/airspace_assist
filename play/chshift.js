// Chart picture against the map after panning at 320 NM. The chart cache is drawn about its own centre; once the map has
// moved, one affine onto the map (as before 9 Nov 2026) is a few px out at 320 NM and the picture jumped when the cache
// was redrawn. drawCache switches to a grid of affines: its picture lines up with a freshly drawn one (offsets measured
// on 80 px patches at the corners and centre; a blank patch can read as any offset).
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({...PX9}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=3000&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(800);
 await p.evaluate(()=>{ ls.set('chartSel',CH.site.map(s=>s.sheet)); chartMerge(); MAP.up='north'; MAP.range=320; CH.on=true; MAP.ter=false; MAP.hide=new Set(['C','D','E','R','Q','FIA','VFR']); render(); });
 await p.waitForTimeout(9000); await p.evaluate(()=>{ CHC.key=''; render(); }); await p.waitForTimeout(3000);
 // only the chart layer: grab the cache drawing by drawing to a blank canvas
 const pic=(one)=>p.evaluate(one=>{ DCE.one=one; const c=document.createElement('canvas'); c.width=$('map').width; c.height=$('map').height; const g=c.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,c.width,c.height);
   drawCharts(g,MAP.W,MAP.H,MAP.inv,MAP.P); DCE.one=false; return Array.from(g.getImageData(0,0,c.width,c.height).data); },one);
 const W_=await p.evaluate(()=>$('map').width), H_=await p.evaluate(()=>$('map').height);
 const shift=(A,B)=>{ const out=[]; for(const [qx,qy] of [[0.08,0.08],[0.92,0.08],[0.08,0.92],[0.92,0.92],[0.5,0.5]]){ const x0=Math.round(qx*W_)-40, y0=Math.round(qy*H_)-40; let best=null;
   for(let sy=-6;sy<=6;sy++) for(let sx=-6;sx<=6;sx++){ let s=0; for(let y=0;y<80;y+=2) for(let x=0;x<80;x+=2){ const i=((y0+y)*W_+(x0+x))*4, j=((y0+y+sy)*W_+(x0+x+sx))*4; if(j<0||j>=B.length) continue; s+=Math.abs(A[i]-B[j])+Math.abs(A[i+1]-B[j+1])+Math.abs(A[i+2]-B[j+2]); } if(!best||s<best.s) best={s,sx,sy}; }
   out.push(Math.hypot(best.sx,best.sy).toFixed(1)); } return out.join('/')+' px'; };
 const cmp=(A,B)=>{ let n=0,s=0; for(let i=0;i<A.length;i+=4){ const d=Math.abs(A[i]-B[i])+Math.abs(A[i+1]-B[i+1])+Math.abs(A[i+2]-B[i+2]); s+=d; if(d>60) n++; } return `${(n/(A.length/4)*100).toFixed(2)}% px differ, mean ${ (s/(A.length/4)).toFixed(1)}`; };
 for(const d of [80]){
   await p.evaluate(d=>{ MAP.pan=null; render(); CHC.key=''; render(); const c=MAP.inv(MAP.cx-d,MAP.cy-d/2); MAP.pan=c; render(); },d); await p.waitForTimeout(200);
   const n0=await p.evaluate(()=>CHC.n), err=await p.evaluate(()=>+DCE.err.toFixed(1));
   const one=await pic(true), grid=await pic(false); const reused=await p.evaluate(n0=>CHC.n===n0,n0);
   await p.evaluate(()=>{ CHC.key=''; }); const fresh=await pic(false);
   console.log(`pan ${d} px: reused ${reused} · affine err ${err} px · offset from fresh (corners/centre, device px) one affine ${shift(one,fresh)} · grid ${shift(grid,fresh)}`); }
 await p.evaluate(()=>{ MAP.pan=null; MAP.range=20; CHC.key=''; render(); MAP.pan=MAP.inv(MAP.cx-40,MAP.cy); render(); });
 console.log('at 20 NM after a pan: one affine', await p.evaluate(()=>+DCE.err.toFixed(2)), 'px out · grid used', await p.evaluate(()=>DCE.mesh));
 console.log(errs); await b.close(); })();
