// Esri satellite underlay with tiles mocked (no network): placement vs a known point, rotation, key flow, credit
const {chromium}=require('playwright'); const {PX9}=require('./px9.js'); const zlib=require('zlib');
function png(w,h,fn){ const raw=Buffer.alloc((w*3+1)*h); for(let y=0;y<h;y++){ raw[y*(w*3+1)]=0; for(let x=0;x<w;x++){ const c=fn(x,y); raw.set(c,y*(w*3+1)+1+x*3); } }
  const crc=b=>{ let c,t=[];for(let n=0;n<256;n++){c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;} let r=0xffffffff; for(const x of b) r=t[(r^x)&255]^(r>>>8); return (r^0xffffffff)>>>0; };
  const ch=(ty,d)=>{ const l=Buffer.alloc(4); l.writeUInt32BE(d.length); const td=Buffer.concat([Buffer.from(ty),d]); const c=Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l,td,c]); };
  const ih=Buffer.alloc(13); ih.writeUInt32BE(w,0); ih.writeUInt32BE(h,4); ih[8]=8; ih[9]=2; return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),ch('IHDR',ih),ch('IDAT',zlib.deflateSync(raw)),ch('IEND',Buffer.alloc(0))]); }
// tile content: checker by tile parity + a black dot exactly at YMMB's lat/lon
const YM=[-37.93,145.18];
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext(PX9); let reqs=0;
 await ctx.route(/ibasemaps-api\.arcgis\.com|static-map-tiles-api\.arcgis\.com/,route=>{ const u=route.request().url(); reqs++;
   if(!/token=good/.test(u)) return route.fulfill({status:498,body:'invalid token'});
   const m=/tile\/(\d+)\/(\d+)\/(\d+)/.exec(u), z=+m[1], y=+m[2], x=+m[3], S=/static-map/.test(u)?512:256, n=2**z;
   const px=((YM[1]+180)/360*n-x)*S, r=YM[0]*Math.PI/180, py=((1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*n-y)*S;
   const base=(x+y)%2?[120,170,120]:[160,200,160];
   route.fulfill({status:200,contentType:'image/png',body:png(S,S,(i,j)=>Math.hypot(i-px,j-py)<5*S/256?[0,0,0]:(i<2||j<2)?[90,90,90]:base)}); });
 const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=045&gs=60'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(600);
 // no key: Sat opens Options at the key
 await p.click('#mapSat'); await p.waitForTimeout(400); console.log('no key -> options open', await p.evaluate(()=>$('optsDlg').open), 'focus', await p.evaluate(()=>document.activeElement.id));
 await p.fill('#satKey','bad'); await p.click('#satTest'); await p.waitForTimeout(800); console.log('check bad:', await p.textContent('#satStat'));
 await p.fill('#satKey','good'); await p.click('#satTest'); await p.waitForTimeout(800); console.log('check good:', await p.textContent('#satStat'));
 await p.dispatchEvent('#satKey','change'); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
 for(const [n,src,up,rng] of [['wi_north','wi','north',5],['wi_trk','wi','trk',5],['st_north','st','north',5],['wi_20','wi','north',20]]){
  await p.evaluate(([src,up,rng])=>{ SAT.src=src; ls.set('satSrc',src); CH.on=false; MAP.ter=false; MAP.ctaf=false; MAP.range=rng; MAP.up=up; MAP.pan=null; render(); },[src,up,rng]);
  await p.waitForTimeout(1500); await p.evaluate(()=>render()); await p.waitForTimeout(300);
  // where does the app put YMMB, and is the dot there?
  const r=await p.evaluate(([la,lo])=>{ const [x,y]=MAP.P(la,lo); return {x:Math.round(x),y:Math.round(y)}; },YM);
  console.log(n, JSON.stringify(r), 'on', await p.evaluate(()=>SAT.on), 'tiles', await p.evaluate(()=>SAT.img.size));
  await (await p.$('#map')).screenshot({path:`play/sat_${n}.png`}); }
 console.log('requests', reqs, errs); await b.close(); })();
