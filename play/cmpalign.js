// Compass alignment with realistic sensors: compass readings between GPS fixes (about 30 per fix, ±15° vibration
// jitter) -> aligned after about 20 fixes with the right offset; the reasons shown while it waits (under 20 kt, paused);
// a phone standing upright in landscape with the rotation locked gives the heading of the back of the phone (it used to
// flip 90° to the side); Reset. Drives onOri/onPos directly (the sensors), with simulation off.
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const p=await (await b.newContext({...PX9})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(300);
 // Euler angles (Chrome's alpha, beta, gamma) for a phone whose back points along heading H and whose portrait top points
 // up (portrait cradle) or sideways (landscape cradle): found numerically with the app's own rotation
 const eul=await p.evaluate(()=>{ const R_=Math.PI/180, f=(al,be,ga)=>{ const a=al*R_,b=be*R_,g=ga*R_, ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b),cg=Math.cos(g),sg=Math.sin(g);
     return {Y:[-sa*cb, ca*cb, sb], Z:[ca*sg+sa*sb*cg, sa*sg-ca*sb*cg, cb*cg]}; };
   const find=(H,land)=>{ const back=[Math.sin(H*R_),Math.cos(H*R_),0], top= land? [Math.sin((H-90)*R_),Math.cos((H-90)*R_),0] : [0,0,1]; let best=null;
     for(let al=0;al<360;al+=1) for(let be=-180;be<180;be+=1) for(const ga of [-90,-89,0,89,90]){ const m=f(al,be,ga), e=Math.hypot(...m.Y.map((v,i)=>v-top[i]))+Math.hypot(...m.Z.map((v,i)=>-v-back[i])); if(!best||e<best.e) best={al,be,ga,e}; }
     return best; };
   return {portrait:find(80,false), land:find(80,true)}; });
 const hd=await p.evaluate(e=>[Math.round(tiltHeading(e.portrait.al,e.portrait.be,e.portrait.ga,0)), Math.round(tiltHeading(e.land.al,e.land.be,e.land.ga,0))],eul);
 console.log('heading of the back of the phone, pointing 080: portrait upright', hd[0], '· landscape upright, rotation locked', hd[1]);
 if(Math.abs(hd[0]-80)>2||Math.abs(hd[1]-80)>2) errs.push('tilt heading '+hd);
 // fly: 090 true at 60 kt, phone pointing 10° left of the nose (compass 080 true), compass readings jittering ±15°
 const fly=(o)=>p.evaluate(async({gs,fixes,jit,pause,land,e})=>{ const sleep=t=>new Promise(r=>setTimeout(r,t)); st.sim=false; const v=variation(-38.2,144.5); let la=-38.2, lo=144.5; const out=[];
   const E= land? e.land : e.portrait;
   for(let i=0;i<fixes;i++){
     if(!pause) for(let k=0;k<30;k++){ const n=(Math.random()*2-1)*jit; onOri({absolute:true, alpha:(E.al-n+360)%360, beta:E.be, gamma:E.ga}); }
     lo+=gs/3600/60/Math.cos(la*Math.PI/180);
     onPos({coords:{latitude:la, longitude:lo, accuracy:5, altitude:300, speed:gs/1.943844, heading:90}, timestamp:Date.now()});
     await sleep(pause?2100:250); }
   return {n:CMP.n, off:Math.round(CMP.off*10)/10, btn:$('bCmp').textContent, title:$('bCmp').title, v:Math.round(v)}; },{...o,e:eul});
 // the compass reading for "pointing 080 true" is magnetic: shift alpha by the variation so the test phone reads 080 true
 const v=await p.evaluate(()=>variation(-38.2,144.5)); for(const k of ['portrait','land']) eul[k].al=(eul[k].al+v+360)%360;
 const slow=await fly({gs:12,fixes:5,jit:3}); console.log('12 kt:', slow.btn); if(slow.n||!/under 20 kt/.test(slow.btn)) errs.push('slow: '+JSON.stringify(slow));
 const paused=await fly({gs:60,fixes:2,jit:3,pause:true}); console.log('compass paused:', paused.btn, '·', paused.title.split('. ')[0]); if(!/paused/.test(paused.btn)||!/split screen/.test(paused.title)) errs.push('paused: '+JSON.stringify(paused));
 const a=await fly({gs:60,fixes:26,jit:15}); console.log('60 kt, ±15° jitter:', JSON.stringify({...a,title:undefined})); if(a.n<20||Math.abs(a.off-10)>2||!/aligned \+10°/.test(a.btn)) errs.push('align: '+JSON.stringify(a));
 await p.click('#bCmp'); const z=await p.evaluate(()=>[CMP.n,$('bCmp').textContent]); console.log('reset:', JSON.stringify(z)); if(z[0]) errs.push('reset');
 const l=await fly({gs:60,fixes:24,jit:15,land:true}); console.log('landscape cradle:', JSON.stringify({...l,title:undefined})); if(l.n<20||Math.abs(l.off-10)>2) errs.push('landscape: '+JSON.stringify(l));
 // hovering afterwards: the heading is compass + offset (090 true, the nose), not the raw 080
 const h=await p.evaluate(e=>{ onOri({absolute:true, alpha:e.land.al, beta:e.land.be, gamma:e.land.ga}); st.gs=0; const x=heading(); return [x.src, Math.round(x.deg)]; },eul); console.log('hover heading:', JSON.stringify(h)); if(h[0]!=='HDG'||Math.abs(h[1]-90)>3) errs.push('hover: '+h);
 console.log(errs); await b.close(); })();
