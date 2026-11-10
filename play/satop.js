// Satellite opacity: tiles are a flat colour, drawn at a low opacity (Michael's phone had 0.25). Every tile edge overlaps its
// neighbour by a pixel (no hairline gaps), so if each tile is faded on its own the overlaps show as a lighter grid; the layer
// must be faded once, as a whole. Draws the satellite layer alone (on a clear canvas, as on the map), puts white under it and counts pixels that aren't the one
// faded colour (tiles come via a stand-in proxy with CORS, so the canvas can be read back).
const {chromium}=require('playwright'); const {PX9}=require('./px9.js'); const zlib=require('zlib');
function png(w,h,c){ const raw=Buffer.alloc((w*3+1)*h); for(let y=0;y<h;y++){ raw[y*(w*3+1)]=0; for(let x=0;x<w;x++) raw.set(c,y*(w*3+1)+1+x*3); }
  const crc=b=>{ let c,t=[];for(let n=0;n<256;n++){c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;} let r=0xffffffff; for(const x of b) r=t[(r^x)&255]^(r>>>8); return (r^0xffffffff)>>>0; };
  const ch=(ty,d)=>{ const l=Buffer.alloc(4); l.writeUInt32BE(d.length); const td=Buffer.concat([Buffer.from(ty),d]); const k=Buffer.alloc(4); k.writeUInt32BE(crc(td)); return Buffer.concat([l,td,k]); };
  const ih=Buffer.alloc(13); ih.writeUInt32BE(w,0); ih.writeUInt32BE(h,4); ih[8]=8; ih[9]=2; return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),ch('IHDR',ih),ch('IDAT',zlib.deflateSync(raw)),ch('IEND',Buffer.alloc(0))]); }
const TILE=png(256,256,[20,60,20]);
(async()=>{ const b=await chromium.launch(); require('./classic.js')(b); const ctx=await b.newContext(PX9);
 await ctx.route(/^http:\/\/satproxy\.test\/tile\//,r=>r.fulfill({status:200,contentType:'image/png',headers:{'Access-Control-Allow-Origin':'*'},body:TILE}));
 await ctx.addInitScript(()=>{ localStorage.setItem('rc_notamUrl','"http://satproxy.test"'); localStorage.setItem('rc_mapSat','true'); localStorage.setItem('rc_satOp','0.25'); });
 const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YBRS&alt=1500&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function');
 for(const [n,up,rng] of [['north5','north',5],['trk20','trk',20]]){
  await p.evaluate(([up,rng])=>{ CH.on=false; MAP.ter=false; MAP.ctaf=false; MAP.range=rng; MAP.up=up; MAP.pan=null; MAP.rings=false; render(); },[up,rng]);
  await p.waitForTimeout(1500); await p.evaluate(()=>render()); await p.waitForTimeout(400);
  await (await p.$('#map')).screenshot({path:`play/satop_${n}.png`});
  const r=await p.evaluate(()=>{ const m=$('map'), d=window.devicePixelRatio||1, W=m.clientWidth, H=m.clientHeight, c=document.createElement('canvas'); c.width=W*d; c.height=H*d;
    const g=c.getContext('2d'); g.setTransform(d,0,0,d,0,0);
    drawSat(g,W,H,MAP.P,MAP.inv,0,MAP.cosl,MAP.sc); g.setTransform(1,0,0,1,0,0); g.globalCompositeOperation='destination-over'; g.fillStyle='#fff'; g.fillRect(0,0,c.width,c.height);   // drawSat draws first on a clear map
    const px=g.getImageData(0,0,c.width,c.height-24*d).data, want=[255+(20-255)*SAT.op, 255+(60-255)*SAT.op, 255+(20-255)*SAT.op];
    let bad=0; for(let i=0;i<px.length;i+=4) if(Math.abs(px[i]-want[0])>3||Math.abs(px[i+1]-want[1])>3) bad++;
    return {op:SAT.op, tiles:SAT.img.size, offPx:bad, of:px.length/4}; });
  console.log(n, JSON.stringify(r)); if(r.offPx>0) errs.push(`${n}: ${r.offPx} satellite pixels not the faded tile colour (seams?)`); }

 console.log(errs); await b.close(); })();
