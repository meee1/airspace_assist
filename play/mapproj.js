// Map projection: stereographic about the map centre. Aerodromes 30-380 NM from the centre sit on screen at their true
// great-circle bearing and distance (bearing 0°, distance within 0.2%); panning by drag keeps the dragged point under the
// finger; the old flat projection is still there (rc_mapProj 'flat') and is up to ~2.6° / 1.6% out at 380 NM.
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const errs=[];
 for(const mode of ['stereo','flat']){ const ctx=await b.newContext({...PX9}); if(mode==='flat') await ctx.addInitScript(()=>localStorage.setItem('rc_mapProj','"flat"'));
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=3000&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(600);
  const r=await p.evaluate(()=>{ MAP.range=320; MAP.up='north'; render(); const c=[MAP.last[0],MAP.last[1]]; let dMax=0, bMax=0;
    for(const i of ['YMAV','YBLT','YLTV','YMIA','YSSY','YMHB','YPAD']){ const a=DATA.ap.find(x=>x.i===i), [d,bg]=distBrg(c[0],c[1],a.la,a.lo), [x,y]=MAP.P(a.la,a.lo);
      const sd=Math.hypot(x-MAP.cx,y-MAP.cy)/MAP.sc, sb=(Math.atan2(x-MAP.cx,MAP.cy-y)*180/Math.PI+360)%360; dMax=Math.max(dMax,Math.abs(sd-d)/d*100); bMax=Math.max(bMax,Math.abs((((sb-bg)%360)+540)%360-180)); }
    const [la,lo]=MAP.inv(...MAP.P(-33.9,151.2)); return {proj:MAP.proj, dMax:+dMax.toFixed(2), bMax:+bMax.toFixed(2), roundTrip:+(Math.hypot(la+33.9,lo-151.2)*60*1852).toFixed(2)}; });
  console.log(mode, `projection ${r.proj} · worst distance error ${r.dMax}% · worst bearing error ${r.bMax}° · screen→lat/lon round trip ${r.roundTrip} m`);
  if(mode==='stereo'){ await p.evaluate(()=>{ MAP.range=40; render(); }); const want=await p.evaluate(()=>MAP.inv(MAP.cx-120,MAP.cy-60).map(v=>+v.toFixed(4)));
    const bx=await (await p.$('#map')).boundingBox(), X=bx.x+bx.width/2, Y=bx.y+bx.height/2; await p.mouse.move(X,Y); await p.mouse.down(); await p.mouse.move(X+60,Y+30,{steps:3}); await p.mouse.move(X+120,Y+60,{steps:3}); await p.mouse.up(); await p.waitForTimeout(200);
    console.log('  drag 120,60 px: centre now', JSON.stringify(await p.evaluate(()=>MAP.pan.map(v=>+v.toFixed(4)))), 'expected', JSON.stringify(want)); }
  await ctx.close(); }
 console.log(errs); await b.close(); })();
