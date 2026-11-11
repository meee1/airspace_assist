// The 10 NM inbound call on a coast leg: flying YBRS -> YMMB direct and as a coast leg (500 ft, 2 NM hops) in simulation,
// the Moorabbin Tower inbound row comes up at 10 NM both ways. On a coast leg the Go to is a turn point; its aerodrome is
// the leg's end (not whatever is nearest the turn point: Queenscliff, Portsea, Tyabb), and the inbound call for where you
// land takes over from a transit call (the coast route is within 10 NM of Tyabb till about 7 NM from Moorabbin).
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({...PX9,serviceWorkers:'block'}); const errs=[];
 for(const coast of [false,true]){ const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8811/index.html?sim=YBRS&alt=1500&trk=090&gs=0'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(500);
  await p.evaluate(()=>{ ls.set('coastOff',500); ls.set('coastGap',2); COAST.off=500; COAST.gap=2; fpSet({name:'t',kind:'map',pts:[fpPt(findPoint('YBRS')),fpPt(findPoint('YMMB'))],i:1}); });
  if(coast) await p.evaluate(()=>fpCoastSet(FP.pts[1],true));
  const r=await p.evaluate(async()=>{ const P=FP.pts.map(q=>[q.la,q.lo]), Y=findPoint('YMMB'), ads=new Set(); let inb=null, n=0;
    st.gs=90; st.alt=1500;
    for(let k=1;k<P.length;k++){ const [a,b_]=[P[k-1],P[k]], L=distBrg(a[0],a[1],b_[0],b_[1]), m=Math.max(1,Math.ceil(L[0]/0.25));
      for(let s=1;s<=m;s++){ st.pos=[a[0]+(b_[0]-a[0])*s/m, a[1]+(b_[1]-a[1])*s/m]; st.trk=L[1]; render(); n++;
        const g=goTarget(); if(g) ads.add(g.ad?g.ad.i:'none');
        const box=$('sInbound'); if(!inb&&!box.hidden&&/Moorabbin Tower/.test(box.textContent)) inb={d:+distBrg(st.pos[0],st.pos[1],Y.la,Y.lo)[0].toFixed(1), f:box.querySelector('b').textContent, txt:box.querySelector('span').textContent}; } }
    return {pts:FP.pts.length, steps:n, goAerodromes:[...ads], inbound:inb}; });
  console.log(coast?'coast leg:':'direct:   ', JSON.stringify(r));
  if(!r.inbound||r.inbound.d>10.3||r.inbound.d<9.5) errs.push((coast?'coast':'direct')+': inbound call at '+JSON.stringify(r.inbound));
  if(coast&&r.goAerodromes.some(x=>x!=='YMMB')) errs.push('coast leg Go to aerodromes: '+r.goAerodromes);
  await p.close(); }
 console.log(errs); await b.close(); })();
