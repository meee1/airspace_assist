// CTAF layer cache (drawCtaf / CTC): the map with CTAF areas looks the same as the uncached build, it is rebuilt only when
// the view leaves the cached area or the scale changes, and the per-frame cost drops. Needs the previous build (no CTAF
// cache) served on :8813 for the comparison (see play/tercmp.js); without it only the new build is checked.
const {chromium}=require('playwright'); const {PX9}=require('./px9.js'); const http=require('http');
// share of pixels that differ by more than 8 and by more than 60 (any channel), compared in a page (no PNG library here)
async function cmp(b,A,B){ const p=await b.newPage(); const r=await p.evaluate(async([a,c])=>{ const ld=s=>new Promise(r=>{ const i=new Image(); i.onload=()=>r(i); i.src='data:image/png;base64,'+s; });
    const [x,y]=await Promise.all([ld(a),ld(c)]), cv=document.createElement('canvas'); cv.width=x.width; cv.height=x.height; const g=cv.getContext('2d');
    g.fillStyle='#fff'; g.fillRect(0,0,cv.width,cv.height); g.drawImage(x,0,0); const d1=g.getImageData(0,0,cv.width,cv.height).data; g.fillRect(0,0,cv.width,cv.height); g.drawImage(y,0,0); const d2=g.getImageData(0,0,cv.width,cv.height).data;
    // only the middle square: the old build picked aerodromes within 1.6× the range, which misses the top and bottom of a tall
    // phone screen (the cache covers its whole picture), so out there the new one rightly has more areas
    const W=cv.width, H=cv.height, y0=Math.max(0,Math.round(H/2-W/2)), y1=Math.min(H,Math.round(H/2+W/2)); let d=0,big=0,n=0;
    for(let i=y0*W*4;i<y1*W*4;i+=4){ n++; const m=Math.max(Math.abs(d1[i]-d2[i]),Math.abs(d1[i+1]-d2[i+1]),Math.abs(d1[i+2]-d2[i+2])); if(m>8) d++; if(m>60) big++; }
    return [d/n, big/n]; },[A.toString('base64'),B.toString('base64')]); await p.close(); return r; }
const up=port=>new Promise(r=>http.get(`http://localhost:${port}/index.html`,res=>{ res.resume(); r(res.statusCode===200); }).on('error',()=>r(false)));
const VIEWS=[['ymmb10',-37.976,145.102,10,'north',null],['ymmb40trk',-37.976,145.102,40,'trk',null],['ybrs25',-37.7,145.3,25,'north',null],['pan40',-37.976,145.102,40,'north',[-37.6,144.6]],['nsw60',-33.9,150.9,60,'north',null]];
async function shots(b,port){ const ctx=await b.newContext({...PX9,deviceScaleFactor:1}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.addInitScript(()=>{ try{ for(const [k,v] of [['rc_fsMap','true'],['rc_mapCtaf','true'],['rc_mapCharts','false'],['rc_mapTer','false'],['rc_mapTraffic','false'],['rc_mapSat','false']]) localStorage.setItem(k,v); }catch(e){} });
  await p.goto(`http://localhost:${port}/index.html?sim=YMMB&alt=1500&trk=045&gs=0`); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(600);
  // colours come from a palette assigned over the frequencies in reach, which is wider with the cache: fix them by frequency
  // so the comparison is about the shapes
  await p.evaluate(()=>{ window.ctafColour=f=>f==='126.7'?'hsl(210 12% 45%)':`hsl(${Math.round(parseFloat(f)*1000/5)%12*30} 72% 42%)`; if(typeof CTC!=='undefined') CTC.key=''; });
  const out={};
  for(const [n,la,lo,rg,upd,pan] of VIEWS){
    await p.evaluate(([la,lo,rg,upd,pan])=>{ $('simPos').value=la+','+lo; simApply(); MAP.range=rg; MAP.up=upd; MAP.pan=pan; CH.on=false; MAP.ter=false; render(); },[la,lo,rg,upd,pan]); await p.waitForTimeout(400);
    out[n]={png:Buffer.from((await p.evaluate(()=>$('map').toDataURL('image/png'))).split(',')[1],'base64'), leg:await p.textContent('#ctafLeg')}; }   // the map canvas alone (no tiles over it)
  await ctx.close(); return {out,errs}; }
(async()=>{ const b=await chromium.launch(); const errs=[];
  const N=await shots(b,8811); errs.push(...N.errs);
  // cache behaviour: rebuilds while flying and panning a little, and a zoom
  { const ctx=await b.newContext(PX9); const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
    await p.addInitScript(()=>{ try{ localStorage.setItem('rc_mapCtaf','true'); localStorage.setItem('rc_mapCharts','false'); localStorage.setItem('rc_perfOn','true'); }catch(e){} });
    await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=045&gs=0'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(600);
    const r=await p.evaluate(()=>{ MAP.range=40; MAP.pan=null; render(); const n0=CTC.n, L=MAP.last.slice(), t=[];
      for(let i=0;i<20;i++){ MAP.last=[L[0]+i*0.002,L[1]+i*0.002,...L.slice(2)]; const t0=performance.now(); drawMap(...MAP.last); t.push(performance.now()-t0); }
      const fly=CTC.n-n0; const n1=CTC.n; for(let i=0;i<20;i++){ MAP.pan=[L[0]-i*0.01,L[1]+i*0.01]; drawMap(...MAP.last); } const pan=CTC.n-n1;
      MAP.pan=null; MAP.last=L; const n2=CTC.n; MAP.range=20; drawMap(...MAP.last); const zoom=CTC.n-n2; MAP.range=40;
      const n3=CTC.n; ls.set('ctafSplit',false); drawMap(...MAP.last); const set=CTC.n-n3; ls.set('ctafSplit',true);
      t.sort((a,b)=>a-b); return {fly, pan, zoom, set, flyMs:+t[10].toFixed(1), cache:CTC.cv.width+'x'+CTC.cv.height}; });
    console.log('rebuilds: flying 20 steps (~2 NM)', r.fly, '· panning 20 steps (~12 NM)', r.pan, '· zoom', r.zoom, '· split setting', r.set, '· drawMap median', r.flyMs, 'ms · cache', r.cache);
    if(r.fly>0) errs.push('rebuilt while flying a short way'); if(r.zoom!==1||r.set!==1) errs.push('not rebuilt on zoom / setting change');
    await ctx.close(); }
  if(await up(8813)){ const O=await shots(b,8813);
    for(const n of Object.keys(N.out)){ const [d,big]=await cmp(b,N.out[n].png,O.out[n].png);
      const diff=`${(d*100).toFixed(2)}% px differ (>8), ${(big*100).toFixed(3)}% by a lot`; if(big>0.005) errs.push(n+': differs from the uncached build');   // edges: the cache is resampled, so 1-px outlines move a little
      require('fs').writeFileSync(`play/ctafcache_${n}_new.png`,N.out[n].png); require('fs').writeFileSync(`play/ctafcache_${n}_old.png`,O.out[n].png);
      console.log(n.padEnd(10), diff, '· legend', N.out[n].leg===O.out[n].leg? 'same' : `new "${N.out[n].leg}" old "${O.out[n].leg}"`); } }
  else console.log('no old build on :8813: comparison skipped');
  console.log(errs); await b.close(); })();
