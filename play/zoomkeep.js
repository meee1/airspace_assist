// Chart tiles arriving are drawn into the chart picture where they go (not a whole new picture each time), and the result
// is the same as a picture built from scratch; while zooming (range changes in quick succession) the terrain and chart
// pictures are kept, stretched, and rebuilt once when it stops. Desktop-sized map, CPU x4.
const {chromium}=require('playwright'); const fs=require('fs');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:1600,height:900},deviceScaleFactor:1});
 await ctx.addInitScript(()=>{ try{ for(const [k,v] of [['rc_fsMap','true'],['rc_mapUp','"north"'],['rc_mapTer','false'],['rc_mapCtaf','false']]) localStorage.setItem(k,v); }catch(e){} });
 const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'&&CH.site.length>0,{timeout:30000});
 await p.evaluate(()=>{ ls.set('chartSel',CH.site.filter(s=>/ML-V/.test(s.sheet)).map(s=>s.sheet)); chartMerge(); CH.on=true; CH.op=1; MAP.range=20; render(); });
 const idle=async()=>{ for(let i=0;i<40;i++){ await p.waitForTimeout(250); if(!(await p.evaluate(()=>[...CH.imgs.values()].includes('loading')))) break; } await p.waitForTimeout(600); };
 await idle();
 // 1. tiles streaming in: clear them and let them come back
 const r1=await p.evaluate(async()=>{ const cib=window.createImageBitmap; window.createImageBitmap=(...x)=>new Promise(r=>setTimeout(r,200+Math.random()*1800)).then(()=>cib(...x));   // tiles arrive over 2 s, as from the network
   for(const v of CH.imgs.values()) if(v&&v.close) v.close(); CH.imgs.clear(); CHC.key=''; const n0=CHC.n, i0=CHC.ni; const t0=performance.now();
   drawMap(...MAP.last); const ms=[]; for(let k=0;k<80;k++){ await new Promise(r=>setTimeout(r,60)); const t=performance.now(); drawMap(...MAP.last); ms.push(performance.now()-t); if(![...CH.imgs.values()].includes('loading')&&!CHC.dirty) break; } window.createImageBitmap=cib;
   const s=[...ms].sort((a,b)=>a-b); return {full:CHC.n-n0, inPlace:CHC.ni-i0, frames:ms.length, medianMs:+s[s.length>>1].toFixed(1), maxMs:+s[s.length-1].toFixed(1), tiles:CH.keep?CH.keep.size:0}; });
 console.log('tiles streaming in:', JSON.stringify(r1)); if(r1.full>2||r1.inPlace<3) errs.push('in place '+JSON.stringify(r1));
 // same picture as from scratch? (pixels of the chart picture: incremental vs full rebuild)
 const cmp=await p.evaluate(()=>{ const grab=()=>{ const c=CHC.cv, x=c.getContext('2d').getImageData(0,0,c.width,c.height).data; return x; };
   const a=grab(), W_=CHC.cv.width, dc=CHC.dc, boxes=new Map(CHC.boxes); CHC.key=''; drawMap(...MAP.last); const b_=grab(); let diff=0, big=0, bb=[1e9,1e9,-1,-1]; for(let i=0;i<a.length;i+=4){ const d=Math.abs(a[i]-b_[i])+Math.abs(a[i+1]-b_[i+1])+Math.abs(a[i+2]-b_[i+2])+Math.abs(a[i+3]-b_[i+3]); if(d>0) diff++; if(d>60){ big++; const x=(i/4)%W_, y=Math.floor(i/4/W_); bb=[Math.min(bb[0],x),Math.min(bb[1],y),Math.max(bb[2],x),Math.max(bb[3],y)]; } }
   const B=bb.map(v=>v/dc), hit=big? [...boxes].filter(([k,b])=>!(b[2]<B[0]||b[0]>B[2]||b[3]<B[1]||b[1]>B[3])).map(([k,b])=>k+':'+(CH.imgs.get(k) instanceof ImageBitmap?'img':String(CH.imgs.get(k)))) : [];
   return {px:a.length/4, differ:diff, differMuch:big, where:big?B.map(Math.round):null, keys:hit.slice(0,12), log:(window.__chlog||[]).slice(-12)}; });
 console.log('tile by tile vs from scratch:', JSON.stringify(cmp)); if(cmp.differMuch>cmp.px*0.001) errs.push('pictures differ '+JSON.stringify(cmp));
 // 2. zooming with terrain and charts on (CPU x4): a pinch's worth of range changes 30 ms apart
 const cdp=await ctx.newCDPSession(p); await p.evaluate(()=>{ MAP.ter=true; render(); }); await p.waitForTimeout(800); await idle();
 await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 const r2=await p.evaluate(async()=>{ const n0=TRC.n, c0=CHC.n, ms=[]; for(let k=0;k<12;k++){ MAP.gestT=performance.now(); MAP.range=20*Math.pow(1.06,k); const t=performance.now(); drawMap(...MAP.last); ms.push(+(performance.now()-t).toFixed(0)); await new Promise(r=>setTimeout(r,30)); }
   const mid={ter:TRC.n-n0, ch:CHC.n-c0}; await new Promise(r=>setTimeout(r,700)); return {ms, rebuiltWhileZooming:mid, rebuiltAfter:{ter:TRC.n-n0, ch:CHC.n-c0}, zooming:MAP.zooming}; });
 await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
 console.log('zooming, 12 steps 30 ms apart (ms per frame):', JSON.stringify(r2));
 if(r2.rebuiltWhileZooming.ter>1||r2.rebuiltWhileZooming.ch>2||r2.rebuiltAfter.ter<r2.rebuiltWhileZooming.ter+1||r2.zooming) errs.push('zoom '+JSON.stringify(r2));
 // a single range change still rebuilds at once
 await p.waitForTimeout(500); const r3=await p.evaluate(()=>{ const n0=TRC.n; MAP.range=30; drawMap(...MAP.last); return TRC.n-n0; }); console.log('one range change: terrain rebuilt', r3); if(r3!==1) errs.push('single change '+r3);
 console.log(errs); await b.close(); })();
