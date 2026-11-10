// Map drawing cost by layer, for deciding where WebGL would pay. CPU x4 (phone-like), full-screen map at Pixel 9 and
// Michael's tablet size. For each layer set and range, three kinds of frame:
//   fly  : the 1 Hz update while flying (position moves a little, the chart/terrain caches are reused)
//   pan  : a drag frame (the view moves; caches reused until the view leaves them, then rebuilt)
//   zoom : the range changes every frame (every cache rebuilt: the worst case)
// Per frame: js = drawMap's own time (what the render timing panel shows), ras = a 1-pixel read of the map straight after,
// which makes Chrome paint everything drawMap queued up (canvas drawing is recorded and painted later, so js alone hides it).
// Satellite tiles come from a stand-in proxy (chart JPEGs, CORS) so the canvas stays readable.
//   node play/perfbench.js [px9|tab] [rate] [set name regex] [ranges, e.g. 10,40]   prints a table; writes play/perfbench_<dev>.json
const {chromium}=require('playwright'); const {PX9,TAB}=require('./px9.js'); const fs=require('fs'), path=require('path');
const DEV=process.argv[2]||'px9', RATE=+(process.argv[3]||4), ONLY=process.argv[4]||'', RG=process.argv[5]?process.argv[5].split(',').map(Number):null;
const JPG=[]; (function walk(d){ for(const f of fs.readdirSync(d)){ const q=path.join(d,f); if(fs.statSync(q).isDirectory()) walk(q); else if(f.endsWith('.jpg')&&JPG.length<64) JPG.push(fs.readFileSync(q)); } })(path.join(__dirname,'../dist/charts/ML-VNC-26NOV2026/1'));
const SETS=[['vectors',{}],['charts',{ch:1}],['terrain',{ter:1}],['sat',{sat:1}],['sat 0.25',{sat:1,op:.25}],['charts+ter',{ch:1,ter:1}]];
const RANGES=[10,40,320];   // overridden by the 5th argument
(async()=>{ const b=await chromium.launch(); const prof=DEV==='tab'?TAB:PX9;
 const ctx=await b.newContext({...prof, storageState:undefined}); let n=0;
 await ctx.route(/^http:\/\/satproxy\.test\/tile\//,r=>r.fulfill({status:200,contentType:'image/jpeg',headers:{'Access-Control-Allow-Origin':'*'},body:JPG[(n++)%JPG.length]}));
 await ctx.addInitScript(()=>{ try{ for(const [k,v] of [['rc_fsMap','true'],['rc_notamUrl','"http://satproxy.test"'],['rc_mapTraffic','false'],['rc_mapUp','"trk"'],['rc_perfOn','true'],['rc_perfMin','true']]) localStorage.setItem(k,v); }catch(e){} });
 const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=-37.85,145.1&alt=1500&trk=045&gs=0'); await p.waitForFunction(()=>typeof render==='function'&&CH.site.length>0,{timeout:30000});
 await p.evaluate(()=>{ ls.set('chartSel',CH.site.filter(s=>/ML-V|WAC-34|WAC-35/.test(s.sheet)).map(s=>s.sheet)); chartMerge(); });
 const info=await p.evaluate(()=>({canvas:$('map').width+'x'+$('map').height, dpr:devicePixelRatio, fs:document.body.className, sheets:CH.idx.length}));
 console.log(DEV, JSON.stringify(info), 'CPU x'+RATE);
 const cdp=await ctx.newCDPSession(p); const out=[];
 for(const [nm,o] of SETS.filter(s=>!ONLY||new RegExp(ONLY).test(s[0]))) for(const rg of (RG||RANGES)){
  await p.evaluate(([o,rg])=>{ CH.on=!!o.ch; CH.op=.7; MAP.ter=!!o.ter; SAT.on=!!o.sat; SAT.op=o.op||1; RAD.on=false; MAP.ctaf=true; MAP.range=rg; MAP.pan=null; CHC.key=''; render(); },[o,rg]);
  // let tiles load (no throttle), then warm up
  for(let i=0;i<20;i++){ await p.waitForTimeout(600); const busy=await p.evaluate(()=>[...CH.imgs.values()].includes('loading')||[...SAT.img.values()].some(t=>!t.ok&&!t.bad)||TER.busy.size>TER.tiles.size); if(!busy) break; await p.evaluate(()=>render()); }
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:RATE});
  const r=await p.evaluate(async rg=>{ const map=$('map'), g=map.getContext('2d'), sleep=t=>new Promise(r=>setTimeout(r,t));
    const meas=async(kind,step,N)=>{ const js=[], ras=[], parts=new Map(); const before=CHC.n;
      for(let i=0;i<N;i++){ step(i); PF.st.clear(); const t0=performance.now(); drawMap(...MAP.last); const t1=performance.now(); g.getImageData(0,0,1,1); const t2=performance.now();
        js.push(t1-t0); ras.push(t2-t1); for(const s of PF.st.values()) if(s.tag==='map'&&s.name!=='TOTAL') parts.set(s.name,(parts.get(s.name)||0)+s.last); await sleep(30); }
      const med=a=>{ const s=[...a].sort((x,y)=>x-y); return s[Math.floor(s.length/2)]; }, p90=a=>{ const s=[...a].sort((x,y)=>x-y); return s[Math.floor(s.length*0.9)]; };
      const top=[...parts].sort((a,b)=>b[1]-a[1]).slice(0,4).map(([k,v])=>[k,+(v/N).toFixed(1)]);
      return {kind, js:+med(js).toFixed(1), ras:+med(ras).toFixed(1), tot:+med(js.map((x,i)=>x+ras[i])).toFixed(1), p90:+p90(js.map((x,i)=>x+ras[i])).toFixed(1), rebuilds:CHC.n-before, mesh:DCE.mesh, top}; };
    const L0=MAP.last.slice(); const res=[];
    res.push(await meas('fly',i=>{ MAP.last=[L0[0]+i*0.0003,L0[1]+i*0.0003,...L0.slice(2)]; },12));
    MAP.last=L0.slice(); const c0=[L0[0],L0[1]], d=rg/60/40;   // pan: about a fortieth of the range per frame, diagonally
    res.push(await meas('pan',i=>{ MAP.pan=[c0[0]-i*d*0.7,c0[1]+i*d]; },20)); MAP.pan=null;
    res.push(await meas('zoom',i=>{ MAP.range= i%2? rg : rg*1.25; },8)); MAP.range=rg;
    return res; },rg);
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
  for(const x of r){ out.push({set:nm,range:rg,...x}); console.log(`${nm.padEnd(11)} ${String(rg).padStart(3)} NM ${x.kind.padEnd(4)}  js ${String(x.js).padStart(6)}  paint ${String(x.ras).padStart(6)}  total ${String(x.tot).padStart(6)} (p90 ${String(x.p90).padStart(6)})  cache rebuilds ${x.rebuilds}${x.mesh?' mesh':''}  · ${x.top.map(t=>t[0]+' '+t[1]).join(', ')}`); }
 }
 fs.writeFileSync(path.join(__dirname,`perfbench_${DEV}.json`),JSON.stringify({dev:DEV,info,rate:RATE,out},null,1));
 console.log(errs); await b.close(); })();
