// Where the compass comes from, and why there's none: orientation events with no values (Chrome with Motion sensors
// blocked), events not tied to north (Firefox), none at all -> the button's reason says which; the sensor API fallback
// (AbsoluteOrientationSensor, faked here: headless Chromium has no sensors) gives the same heading as the events for the
// same phone attitude, and its NotAllowedError reads as "sensors blocked".
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({...PX9}); const errs=[];
 await ctx.addInitScript(()=>{ window.__AOS={mode:'ok', q:[0,0,0,1]};
   window.AbsoluteOrientationSensor=class{ constructor(){ this.l={}; } addEventListener(t,f){ this.l[t]=f; }
     start(){ setTimeout(()=>{ if(__AOS.mode==='deny') this.l.error&&this.l.error({error:{name:'NotAllowedError'}}); else { this.quaternion=__AOS.q; this.l.reading&&this.l.reading(); } },50); } stop(){} }; });
 const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(300);
 const why=(prep)=>p.evaluate(async prep=>{ st.sim=false; st.compass=null; CMPS=null; Object.assign(CMPD,{ev:0,empty:0,rel:0,src:'',err:'',perm:''});
   if(prep==='empty') for(let i=0;i<3;i++) onOri({absolute:true, alpha:null, beta:null, gamma:null});
   if(prep==='rel') for(let i=0;i<3;i++) onOri({absolute:false, alpha:120, beta:80, gamma:0});
   if(prep==='deny'){ __AOS.mode='deny'; cmpFallback(); await new Promise(r=>setTimeout(r,200)); __AOS.mode='ok'; }
   st.pos=[-38.2,144.5]; st.gs=60; st.trk=90; cmpLearn(); return [$('bCmp').textContent, CMP.why]; },prep);
 for(const [k,want] of [['none',/no compass/],['empty',/sensors blocked/],['rel',/browser has no compass/],['deny',/sensors blocked/]]){
   const r=await why(k); console.log(k.padEnd(5), '·', r[0], '·', r[1]); if(!want.test(r[0])) errs.push(k+': '+r[0]); }
 // fallback: same heading as the events for the same attitude (quaternion of Rz(alpha) Rx(beta) Ry(gamma))
 const cmp=await p.evaluate(async()=>{ const out=[], qm=(a,b)=>[a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1], a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0], a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3], a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
   for(const [al,be,ga] of [[30,0,0],[200,85,0],[310,45,10],[100,10,-80],[15,-20,60]]){ const h=x=>x*Math.PI/360;
     const q=qm(qm([0,0,Math.sin(h(al)),Math.cos(h(al))],[Math.sin(h(be)),0,0,Math.cos(h(be))]),[0,Math.sin(h(ga)),0,Math.cos(h(ga))]);
     axesHeading.back=undefined; const ev=tiltHeading(al,be,ga,0);
     st.compass=null; CMPS=null; CMPD.src=''; __AOS.q=q; axesHeading.back=undefined; cmpFallback(); await new Promise(r=>setTimeout(r,120));
     out.push([al,be,ga, Math.round(ev), st.compass==null?null:Math.round(st.compass), CMPD.src]); }
   return out; });
 for(const c of cmp){ console.log('attitude', c.slice(0,3).join('/'), '· events', c[3], '· sensor API', c[4], c[5]); const d=c[4]==null?999:Math.abs(((c[4]-c[3]+540)%360)-180); if(d>1||c[5]!=='sensor') errs.push('fallback '+c); }
 // once the sensor API gives headings, the events don't fight it
 const keep=await p.evaluate(()=>{ const h=st.compass; onOri({absolute:true, alpha:123, beta:0, gamma:0}); return [Math.round(h), Math.round(st.compass)]; }); if(keep[0]!==keep[1]) errs.push('events override the sensor API: '+keep);
 console.log(errs); await b.close(); })();
