// Map orientation: track up holds its rotation while the map is moved off your position (it used to drop to north up and
// the button did nothing), the button still switches north up / track up when moved off; Centre goes back to following the
// track. Two fingers: turning them rotates the map with them (after 12°: a pinch to zoom alone doesn't turn it), the
// button then says "NNN° up" and goes to north up; the turned map is kept after a reload. Real touches (CDP), phone.
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({...PX9}); await ctx.addInitScript(()=>{ try{ if(!localStorage.getItem('rc_mapUp')){ localStorage.setItem('rc_mapUp','"trk"'); localStorage.setItem('rc_fsMap','true'); } }catch(e){} });
 const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=045&gs=0'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(800);
 const cdp=await ctx.newCDPSession(p); const cv=await (await p.$('#map')).boundingBox(), cx=cv.x+cv.width/2, cy=cv.y+cv.height*0.45;
 const touch=async(type,pts)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pts.map(([x,y],i)=>({x,y,id:i+1}))});
 const S=()=>p.evaluate(()=>({up:MAP.up, rot:Math.round(MAP.rotNow), pan:!!MAP.pan, btn:$('mapUp').textContent, trk:heading()?Math.round(heading().deg):null}));
 const say=(t,s)=>console.log(t.padEnd(34), JSON.stringify(s));
 let s=await S(); say('centred, track 045 (mag):', s); const T0=s.trk; if(s.rot!==T0||s.btn!=='Track up') errs.push('start '+JSON.stringify(s));
 // drag off your position (one finger)
 await touch('touchStart',[[cx,cy]]); for(let i=1;i<=8;i++) await touch('touchMove',[[cx+i*12,cy+i*8]]); await touch('touchEnd',[]); await p.waitForTimeout(200);
 s=await S(); say('moved off:', s); if(!s.pan||s.rot!==T0||s.btn!=='Track up') errs.push('pan holds '+JSON.stringify(s));
 await p.evaluate(()=>{ st.trk=90; render(); }); await p.waitForTimeout(150); s=await S(); say('moved off, track now 090:', s); if(s.rot!==T0) errs.push('held rotation followed the track '+s.rot);
 await p.click('#mapUp'); await p.waitForTimeout(150); s=await S(); say('button (moved off):', s); if(s.rot!==0||s.btn!=='North up'||!s.pan) errs.push('north while panned '+JSON.stringify(s));
 await p.click('#mapUp'); await p.waitForTimeout(150); s=await S(); say('button again (moved off):', s); if(s.rot!==s.trk||s.btn!=='Track up') errs.push('track up while panned '+JSON.stringify(s));
 await p.click('#mapHome'); await p.waitForTimeout(150); await p.evaluate(()=>{ st.trk=120; render(); }); await p.waitForTimeout(150); s=await S(); say('Centre, track 120:', s); if(s.pan||s.rot!==s.trk) errs.push('centre follows '+JSON.stringify(s));
 // pinch only (twist 8°): zoom, no turn
 const ring=(r,a)=>[[cx-r*Math.cos(a*Math.PI/180),cy-r*Math.sin(a*Math.PI/180)],[cx+r*Math.cos(a*Math.PI/180),cy+r*Math.sin(a*Math.PI/180)]];
 const r0=await p.evaluate(()=>MAP.range);
 await touch('touchStart',ring(80,0)); for(let i=1;i<=6;i++) await touch('touchMove',ring(80+i*10,i*8/6)); await touch('touchEnd',[]); await p.waitForTimeout(200);
 s=await S(); const r1=await p.evaluate(()=>MAP.range); say('pinch, twist 8°:', {...s, range:+r1.toFixed(1)}); if(s.up!=='trk'||!(r1<r0)) errs.push('pinch only '+JSON.stringify(s)+' '+r1);
 // twist 40° clockwise: the map turns 28° clockwise with the fingers (after the first 12°)
 const before=s.rot; await touch('touchStart',ring(90,0)); for(let i=1;i<=10;i++) await touch('touchMove',ring(90,i*4)); await touch('touchEnd',[]); await p.waitForTimeout(200);
 s=await S(); say('twist 40° clockwise:', s); const want=(before-28+360)%360; if(s.up!=='free'||Math.abs(((s.rot-want+540)%360)-180)>2||!/^\d{3}° up$/.test(s.btn)) errs.push('twist '+JSON.stringify(s)+' want '+want);
 await p.evaluate(()=>{ st.trk=200; render(); }); await p.waitForTimeout(150); const s2=await S(); if(s2.rot!==s.rot) errs.push('turned map followed the track');
 await p.screenshot({path:'play/maprot.png'});
 await p.reload(); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(800); const s3=await S(); say('after a reload:', s3); if(s3.up!=='free'||s3.rot!==s.rot) errs.push('not kept '+JSON.stringify(s3));
 await p.click('#mapUp'); await p.waitForTimeout(150); s=await S(); say('button:', s); if(s.up!=='north'||s.rot!==0) errs.push('free -> north '+JSON.stringify(s));
 await p.click('#mapUp'); await p.waitForTimeout(150); s=await S(); say('button again:', s); if(s.up!=='trk') errs.push('north -> trk '+JSON.stringify(s));
 console.log(errs); await b.close(); })();
