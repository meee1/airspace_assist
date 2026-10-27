const DATA = window.__DATA;   // loaded from data.json / data-next.json by the loader in index.html
const $ = id => document.getElementById(id);
const R = Math.PI/180, NM = 3440.065;
const ls = {get(k,d){try{const v=localStorage.getItem('rc_'+k);return v===null?d:JSON.parse(v)}catch(e){return d}},
            set(k,v){try{localStorage.setItem('rc_'+k,JSON.stringify(v))}catch(e){}}};

const st = {pos:null, acc:null, alt:null, gs:null, trk:null, compass:null, compassMag:true,
  ahead:ls.get('ahead',false), heli:ls.get('heli',false), all:ls.get('all',true), theme:ls.get('theme','auto'),
  pin:null, wake:null};

/* ---------- geometry ---------- */
function distBrg(la1,lo1,la2,lo2){
  const p1=la1*R,p2=la2*R,dl=(lo2-lo1)*R;
  const a=Math.sin((p2-p1)/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
  const d=2*NM*Math.asin(Math.min(1,Math.sqrt(a)));
  const y=Math.sin(dl)*Math.cos(p2), x=Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl);
  return [d,(Math.atan2(y,x)/R+360)%360];
}
function variation(la,lo){ // east positive, bilinear on WMM grid
  const v=DATA.var, g=v.g; let fy=(la-v.la0)/v.st, fx=(lo-v.lo0)/v.st;
  fy=Math.max(0,Math.min(g.length-1.001,fy)); fx=Math.max(0,Math.min(g[0].length-1.001,fx));
  const y=Math.floor(fy), x=Math.floor(fx), ty=fy-y, tx=fx-x;
  return (g[y][x]*(1-tx)+g[y][x+1]*tx)*(1-ty)+(g[y+1][x]*(1-tx)+g[y+1][x+1]*tx)*ty;
}
const norm=a=>((a%360)+360)%360;
const fmt3=a=>String(Math.round(norm(a))%360).padStart(3,'0');

/* boundary bboxes */
const BB={};
for(const [k,p] of Object.entries(DATA.bnd)){
  let a=90,b=-90,c=180,d=-180; for(const q of p){a=Math.min(a,q[0]);b=Math.max(b,q[0]);c=Math.min(c,q[1]);d=Math.max(d,q[1])}
  BB[k]=[a,b,c,d];
}
function inPoly(la,lo,k){
  const bb=BB[k]; if(la<bb[0]||la>bb[1]||lo<bb[2]||lo>bb[3]) return false;
  const p=DATA.bnd[k]; let c=false;
  for(let i=0,j=p.length-1;i<p.length;j=i++){
    const a=p[i],b=p[j];
    if((a[0]>la)!==(b[0]>la) && lo<(b[1]-a[1])*(la-a[0])/(b[0]-a[0])+a[1]) c=!c;
  }
  return c;
}
function sectorsAt(la,lo,altFt){
  const out=[];
  for(const s of DATA.sec){
    for(const [lo_,hi,bl] of s.v){
      if(altFt<lo_-200||altFt>hi) continue;
      if(bl.some(b=>inPoly(la,lo,b))){out.push({...s,lo:lo_,hi});break}
    }
  }
  return out;
}

function altTxt(ft){ if(ft<=0) return 'SFC'; if(ft>=60000) return 'UNL'; return ft>10000? 'FL'+String(Math.round(ft/100)).padStart(3,'0') : 'A'+String(Math.round(ft/100)).padStart(3,'0'); }
function bandTxt(b){ return altTxt(b.lo)+'–'+altTxt(b.hi); }
function areaBands(la,lo){ // one representative frequency per vertical band at this point
  const all=[];
  for(const s of DATA.sec) for(const [l,h,bl] of s.v) if(bl.some(b=>inPoly(la,lo,b))) all.push({...s,lo:l,hi:h});
  const out=[], key=new Set();
  const add=(b,role)=>{ const k=role+b.lo+'-'+b.hi; if(key.has(k)) return; key.add(k); out.push({...b,role}); };
  all.filter(b=>b.k==='TWR').forEach(b=>add(b,'TWR'));
  const tma=all.filter(b=>b.k==='APP'||b.k==='DEP');
  // prefer the "Radar (Centre)" class G/E frequency, then a named approach, per band
  [...tma].sort((x,y)=>(/centre/i.test(y.n)-/centre/i.test(x.n))||((y.k==='APP')-(x.k==='APP'))).forEach(b=>add(b,'TMA'));
  all.filter(b=>b.k==='CTR'||b.k==='FSS').sort((x,y)=>(x.hi-x.lo)-(y.hi-y.lo)).forEach(b=>add(b,'CTR'));
  // drop enroute bands fully covered by a TMA band (vatSys stacks them 0-UNL underneath)
  return out.filter(b=>!(b.role==='CTR' && out.some(o=>o.role==='TMA' && o.lo<=b.lo && o.hi>=b.hi)))
            .map(b=> b.role==='CTR'? (()=>{ const t=out.filter(o=>o.role==='TMA'&&o.lo<=b.lo&&o.hi>b.lo&&o.hi<b.hi).reduce((m,o)=>Math.max(m,o.hi),b.lo); return {...b,lo:t}; })() : b)
            .filter((b,i,arr)=>arr.findIndex(o=>o.f===b.f&&o.lo===b.lo&&o.hi===b.hi)===i);
}

/* ---------- DAH airspace (XC Australia OpenAir) ---------- */
const ASP=(DATA.asp||[]).map(([k,n,lo,lok,hi,hik,f,p,x])=>{
  let a=90,b=-90,c=180,d=-180; for(const q of p){a=Math.min(a,q[0]);b=Math.max(b,q[0]);c=Math.min(c,q[1]);d=Math.max(d,q[1])}
  return {k,n,lo,lok,hi,hik,f,p,x:x||{},bb:[a,b,c,d]};
});
function inRing(la,lo,p){ let c=false;
  for(let i=0,j=p.length-1;i<p.length;j=i++){ const a=p[i],b=p[j];
    if((a[0]>la)!==(b[0]>la) && lo<(b[1]-a[1])*(la-a[0])/(b[0]-a[0])+a[1]) c=!c; }
  return c; }
function inAsp(x,la,lo){ const bb=x.bb; return la>=bb[0]&&la<=bb[1]&&lo>=bb[2]&&lo<=bb[3]&&inRing(la,lo,x.p); }
function limFt(v,kind,gnd,bcta){ if(kind==='AGL') return v+gnd; if(kind==='BCTA') return bcta; if(kind==='NOTAM') return v==null?99999:v; return v==null?0:v; }
function limTxt(ft){ if(ft<=0) return 'SFC'; if(ft>=60000) return 'UNL'; return ft>=11000? 'FL'+String(Math.round(ft/100)).padStart(3,'0') : 'A'+String(Math.round(ft/100)).padStart(3,'0'); }
const ucfirst=s=>titleCase(s||'');
const META=DATA.meta||{}, ASRC=META.airspace==='DAH'?'DAH':'XC';
const SRC={E:'ERSA',X:'XC Aus',V:'VATPAC',O:'OurAirports'};
function chip(src){ if(!src) return ''; const off=['ERSA','DAH','AIP'].includes(src); return `<span class="src ${off?'off':'unv'}">${src}</span>`; }
function baAt(la,lo){ return ASP.find(x=>x.k==='BA'&&inAsp(x,la,lo)); }
function ctafInfo(a){
  const other = a.c && a.cS!=='E' ? {f:a.c, src:SRC[a.cS]||a.cS} : null;
  if(a.cS==='E') return {f:a.c, src:'ERSA', note:a.ct?'When tower not active':'Common traffic advisory', afru:a.afru};
  if(a.s==='E' && a.x && a.x.some(x=>x[0]==='TWR')) return {f:null, src:'ERSA', note:'No CTAF published: tower aerodrome'};
  const ba=baAt(a.la,a.lo);
  if(ba) return {f:ba.f, src:ASRC, note:titleCase(ba.n)+' broadcast area', other: other&&other.f!==ba.f?other:null};
  return {f:'126.7', src:'AIP', note: a.s==='E'?'ERSA lists no CTAF: AIP default':'Not listed in ERSA: AIP default CTAF', other: other&&other.f!=='126.7'?other:null};
}
function unitFor(kind,name,mid,la,lo){ // controlling unit from the ATC sector data
  const secs=sectorsAt(la,lo,mid), w=(name||'').split(/[ /]/)[0].toLowerCase();
  const m=s=>s.n.toLowerCase().startsWith(w);
  let s=null;
  if(kind==='A') s=secs.filter(x=>x.k==='CTR'||x.k==='FSS').sort((a,b)=>(a.hi-a.lo)-(b.hi-b.lo))[0];
  if(kind==='CTR'||kind==='D') s=secs.find(x=>x.k==='TWR'&&m(x))||secs.find(x=>x.k==='TWR')||secs.find(x=>x.k==='APP'&&m(x));
  if(!s) s=secs.find(x=>x.k==='APP'&&m(x)&&!/centre/i.test(x.n))||secs.find(x=>x.k==='APP'&&!/centre/i.test(x.n))||secs.find(x=>x.k==='CTR'||x.k==='FSS');
  return s? {f:s.f, unit: s.k==='CTR'? s.cs+' ('+s.n+')' : s.n} : {};
}
// Class D that ERSA says becomes Class G outside tower hours ("Outside TWR HR airspace becomes Class G").
// Only the plain statement is used; anything more complex (Avalon E, Alice Springs, Albury...) is left as published.
const REV=DATA.ap.filter(a=>a.x&&a.x.some(x=>x[0]==='TWR')).map(a=>{
  const t=(a.cnotes||[]).concat(...Object.values(a.proc||{})).join(' ');
  const m=t.match(/Outside TWR HRS?,?\s*(?:[A-Z][A-Za-z ]+ Class D airspace|airspace) becomes Class G\b(?! and)[^.]*\./);
  return m? {a, w:callName(a.n).split(' ')[0].toUpperCase()+' ', ev:m[0]} : null; }).filter(Boolean);
function revAd(x){ if(x.k!=='CTR'&&x.k!=='D') return null; const r=REV.find(r=>x.n.startsWith(r.w)); if(!r) return null;
  const ts=twrStatus(r.a); return ts&&!ts.on? r : null; }
function airStack(la,lo,gnd){
  const hit=ASP.filter(x=>inAsp(x,la,lo)), rev=[];
  const ctl=hit.filter(x=>'A C D E CTR'.split(' ').includes(x.k)).filter(x=>{ const r=revAd(x); if(r){ rev.push({x,...r}); return false; } return true; });
  const bcta=ctl.length? Math.min(...ctl.map(x=>limFt(x.lo,x.lok,gnd,0))) : 99999;
  const L=x=>limFt(x.lo,x.lok,gnd,bcta), H=x=>limFt(x.hi,x.hik,gnd,bcta);
  const bands=[];
  for(const x of ctl){
    const b={...x,L:L(x),H:H(x)}; if(b.H<=b.L) continue;
    const mid=(b.L+Math.min(b.H,b.L+3000))/2;
    if(x.k==='CTR'){ const m=x.n.match(/\(([A-Z])\)/); b.ctrCls=x.x.cc||(m?m[1]:'D'); }
    if(x.k==='E'){ const ef=hit.find(e=>e.k==='EF' && L(e)<=mid && H(e)>mid);
      if(ef){ b.f=ef.f; b.unit=ucfirst(ef.n)+' (E frequency)'; b.us=ASRC; } }
    if(!b.f && x.x.u && x.x.u.length){
      let u=x.x.u[0];
      if(x.x.u.length>1){ const vs=sectorsAt(la,lo,mid).map(s=>s.f); u=x.x.u.find(e=>vs.includes(e[1]))||u;
        b.alt=x.x.u.filter(e=>e!==u).map(e=>e[0]+' '+e[1]); }
      b.f=u[1]; b.unit=u[0]; b.us='ERSA'; }
    if(!b.f){ const u=unitFor(x.k==='CTR'?'CTR':x.k,x.n,mid,la,lo); b.f=u.f; b.unit=u.unit; b.us=u.f?'VATPAC':null; }
    bands.push(b);
  }
  if(bcta>0){
    const fias=hit.filter(x=>x.k==='FIA');
    for(const f of fias){ const fl=L(f), fh=Math.min(H(f),bcta); if(fh>fl) bands.push({k:'G',n:ucfirst(f.n),L:fl,H:fh,f:f.f,unit:ucfirst(f.n),us:ASRC}); }
    if(!fias.length) bands.push({k:'G',n:'Class G',L:0,H:bcta,f:null,unit:null});
  }
  const ba=hit.filter(x=>x.k==='BA').map(x=>({...x,L:L(x),H:H(x)}));
  const prd=hit.filter(x=>x.k==='R'||x.k==='Q').map(x=>({...x,L:L(x),H:H(x)})).filter(x=>x.L<20000);
  // resolve vertical overlaps: CTR > D > C > A > E > G, then merge
  const PR={CTR:6,D:5,C:4,A:3,E:2,G:1};
  const cuts=[...new Set(bands.flatMap(b=>[b.L,b.H]))].sort((a,b)=>a-b), segs=[];
  for(let i=0;i<cuts.length-1;i++){
    const lo_=cuts[i], hi_=cuts[i+1], m=(lo_+hi_)/2;
    const top=bands.filter(b=>b.L<=m&&b.H>m).sort((a,b)=>PR[b.k]-PR[a.k])[0]; if(!top) continue;
    const last=segs[segs.length-1];
    if(last && last.H===lo_ && (last.src===top || (last.k===top.k && last.f===top.f))) last.H=hi_;
    else segs.push({...top,src:top,L:lo_,H:hi_});
  }
  return {bands:segs,prd,bcta,ba,rev};
}

/* ---------- SRTM terrain (app/terrain/*.bin.z, built by tools/fetch_srtm.py) ---------- */
const TER={idx:null,have:new Set(),sea:new Set(),tiles:new Map(),busy:new Set(),ok:false};
async function terInit(){
  try{ const r=await fetch('terrain/index.json',{cache:'no-cache'}); if(!r.ok) return; TER.idx=await r.json();
    TER.have=new Set(TER.idx.tiles||[]); TER.sea=new Set(TER.idx.sea||[]); TER.ok=TER.have.size>0 && typeof DecompressionStream!=='undefined'; setFoot(); render(); }catch(e){}
}
function tName(la0,lo0){ return (la0<0?'S':'N')+String(Math.abs(la0)).padStart(2,'0')+(lo0<0?'W':'E')+String(Math.abs(lo0)).padStart(3,'0'); }
async function terLoad(n){
  if(TER.busy.has(n)) return; TER.busy.add(n);
  try{ const r=await fetch('terrain/'+n+'.bin.z'); if(!r.ok) throw 0;
    const buf=await new Response(r.body.pipeThrough(new DecompressionStream('deflate'))).arrayBuffer();
    TER.tiles.set(n,new Int16Array(buf)); render(); }catch(e){ TER.tiles.set(n,null); }
}
function terrainFt(la,lo){ // max of the 4 surrounding 30" posts, feet; null = unknown
  if(!TER.ok) return null;
  const la0=Math.floor(la), lo0=Math.floor(lo), n=tName(la0,lo0);
  if(TER.sea.has(n)) return 0;
  if(!TER.have.has(n)) return null;
  const t=TER.tiles.get(n); if(t===undefined){ terLoad(n); return null; } if(t===null) return null;
  const N=(TER.idx.n||121)-1, fy=(la0+1-la)*N, fx=(lo-lo0)*N;
  const y=Math.min(N-1,Math.floor(fy)), x=Math.min(N-1,Math.floor(fx)), W=N+1;
  const m=Math.max(t[y*W+x],t[y*W+x+1],t[(y+1)*W+x],t[(y+1)*W+x+1]);
  return m*3.28084;
}
function terPrefetch(la,lo){ if(!TER.ok) return; for(let a=-2;a<=2;a++) for(let b=-2;b<=2;b++){ const n=tName(Math.floor(la)+a,Math.floor(lo)+b); if(TER.have.has(n)&&!TER.tiles.has(n)) terLoad(n); } }

/* ---------- navigation points: VFR waypoints (ERSA), navaids (DAH + ERSA freq), IFR waypoints (DAH) ---------- */
const VW=(DATA.vw||[]).map(([c,n,la,lo])=>({k:'VFR',c,n,la,lo}));
const NA=(DATA.na||[]).map(([c,t,n,la,lo,f])=>({k:'NAV',c,t,n,la,lo,f}));
const VWby=new Map(VW.map(p=>[p.c,p]));
function findPoint(q){
  q=q.trim().toUpperCase(); if(!q) return null;
  const a=DATA.ap.find(x=>x.i===q); if(a) return {k:'AD',c:a.i,n:a.n,la:a.la,lo:a.lo};
  if(VWby.has(q)) return VWby.get(q);
  const nv=NA.filter(p=>p.c===q); if(nv.length){ const ref=st.pos||[-30,135]; return nv.sort((x,y)=>distBrg(ref[0],ref[1],x.la,x.lo)[0]-distBrg(ref[0],ref[1],y.la,y.lo)[0])[0]; }
  const iw=(DATA.iw||[]).find(w=>w[0]===q); if(iw) return {k:'IFR',c:iw[0],n:'IFR waypoint',la:iw[1],lo:iw[2]};
  const byName=VW.find(p=>p.n===q)||VW.find(p=>p.n.startsWith(q)&&q.length>=4)||DATA.ap.find(x=>x.n.toUpperCase()===q);
  if(byName) return byName.k?byName:{k:'AD',c:byName.i,n:byName.n,la:byName.la,lo:byName.lo};
  const f=searchPoints(q,1)[0]; return f&&f.sc>=60? f.p : null;
}
function ptDesc(p){ if(p.k==='FP') return p.n; if(p.k==='TOWN') return (p.t==='S'?'Suburb · ':'Town · ')+p.n+(p.ste?', '+p.ste:'')+(p.t==='M'?' (major urban)':p.t==='L'?' (locality)':''); return p.k==='VFR'?'VFR waypoint · '+titleCase(p.n) : p.k==='NAV'?`${p.t} · ${titleCase(p.n)}${p.f?' · '+p.f:''}` : p.k==='AD'?'Aerodrome · '+titleCase(p.n) : 'IFR waypoint'; }
function nearestVFR(la,lo,maxNm){ let best=null,bd=maxNm; for(const p of VW){ if(Math.abs(p.la-la)>maxNm/60+.02) continue; const d=distBrg(la,lo,p.la,p.lo)[0]; if(d<bd){bd=d;best=p;} } return best?{p:best,d:bd}:null; }
let GO=ls.get('goto',null);
/* ---------- flight plan (GPX) ---------- */
let FP=ls.get('fp',null);   // {name, pts:[{n,la,lo,desc}], i:active index}
function parseGPX(xml){
  const doc=new DOMParser().parseFromString(xml,'application/xml');
  if(doc.getElementsByTagName('parsererror').length) throw new Error('That file is not valid GPX/XML.');
  const pick=tag=>[...doc.getElementsByTagName(tag)];
  let nodes=pick('rtept'), kind='route'; if(!nodes.length){ nodes=pick('wpt'); kind='waypoints'; } if(!nodes.length){ nodes=pick('trkpt'); kind='track'; }
  if(!nodes.length) throw new Error('No route, waypoints or track found in that GPX file.');
  let pts=nodes.map((n,k)=>{ const la=parseFloat(n.getAttribute('lat')), lo=parseFloat(n.getAttribute('lon'));
    const nm=(n.getElementsByTagName('name')[0]?.textContent||'').trim(), ds=(n.getElementsByTagName('desc')[0]?.textContent||'').trim();
    return {n:nm||('WP'+(k+1)), la, lo, gd:ds}; }).filter(p=>isFinite(p.la)&&isFinite(p.lo));
  if(kind==='track' && pts.length>60){ const step=Math.ceil(pts.length/60); pts=pts.filter((p,k)=>k%step===0||k===pts.length-1); }
  // label from the AIP where the name or position matches
  for(const p of pts){ const m=findPoint(p.n.split(/[\s(]/)[0]);
    if(m && distBrg(p.la,p.lo,m.la,m.lo)[0]<2){ p.desc=ptDesc(m); p.c=m.c; }
    else if(p.gd) p.desc=p.gd+' (from GPX)';
    else { const nv=nearestVFR(p.la,p.lo,1); p.desc= nv? `user point, ${nv.d.toFixed(1)} NM from ${titleCase(nv.p.n)}` : 'user point'; } }
  const nm=(doc.getElementsByTagName('rte')[0]?.getElementsByTagName('name')[0]?.textContent||doc.getElementsByTagName('name')[0]?.textContent||'').trim();
  return {name: nm || pts[0].n+' – '+pts[pts.length-1].n, kind, pts, i: pts.length>1?1:0};
}
function fpSet(fp){ FP=fp; ls.set('fp',FP); if(FP) fpGo(); render(); }
function fpPick(i){ // manual choice (Prev/Next/leg tap/Reverse): don't let auto-advance undo it
  if(!FP) return; FP.i=Math.max(0,Math.min(FP.pts.length-1,i));
  const p=FP.pts[FP.i], d=st.pos&&p? distBrg(st.pos[0],st.pos[1],p.la,p.lo)[0] : null;
  FP.man={i:FP.i, armed: d==null||d>=0.5, d0:d};   // if you're already on it, wait until you've moved 1 NM away
  ls.set('fp',FP); fpGo(); render();
}
function fpGo(){ if(!FP) return; const p=FP.pts[FP.i]; if(p) setGo({k:'FP',c:p.c||p.n,n:p.desc?p.desc:'Flight plan waypoint',la:p.la,lo:p.lo}); }
function xte(la,lo,a,b){ // cross-track (NM, + = right of course) and along-track remaining
  const [d13,b13]=distBrg(a.la,a.lo,la,lo), [,b12]=distBrg(a.la,a.lo,b.la,b.lo);
  const x=Math.asin(Math.sin(d13/NM)*Math.sin((b13-b12)*R))*NM; return x;
}
// Waypoint sequencing (fly-by, like a GNSS navigator):
//  - within 0.5 NM of the active waypoint, or
//  - across the turn bisector at the active waypoint (inbound and outbound legs), within 5 NM of it; on a straight
//    leg that is simply "abeam or past it", so cutting a corner or passing a mile or two off track still sequences;
//  - catch-up: if the GPS was off (screen locked, app closed) and you are now clearly on a later leg, jump to it.
// A waypoint chosen by hand (Prev/Next/leg tap) only sequences within 0.5 NM until you have flown 1 NM towards it,
// so picking one behind you doesn't immediately skip forward again.
function fpLocal(o,p){ const c=Math.cos(o.la*R); return [(p.lo-o.lo)*c*60,(p.la-o.la)*60]; }   // NM east/north of o
function fpLeg(k,pos){ const P_=FP.pts, a=P_[k-1], b=P_[k], [bx,by]=fpLocal(a,b), [px,py]=fpLocal(a,{la:pos[0],lo:pos[1]}), L=Math.hypot(bx,by)||1e-9;
  return {L, along:(px*bx+py*by)/L, xt:(px*by-py*bx)/L}; }   // xt + = right of course
function fpAdvance(){
  if(!FP||!st.pos) return; const P_=FP.pts, i=FP.i, p=P_[i]; if(!p) return;
  const pos=st.pos, d=distBrg(pos[0],pos[1],p.la,p.lo)[0], last=P_.length-1;
  let man=FP.man&&FP.man.i===i? FP.man : null;
  if(man && !man.armed){ if(d>1){ man.armed=true; man.d0=d; ls.set('fp',FP); } return; }
  if(man && man.d0!=null && d<man.d0-1){ FP.man=man=null; ls.set('fp',FP); }   // heading for it: normal rules again
  let next=null;
  if(d<0.5) next=i+1;
  else if(!man && i===0 && last>0){ const g=fpLeg(1,pos); if(g.along>0.3 && Math.abs(g.xt)<3) next=1; }   // left the start point
  else if(!man && i>0 && i<last && d<5){
    const [rx,ry]=fpLocal(p,{la:pos[0],lo:pos[1]}), [ax,ay]=fpLocal(P_[i-1],p), [cx_,cy_]=fpLocal(p,P_[i+1]);
    const la_=Math.hypot(ax,ay)||1, lc=Math.hypot(cx_,cy_)||1, nx=ax/la_+cx_/lc, ny=ay/la_+cy_/lc, nn=Math.hypot(nx,ny);
    if(nn>0.3 ? (rx*nx+ry*ny)/nn>0 : false) next=i+1;                                  // past the bisector
  }
  if(next==null && !man && i<last){                                                     // catch-up after a gap
    const cur=i>0? fpLeg(i,pos) : null, onCur=cur? Math.abs(cur.xt)<2 && cur.along>-1 && cur.along<cur.L+1 : d<2;
    const trkOk=k=>{ if(st.trk==null||!(st.gs>20)) return true; const lb=distBrg(P_[k-1].la,P_[k-1].lo,P_[k].la,P_[k].lo)[1]; return Math.abs(((st.trk-lb+540)%360)-180)<60; };
    if(!onCur) for(let k=i+1;k<=last;k++){ const g=fpLeg(k,pos); if(Math.abs(g.xt)<2 && g.along>0 && g.along<g.L && trkOk(k)){ next=k; break; } }
  }
  if(next!=null && next<=last){ FP.i=next; FP.man=null; ls.set('fp',FP); fpLogEv('seq',i,next,d); fpGo(); }
}
/* flight log: every GPS fix (at most one per 5 s) for the last 6 h, exportable as GPX, to check sequencing after a flight */
const TLOG={pts:ls.get('tlog',[]), last:0};
function fpLogFix(){ if(st.sim||!st.pos) return; const t=Date.now(); if(t-TLOG.last<5000) return; TLOG.last=t;
  TLOG.pts.push([t,+st.pos[0].toFixed(6),+st.pos[1].toFixed(6),st.alt!=null?Math.round(st.alt):null,st.gs!=null?Math.round(st.gs):null,st.trk!=null?Math.round(st.trk):null,st.acc!=null?Math.round(st.acc):null,FP?FP.i:null]);
  const cut=t-6*3600e3; while(TLOG.pts.length&&TLOG.pts[0][0]<cut) TLOG.pts.shift(); if(TLOG.pts.length%6===0) ls.set('tlog',TLOG.pts); }
function fpLogEv(kind,a,b,d){ if(st.sim) return; TLOG.pts.push([Date.now(),'ev',kind,a,b,+d.toFixed(2)]); ls.set('tlog',TLOG.pts); }
function fpLogGpx(){ const fx=TLOG.pts.filter(p=>p[1]!=='ev'), ev=TLOG.pts.filter(p=>p[1]==='ev');
  const x=s=>String(s).replace(/[<&]/g,'');
  const pts=fx.map(p=>`<trkpt lat="${p[1]}" lon="${p[2]}">${p[3]!=null?`<ele>${(p[3]/3.28084).toFixed(1)}</ele>`:''}<time>${new Date(p[0]).toISOString()}</time><desc>gs ${p[4]} trk ${p[5]} acc ${p[6]} wp ${p[7]}</desc></trkpt>`).join('\n');
  const wpts=ev.map(e=>{ const f=fx.reduce((m,p)=>Math.abs(p[0]-e[0])<Math.abs(m[0]-e[0])?p:m,fx[0]||[e[0],0,0]); return `<wpt lat="${f[1]}" lon="${f[2]}"><time>${new Date(e[0]).toISOString()}</time><name>${x(e[2])} ${e[3]}->${e[4]}</name><desc>${e[5]} NM from waypoint</desc></wpt>`; }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Radio Calls AU" xmlns="http://www.topografix.com/GPX/1/1">\n${wpts}\n<trk><name>Radio Calls AU log${FP?' · '+x(FP.name):''}</name><trkseg>\n${pts}\n</trkseg></trk></gpx>`; }
// Flight plan aerodromes take priority over "closest" so the right calls are on screen in time:
//  1. the next aerodrome in the plan, once within 10 NM (the CTAF inbound/overflying call point)
//  2. when the active waypoint is one of that aerodrome's ERSA VFR reporting points (e.g. ACE for Moorabbin), within 15 NM,
//     so the tower inbound call is up before you reach the point
//  3. the aerodrome you just left or overflew, within 5 NM (departure calls)
const RPTS=new Map(); for(const a of DATA.ap){ const r=a.keys&&a.keys.rpts; if(r) for(const c of r.split(/,\s*|\s+or\s+/)) RPTS.set(c.trim()+'>'+a.i,a); }
function fpAd(p){ if(!p) return null; const c=(p.c||p.n||'').toUpperCase();
  return DATA.ap.find(a=>a.i===c) || DATA.ap.find(a=>Math.abs(a.la-p.la)<0.01 && distBrg(a.la,a.lo,p.la,p.lo)[0]<0.5) || null; }
function fpAerodrome(la,lo){
  if(!FP||!FP.pts.length) return null;
  const P_=FP.pts, i=FP.i, at=(a,why)=>{ const [d,b]=distBrg(la,lo,a.la,a.lo); return {a,d,b,why}; };
  let k=i, nx=null; for(;k<P_.length;k++){ nx=fpAd(P_[k]); if(nx) break; }
  if(nx){ const n=at(nx,'Flight plan · next aerodrome');
    if(n.d<=10) return n;
    if(k===i+1 && n.d<=15 && RPTS.has((P_[i].c||P_[i].n||'').toUpperCase()+'>'+nx.i)) return {...n,why:'Flight plan · reporting point for '+nx.i}; }
  for(let j=i-1;j>=0;j--){ const pa=fpAd(P_[j]); if(pa){ const n=at(pa,'Flight plan · last aerodrome'); if(n.d<=5) return n; break; } }
  return null;
}
/* ---------- flight plan elevation profile (SRTM terrain + DAH airspace along the route) ---------- */
let PROF=null, profSel=null, PROF_TOP=ls.get('profTop',null);
const PROF_STEPS=[1000,1500,2000,2500,3000,4000,5000,6000,8000,10000,12500,15000,20000,25000];
function profZoom(dir){ const cur=PROF_TOP||(PROF&&PROF.auto)||5000;
  const nx = dir<0 ? [...PROF_STEPS].reverse().find(v=>v<cur) : PROF_STEPS.find(v=>v>cur);
  PROF_TOP = nx || (dir<0?PROF_STEPS[0]:PROF_STEPS[PROF_STEPS.length-1]); ls.set('profTop',PROF_TOP); drawProf(); }
const PROF_TERR='#9c7a4a';
function profKey(){ const P_=FP.pts; return [FP.name,P_.length,P_[0].la,P_[0].lo,P_[P_.length-1].la,P_.map(p=>p.lo.toFixed(4)).join(),TER.ok,TER.tiles.size,Math.floor(Date.now()/60000),$('cCat').value].join('|'); }
function profEnsure(){ if(!FP||FP.pts.length<2) return null; const key=profKey(); if(!PROF||PROF.key!==key){ PROF=profBuild(); PROF.key=key; } return PROF; }
function profBuild(){
  const P_=FP.pts, cum=[0];
  for(let k=1;k<P_.length;k++) cum.push(cum[k-1]+distBrg(P_[k-1].la,P_[k-1].lo,P_[k].la,P_[k].lo)[0]);
  const total=cum[cum.length-1]||0, step=Math.max(0.2,total/500), S=[], heli=$('cCat').value==='H';
  let missing=0;
  for(let k=1;k<P_.length;k++){ const a=P_[k-1], b=P_[k], L=cum[k]-cum[k-1], n=Math.max(1,Math.ceil(L/step));
    for(let j=(k===1?0:1);j<=n;j++){ const f=j/n, la=a.la+(b.la-a.la)*f, lo=a.lo+(b.lo-a.lo)*f;
      const t=terrainFt(la,lo); if(t==null&&TER.ok) missing++;
      const AS=airStack(la,lo,t||0);
      // minimum height (CASR 91.265 / 91.267, MOS 12.01 note): 1,000 ft over a populous area within 600 m (rotorcraft 300 m),
      // otherwise 500 ft within 300 m. Terrain only: the SRTM grid has no buildings, masts or other obstacles.
      const u=urbanAt(la,lo), rm=u?(heli?300:600):300, dla=rm/1852/60, dlo=dla/Math.cos(la*R);
      let tr=t; for(const [p,q] of RING8){ const v=terrainFt(la+p*dla,lo+q*dlo); if(v!=null&&(tr==null||v>tr)) tr=v; }
      S.push({x:cum[k-1]+L*f, leg:k, la, lo, t, u:u&&u.n, tr, need:tr==null?null:tr+(u?1000:500),
        b:AS.bands.filter(x=>x.k!=='G').map(x=>({k:x.k==='CTR'?(x.ctrCls||'D'):x.k, L:x.L, H:x.H, n:x.n})),
        p:AS.prd.map(x=>({k:x.k, L:x.L, H:x.H, n:x.n}))}); } }
  // summary: highest terrain, lowest controlled-airspace base, and where terrain comes within 1,000 ft of that base
  let hi=null, lo=null, tight=null;
  for(const q of S){ const base=q.b.length?Math.min(...q.b.map(x=>x.L)):null; q.base=base;
    if(q.t!=null && (!hi||q.t>hi.t)) hi=q;
    if(base!=null && base>0 && (!lo||base<lo.base)) lo=q;
    if(q.t!=null && base!=null && base>0 && base-q.t<1000 && (!tight||base-q.t<tight.base-tight.t)) tight=q; }
  const zones=new Map(); for(const q of S) for(const a of q.b) if(a.L<=0 && !zones.has(a.n)) zones.set(a.n,{...a,x:q.x});
  const pr={S,cum,total,missing,hi,lo,tight,zones:[...zones.values()]};
  pr.legs=P_.map((_,k)=>k?legPlan(pr,k):null);
  return pr;
}
let CTA_BUF=ls.get('ctaBuf',500);
const RING8=[[1,0],[-1,0],[0,1],[0,-1],[.707,.707],[.707,-.707],[-.707,.707],[-.707,-.707]];
// suggested VFR altitude for one leg: the lowest level from AIP ENR 1.7 Table B (magnetic track 000-179: 1,500 3,500 5,500 7,500 9,500;
// 180-359: 2,500 4,500 6,500 8,500) that is at or above the minimum height and at least 500 ft below the base of controlled
// airspace. Below 3,000 ft AMSL the table applies "whenever practicable" (ENR 1.7 3.1.4, CASR 91.275), so a non-table
// altitude is offered there when no table level fits. Control zones of the aerodromes at either end of the leg are left out
// (you'll be in contact with the tower), and so is the minimum height within 2 NM of the plan's first and last aerodrome.
function legPlan(pr,k){
  const P_=FP.pts, a=P_[k-1], b=P_[k], ss=pr.S.filter(q=>q.leg===k); if(!ss.length) return null;
  const mid=[(a.la+b.la)/2,(a.lo+b.lo)/2], trk=norm(distBrg(a.la,a.lo,b.la,b.lo)[1]-variation(mid[0],mid[1])), east=trk<180;
  const ends=[fpAd(a),fpAd(b)].filter(Boolean), endW=ends.map(x=>callName(x.n).split(' ')[0].toUpperCase()+' ');
  const exempt=[k===1?fpAd(P_[0]):null, k===P_.length-1?fpAd(P_[P_.length-1]):null].filter(Boolean);
  let need=null, needQ=null, base=null, baseQ=null, eBase=null, unknown=0; const zones=new Set();
  let hard=null;   // a single point where the minimum height is above the airspace limit right there
  for(const q of ss){
    const ex=exempt.some(e=>distBrg(q.la,q.lo,e.la,e.lo)[0]<2);
    if(!ex){ if(q.need==null) unknown++; else if(need==null||q.need>need){ need=q.need; needQ=q; } }
    let qb=null; for(const z of q.b){ if(z.k==='E') continue; if((z.k==='D'||z.k==='C') && z.L<=0 && endW.some(w=>z.n.startsWith(w))) continue; if(qb==null||z.L<qb) qb=z.L; }
    if(!ex && q.need!=null && qb!=null && q.need>qb-CTA_BUF && (!hard||q.need-(qb-CTA_BUF)>hard.over)) hard={q,over:q.need-(qb-CTA_BUF),cap:qb};
    for(const z of q.b){ if((z.k==='D'||z.k==='C') && z.L<=0 && endW.some(w=>z.n.startsWith(w))){ zones.add(z.n); continue; }
      if(z.k==='E'){ if(eBase==null||z.L<eBase) eBase=z.L; continue; }          // class E: VFR needs no clearance
      if(base==null||z.L<base){ base=z.L; baseQ=q; } } }
  const minA=need==null?null:Math.ceil(need/100)*100, maxA=base==null?null:base-CTA_BUF;
  const table=east?[1500,3500,5500,7500,9500]:[2500,4500,6500,8500];
  let alt=null, kind;
  const fits=v=>(minA==null||v>=minA)&&(maxA==null||v<=maxA);
  const lvl=table.find(fits);
  if(lvl!=null){ alt=lvl; kind='level'; }
  else if(minA!=null && maxA!=null && minA<3000 && Math.min(maxA,2900)>=minA){   // at 3,000 ft AMSL or more the table is mandatory
    alt=Math.min(maxA,2900,Math.max(minA,Math.ceil(minA/500)*500)); kind='low'; }
  else if(minA!=null && maxA!=null && maxA>=minA){ kind='nolevel'; }
  else if(minA!=null && maxA!=null){ kind= hard? 'conflict' : 'split'; }
  else { kind='none'; }
  const entry=ends.filter(e=>e.keys&&(e.keys.entry||e.keys.hel)&&[...zones].some(n=>n.startsWith(callName(e.n).split(' ')[0].toUpperCase()+' '))).map(e=>({i:e.i,entry:e.keys.entry,hel:e.keys.hel}));
  return {k,trk,east,need,needQ,minA,base,baseQ,maxA,alt,kind,zones:[...zones],entry,unknown,exempt:exempt.map(e=>e.i),hard, legStart:pr.cum[k-1], inE:eBase!=null&&alt!=null&&alt>=eBase?eBase:null,
    belowE: eBase!=null&&alt!=null&&alt>=eBase&&minA!=null&&minA<3000&&Math.min(eBase-CTA_BUF,2900)>=minA ? Math.floor(Math.min(eBase-CTA_BUF,2900)/100)*100 : null};
}
function legAltTxt(lp){ if(!lp) return ''; return lp.alt!=null? lp.alt.toLocaleString('en-AU') : lp.kind==='conflict'||lp.kind==='nolevel'? '!' : lp.kind==='split'? 'split' : '—'; }
function legAltNote(lp){
  if(!lp) return ''; const f=v=>Math.round(v).toLocaleString('en-AU')+' ft';
  const hemi=`track ${fmt3(lp.trk)}°M, ${lp.east?'east: 1,500 / 3,500 / 5,500…':'west: 2,500 / 4,500 / 6,500…'}`;
  const why=lp.needQ? `min ${f(lp.minA)} (terrain ${f(lp.needQ.tr)} + ${lp.needQ.u?'1,000 over '+esc(titleCase(lp.needQ.u)):'500'})` : 'min height unknown (no terrain)';
  const cap=(lp.base!=null&&lp.base>=18000? `no class C/D below ${limTxt(lp.base)}` : lp.base!=null? `below the ${limTxt(lp.base)} C/D/A base with ${CTA_BUF} ft buffer (max ${f(lp.maxA)})` : 'no C/D/A airspace above')+(lp.inE!=null?` · in class E above ${limTxt(lp.inE)} (no clearance needed; transponder on)${lp.belowE!=null?`, or ${f(lp.belowE)} to stay below the E (not a table level; allowed below 3,000 ft)`:''}`:'');
  let head;
  if(lp.kind==='level') head=`Suggested <b>${f(lp.alt)}</b>`;
  else if(lp.kind==='low') head=`Suggested <b>${f(lp.alt)}</b> <span class="w">(no table level fits below the airspace; below 3,000 ft the table applies only when practicable)</span>`;
  else if(lp.kind==='nolevel') head=`<span class="w"><b>No VFR level fits</b> between ${f(lp.minA)} and ${f(lp.maxA)}: get a clearance or change the route</span>`;
  else if(lp.kind==='conflict') head=`<span class="w"><b>At ${(lp.hard.q.x-lp.legStart).toFixed(1)} NM along the leg${lp.hard.q.u?' ('+esc(titleCase(lp.hard.q.u))+')':''} the minimum height ${f(lp.hard.q.need)} is above ${f(lp.hard.cap-CTA_BUF)} (${limTxt(lp.hard.cap)} base less buffer)</b>: get a clearance or change the route</span>`;
  else if(lp.kind==='split') head=`<span class="w"><b>No single altitude fits the whole leg</b>: ${f(lp.minA)} needed at ${(lp.needQ.x-lp.legStart).toFixed(1)} NM${lp.needQ.u?' ('+esc(titleCase(lp.needQ.u))+')':''}, but max ${f(lp.maxA)} under the ${limTxt(lp.base)} base at ${(lp.baseQ.x-lp.legStart).toFixed(1)} NM. Add a waypoint between them and change level there.</span>`;
  else head='Suggested level unavailable';
  const heli=$('cCat').value==='H';
  const z=lp.zones.length? ` · ${lp.zones.map(n=>esc(titleCase(n))).join(', ')}: with tower clearance${lp.entry.map(e=>` (ERSA ${e.i}: ${heli&&e.hel?'helicopters '+esc(e.hel):'CTR entry '+esc(e.entry||'')})`).join('')}` : '';
  const ex=lp.exempt.length? ` · climb/descent within 2 NM of ${lp.exempt.join('/')} not counted` : '';
  return `${head} · ${hemi} · ${why} · ${cap}${z}${ex}`;
}
/* ABS urban centres and localities (populous areas for CASR 91.265), from data.json "urb" */
const URB=(DATA.urb||[]).map(([n,c,bb,rings])=>({n,c,bb:bb.map(v=>v/1e4),r:rings.map(f=>{ const o=[]; for(let i=0;i<f.length;i+=2) o.push([f[i]/1e4,f[i+1]/1e4]); return o; })}));
// towns: one point per ABS urban centre / locality (area centroid of its largest part); used for search and map labels
const TOWNS=URB.map(u=>{ let best=null,ba=-1; for(const r of u.r){ let A=0,x=0,y=0; for(let i=0,j=r.length-1;i<r.length;j=i++){ const f=r[j][1]*r[i][0]-r[i][1]*r[j][0]; A+=f; x+=(r[j][1]+r[i][1])*f; y+=(r[j][0]+r[i][0])*f; }
    if(Math.abs(A)>ba){ ba=Math.abs(A); best=A? [y/(3*A), x/(3*A)] : [r[0][0],r[0][1]]; } }
  const n=u.n.replace(/\s*\([^)]*\)\s*$/,'').trim(); return {k:'TOWN',c:n.toUpperCase(),n,t:u.c,la:best[0],lo:best[1],area:ba}; });
// suburbs: ABS suburbs and localities (data.json "sal"), t:'S'; skipped where a town of the same name is within 5 NM
//  ("Ocean Grove" is dropped next to the town "Ocean Grove - Barwon Heads")
(()=>{ const near=new Map(); for(const t of TOWNS) for(const k of [t.c,...t.c.split(' - ')]){ if(!near.has(k)) near.set(k,[]); near.get(k).push(t); }
  for(const [n,a,b,ste] of (DATA.sal||[])){ const la=a/1e4, lo=b/1e4, c=n.toUpperCase();
    if((near.get(c)||[]).some(t=>Math.abs(t.la-la)<0.1&&distBrg(t.la,t.lo,la,lo)[0]<5)) continue;
    TOWNS.push({k:'TOWN',c,n,t:'S',ste:ste||'',la,lo,area:0}); } })();
/* fuzzy search over aerodromes, VFR waypoints, navaids, towns and IFR waypoints */
function lev(a,b,max){ if(Math.abs(a.length-b.length)>max) return max+1; let p=Array.from({length:b.length+1},(_,j)=>j);
  for(let i=1;i<=a.length;i++){ const c=[i]; let m=i; for(let j=1;j<=b.length;j++){ c[j]=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1)); m=Math.min(m,c[j]); } if(m>max) return max+1; p=c; } return p[b.length]; }
const FZ=new Map();
function fuzzy(q,s,lite){ if(!s) return 0; if(s===q) return 100; if(s.startsWith(q)) return 92-Math.min(12,(s.length-q.length)/2);
  const k=FZ.get(s)||(FZ.set(s,{c:s.indexOf(' ')>0?s.replace(/ /g,''):null,w:s.split(/[\s\/\-()]+/)}),FZ.get(s));   // per-string work, done once
  if(k.c){ const c=k.c; if(c===q) return 98; if(q.length>=4&&c.startsWith(q)) return 88-Math.min(12,(c.length-q.length)/2); }   // typed without spaces: STKILDA
  const w=k.w; if(w.some(x=>x.startsWith(q))) return 78; if(s.includes(q)) return 64;
  if(q.length>=4){ const L=x=>x[0]===q[0]||x[1]===q[1]? lev(q,x.slice(0,q.length+1),2) : 3;   // a typo rarely hits both of the first two letters
    let e=L(s); for(const x of w) if(e>1) e=Math.min(e,L(x)); if(e<=1) return 56; if(e===2&&q.length>=6) return 44; }
  if(q.length>=3&&!lite){ let i=0; for(const ch of s) if(ch===q[i]) i++; if(i===q.length) return 36; }   // letters in order: suburbs skip this (too many)
  return 0; }
let SEARCH=null;
function searchIdx(){ if(SEARCH) return SEARCH; SEARCH=[];
  for(const a of DATA.ap){ if(a.t==='H'&&!st.heli) continue; SEARCH.push({p:{k:'AD',c:a.i,n:a.n,la:a.la,lo:a.lo},keys:[a.i,a.n.toUpperCase(),...a.n.toUpperCase().split('/')],w:4}); }
  for(const p of VW) SEARCH.push({p,keys:[p.c,p.n.toUpperCase()],w:3});
  for(const p of NA) SEARCH.push({p,keys:[p.c,(p.n||'').toUpperCase()],w:2});
  for(const p of TOWNS) SEARCH.push({p,keys:p.t==='S'?[p.c]:[p.c,...p.c.split(' - ')],w:p.t==='S'?0.5:p.t==='L'?1:2.5,lite:p.t==='S'});   // "Ocean Grove - Barwon Heads" matches either
  for(const w of (DATA.iw||[])) SEARCH.push({p:{k:'IFR',c:w[0],n:'IFR waypoint',la:w[1],lo:w[2]},keys:[w[0]],w:0});
  return SEARCH; }
function searchPoints(q,n=8){ q=q.trim().toUpperCase(); if(!q) return [];
  const ref=st.pos||(GO?[GO.la,GO.lo]:[-37.8,145]), out=[];
  for(const it of searchIdx()){ let sc=0; for(const k of it.keys){ const v=fuzzy(q,k,it.lite); if(v>sc) sc=v; } if(sc<36) continue;
    const d=distBrg(ref[0],ref[1],it.p.la,it.p.lo)[0]; out.push({p:it.p,sc:sc+it.w-Math.min(15,d/30),d}); }
  out.sort((a,b)=>b.sc-a.sc||a.d-b.d);
  const seen=new Set(); return out.filter(o=>{ const k=o.p.k+o.p.c+o.p.la.toFixed(3); if(seen.has(k)) return false; seen.add(k); return true; }).slice(0,n); }
function suggest(inp,list,pick){ // dropdown under an input: type to search, tap or Enter to choose, Esc to close
  let res=[], on=0; const varE=()=>st.pos?variation(st.pos[0],st.pos[1]):0;
  const show=()=>{ const q=inp.value; res=/^[-\d\s.,°'"NSEW]+$/i.test(q)&&/\d/.test(q)? [] : searchPoints(q); on=0;
    if(!res.length||document.activeElement!==inp){ list.hidden=true; return; }
    list.innerHTML=res.map((o,i)=>{ const b=st.pos?distBrg(st.pos[0],st.pos[1],o.p.la,o.p.lo):null;
      return `<li data-i="${i}" class="${i===on?'on':''}"><span class="t">${o.p.k==='AD'?'AD':o.p.k==='VFR'?'VFR':o.p.k==='NAV'?esc(o.p.t||'NAV'):o.p.k==='TOWN'?(o.p.t==='S'?'Suburb':'Town'):'IFR'}</span><span><b>${esc(o.p.k==='TOWN'?o.p.n:o.p.c)}</b> <span class="n">${o.p.k==='TOWN'?esc(o.p.ste||''):esc(titleCase(o.p.n||''))}</span></span><span class="d">${b?(b[0]<10?b[0].toFixed(1):Math.round(b[0]))+' NM '+fmt3(b[1]-varE())+'°':''}</span></li>`; }).join('');
    list.hidden=false; };
  const choose=i=>{ const o=res[i]; if(!o) return false; list.hidden=true; pick(o.p); return true; };
  inp.addEventListener('input',show); inp.addEventListener('focus',show);
  inp.addEventListener('blur',()=>setTimeout(()=>{ list.hidden=true; },200));
  inp.addEventListener('keydown',e=>{ if(list.hidden) return;
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){ e.preventDefault(); on=(on+(e.key==='ArrowDown'?1:res.length-1))%res.length; [...list.children].forEach((li,i)=>li.classList.toggle('on',i===on)); }
    else if(e.key==='Enter'){ if(choose(on)){ e.preventDefault(); e.stopImmediatePropagation(); } }
    else if(e.key==='Escape') list.hidden=true; },true);
  list.addEventListener('pointerdown',e=>{ const li=e.target.closest('li'); if(li){ e.preventDefault(); choose(+li.dataset.i); } });
}
function urbanAt(la,lo){ for(const u of URB){ const b=u.bb; if(la<b[0]||la>b[1]||lo<b[2]||lo>b[3]) continue; if(u.r.some(r=>inRing(la,lo,r))) return u; } return null; }
function profAlong(){ // your distance along the plan (projected onto the active leg)
  if(!st.pos||!FP||!PROF) return null; const i=FP.i, P_=FP.pts;
  if(i===0) return distBrg(st.pos[0],st.pos[1],P_[0].la,P_[0].lo)[0]<5? 0 : null;
  const a=P_[i-1], b=P_[i], [dap]=distBrg(a.la,a.lo,st.pos[0],st.pos[1]), xt=xte(st.pos[0],st.pos[1],a,b);
  if(Math.abs(xt)>5) return null;   // well off the route: don't pretend you're on the profile
  const along=Math.sqrt(Math.max(0,dap*dap-xt*xt)), L=PROF.cum[i]-PROF.cum[i-1];
  const bh=Math.abs(((distBrg(a.la,a.lo,st.pos[0],st.pos[1])[1]-distBrg(a.la,a.lo,b.la,b.lo)[1]+540)%360)-180)>90;
  return PROF.cum[i-1]+Math.max(0,Math.min(L, bh?0:along));
}
function legName(k){ const P_=FP.pts; return `${P_[k-1].c||P_[k-1].n}→${P_[k].c||P_[k].n}`; }
function drawProf(){
  const cv=$('fpProf'); if(!FP||$('fpBody').hidden||FP.pts.length<2) return;
  const W=cv.clientWidth, H=cv.clientHeight; if(!W||!H) return;
  profEnsure();
  const pr=PROF, S=pr.S, dpr=window.devicePixelRatio||1;
  if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(H*dpr)){ cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr); }
  const g=cv.getContext('2d'); g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,W,H);
  const C={ink:cssv('--ink'),dim:cssv('--dim'),rule:cssv('--rule'),acc:cssv('--accent'),warn:cssv('--warn'),wp:cssv('--wp'),
    C:cssv('--as-c'),A:cssv('--as-c'),D:cssv('--as-d'),E:cssv('--as-e'),R:cssv('--as-r'),Q:cssv('--as-q')};
  const maxT=Math.max(0,...S.map(q=>q.t||0)), alt=st.alt;
  let top=Math.max(maxT+1500, alt!=null?alt+1000:0, 3000);
  if(pr.lo && pr.lo.base<12000) top=Math.max(top,pr.lo.base+1500);
  top=Math.min(Math.ceil(top/1000)*1000, 15000);
  PROF.auto=top; if(PROF_TOP) top=PROF_TOP;      // altitude zoom: fixed top chosen with +/−
  $('profTop').textContent=(PROF_TOP?'':'auto ')+(top>=1000?(top/1000)+'k':top)+' ft'; $('profAuto').hidden=!PROF_TOP;
  const l=34, r=8, t=16, b=16, x=d=>l+(pr.total?d/pr.total:0)*(W-l-r), y=f=>t+(1-Math.min(f,top)/top)*(H-t-b);
  // altitude grid
  const gs=top>12000?5000:top>8000?2000:top>3000?1000:500; g.font='10px '+cssv('--f-mono'); g.textBaseline='middle'; g.textAlign='right';
  for(let f=0;f<=top;f+=gs){ g.strokeStyle=C.rule; g.lineWidth=1; g.beginPath(); g.moveTo(l,y(f)); g.lineTo(W-r,y(f)); g.stroke();
    g.fillStyle=C.dim; g.fillText(f?(f>=1000?(f/1000)+'k':f):'0',l-4,y(f)); }
  // anything above the top of the chart: mark it so a zoomed-in view doesn't hide terrain or your altitude
  if(maxT>top){ g.fillStyle=C.warn; g.font='600 10px '+cssv('--f-mono'); g.textAlign='left'; g.fillText('terrain above '+(top/1000)+'k ▲',l+4,t+10); g.textAlign='right'; }
  // controlled airspace and restricted/danger areas: one column per sample, base edge drawn solid
  for(let i=0;i<S.length;i++){ const q=S[i], x0=x(i?(S[i-1].x+q.x)/2:q.x), x1=x(i<S.length-1?(q.x+S[i+1].x)/2:q.x), w=Math.max(1,x1-x0);
    for(const a of q.b.concat(q.p)){ if(a.L>=top) continue; const c=C[a.k]||C.C;
      g.globalAlpha=a.k==='R'||a.k==='Q'?.16:.13; g.fillStyle=c; g.fillRect(x0,y(a.H),w,y(a.L)-y(a.H));
      g.globalAlpha=.9; g.fillRect(x0,y(a.L)-1,w,2); }
    g.globalAlpha=1; }
  // terrain
  g.fillStyle=PROF_TERR; g.globalAlpha=.75; g.beginPath(); g.moveTo(x(0),y(0));
  for(const q of S) g.lineTo(x(q.x),y(q.t||0)); g.lineTo(x(pr.total),y(0)); g.closePath(); g.fill(); g.globalAlpha=1;
  // terrain within 1,000 ft of the airspace base: red under the base line
  g.fillStyle=C.warn;
  for(let i=0;i<S.length;i++){ const q=S[i]; if(q.t==null||q.base==null||q.base<=0||q.base-q.t>=1000) continue;
    const x0=x(i?(S[i-1].x+q.x)/2:q.x), x1=x(i<S.length-1?(q.x+S[i+1].x)/2:q.x); g.fillRect(x0,y(q.base)-1.5,Math.max(1,x1-x0),3); }
  // waypoints
  const P_=FP.pts; g.textAlign='center'; g.textBaseline='alphabetic';
  P_.forEach((p,k)=>{ const X=x(pr.cum[k]), on=k===FP.i; g.strokeStyle=on?C.wp:C.dim; g.globalAlpha=on?.9:.45; g.setLineDash([2,3]);
    g.beginPath(); g.moveTo(X,t); g.lineTo(X,H-b); g.stroke(); g.setLineDash([]); g.globalAlpha=1; });
  // labels: active waypoint first, then start and end, then the rest left to right, skipping any that would overlap
  const order=[FP.i,0,P_.length-1,...P_.map((_,k)=>k)].filter((k,j,a)=>a.indexOf(k)===j), placed=[];
  for(const k of order){ const p=P_[k], on=k===FP.i; g.font=(on?'600 ':'')+'10px '+cssv('--f-mono');
    const lab=(p.c||p.n||'').slice(0,5), wdt=g.measureText(lab).width, LX=Math.min(W-r-wdt/2,Math.max(l+wdt/2,x(pr.cum[k])));
    if(placed.some(q=>LX+wdt/2+4>q[0]&&LX-wdt/2-4<q[1])) continue; placed.push([LX-wdt/2,LX+wdt/2]);
    g.fillStyle=on?C.wp:C.ink; g.fillText(lab,LX,t-4); }
  g.font='10px '+cssv('--f-mono'); g.fillStyle=C.dim; g.textAlign='right'; g.fillText(Math.round(pr.total)+' NM',W-r,H-4);
  g.textAlign='left'; g.fillText('ft AMSL',l+2,H-4);
  // populous areas along the route: strip along the bottom
  g.fillStyle=C.ink; g.globalAlpha=.35;
  for(let i=0;i<S.length;i++){ const q=S[i]; if(!q.u) continue; const x0=x(i?(S[i-1].x+q.x)/2:q.x), x1=x(i<S.length-1?(q.x+S[i+1].x)/2:q.x); g.fillRect(x0,y(0)-4,Math.max(1,x1-x0),4); }
  g.globalAlpha=1;
  // minimum height (thin dashed) and suggested VFR level per leg (solid)
  g.strokeStyle=C.warn; g.lineWidth=1; g.setLineDash([3,3]); g.beginPath(); let on=false;
  for(const q of S){ if(q.need==null){ on=false; continue; } const X=x(q.x), Y=y(q.need); if(on) g.lineTo(X,Y); else { g.moveTo(X,Y); on=true; } }
  g.stroke(); g.setLineDash([]);
  for(const lp of (pr.legs||[])){ if(!lp||lp.alt==null) continue; const X0=x(pr.cum[lp.k-1]), X1=x(pr.cum[lp.k]), Y=y(lp.alt);
    g.strokeStyle=C.wp; g.lineWidth=2.5; g.beginPath(); g.moveTo(X0,Y); g.lineTo(X1,Y); g.stroke();
    if(X1-X0>34 && lp.alt<=top){ g.fillStyle=C.wp; g.font='600 9.5px '+cssv('--f-mono'); g.textAlign='center'; g.fillText(String(lp.alt),(X0+X1)/2,Y-4); } }
  // you: position along the plan and GPS altitude
  const al=profAlong();
  if(al!=null){ const X=x(al); g.strokeStyle=C.acc; g.lineWidth=2; g.beginPath(); g.moveTo(X,t); g.lineTo(X,H-b); g.stroke();
    if(alt!=null){ g.fillStyle=C.acc; g.beginPath(); g.arc(X,y(alt),4.5,0,7); g.fill(); g.strokeStyle=C.ink; g.lineWidth=1; g.stroke(); } }
  // tapped point
  let sel=null;
  if(profSel!=null){ sel=S.reduce((m,q)=>Math.abs(q.x-profSel)<Math.abs(m.x-profSel)?q:m,S[0]);
    const X=x(sel.x); g.strokeStyle=C.ink; g.lineWidth=1; g.setLineDash([4,3]); g.beginPath(); g.moveTo(X,t); g.lineTo(X,H-b); g.stroke(); g.setLineDash([]); }
  // text
  const ft=v=>Math.round(v/10)*10, nm=v=>v<10?v.toFixed(1):Math.round(v);
  let tx='';
  if(sel){ const parts=sel.b.concat(sel.p).sort((a,c)=>a.L-c.L).map(a=>`${a.k==='R'?'R':a.k==='Q'?'Danger':a.k} ${limTxt(a.L)}–${limTxt(a.H)}`);
    tx=`<b>${nm(sel.x)} NM</b> · ${esc(legName(sel.leg))} · terrain <b>${sel.t==null?'—':ft(sel.t).toLocaleString('en-AU')+' ft'}</b> · ${parts.length?'above: '+esc(parts.slice(0,4).join(', ')):'class G to the top of the chart'}<br>`; }
  if(!TER.ok) tx+='<span class="w">SRTM terrain not installed: airspace only.</span> ';
  else if(pr.missing) tx+=`Loading terrain… `;
  if(pr.hi&&pr.hi.t!=null) tx+=`Highest terrain <b>${ft(pr.hi.t).toLocaleString('en-AU')} ft</b> at ${nm(pr.hi.x)} NM (${esc(legName(pr.hi.leg))}). `;
  if(pr.lo) tx+=`Lowest controlled airspace <b>${limTxt(pr.lo.base)}</b> at ${nm(pr.lo.x)} NM. `;
  if(pr.tight) tx+=`<span class="w">Terrain within ${ft(pr.tight.base-pr.tight.t).toLocaleString('en-AU')} ft of the ${limTxt(pr.tight.base)} base at ${nm(pr.tight.x)} NM (${esc(legName(pr.tight.leg))}).</span> `;
  for(const z of pr.zones) tx+=`Crosses <b>${esc(titleCase(z.n))}</b>${/\(/.test(z.n)?"":" ("+z.k+")"} SFC–${limTxt(z.H)} at ${nm(z.x)} NM. `;
  tx+=`Purple: suggested VFR level per leg (ENR 1.7 Table B by magnetic track, ${CTA_BUF} ft below class C/D; class E needs no clearance). Red dashed: minimum height from terrain (CASR 91.265/91.267: 1,000 ft over populous areas${URB.length?' (ABS urban areas, grey strip)':' — urban areas not loaded, so 500 ft used everywhere'}, else 500 ft; radius for ${$('cCat').value==='H'?'helicopters':'aeroplanes'} as set in Radio calls). Obstacles such as masts and buildings are not included: check the VTC/VNC. `;
  tx+='Colours as on the airspace map; red line: terrain within 1,000 ft of the base above it. Terrain is the highest SRTM point per 30″ cell; airspace is from the DAH along the straight legs. Tap for details.';
  $('fpPInfo').innerHTML=tx;
}
$('ctaBuf').value=String(CTA_BUF); $('ctaBuf').onchange=()=>{ CTA_BUF=+$('ctaBuf').value; ls.set('ctaBuf',CTA_BUF); PROF=null; render(); };
$('cCat').addEventListener('change',()=>{ PROF=null; });
$('profIn').onclick=()=>profZoom(-1); $('profOut').onclick=()=>profZoom(1);
$('profAuto').onclick=()=>{ PROF_TOP=null; ls.set('profTop',null); drawProf(); };
$('fpProf').addEventListener('click',e=>{ if(!PROF) return; const cv=$('fpProf'), rc=cv.getBoundingClientRect(), l=34, r=8;
  const d=(e.clientX-rc.left-l)/(rc.width-l-r)*PROF.total; profSel = profSel!=null&&Math.abs(profSel-d)<PROF.total/80 ? null : Math.max(0,Math.min(PROF.total,d)); drawProf(); });
function renderFP(h,varE){
  $('fpBody').hidden=!FP||$('fpToggle').getAttribute('aria-expanded')==='false'; $('fpImport').textContent=FP?'New GPX':'Import GPX';
  if(!FP){ $('fpSum').textContent='none loaded'; return; }
  const P_=FP.pts, i=FP.i, nx=P_[i], here=st.pos;
  let dNext=null,bNext=null,rem=0;
  if(here&&nx){ [dNext,bNext]=distBrg(here[0],here[1],nx.la,nx.lo); rem=dNext; for(let k=i;k<P_.length-1;k++) rem+=distBrg(P_[k].la,P_[k].lo,P_[k+1].la,P_[k+1].lo)[0]; }
  const gs=st.gs||0, ete=m=>gs>20&&m!=null? (m/gs*60<90? Math.round(m/gs*60)+' min' : (m/gs).toFixed(1)+' h') : '—';
  const xt = here&&i>0 ? xte(here[0],here[1],P_[i-1],nx) : null;
  const legT = i>0 ? fmt3(distBrg(P_[i-1].la,P_[i-1].lo,nx.la,nx.lo)[1]-varE) : null;
  $('fpSum').textContent=`${FP.name} · ${i+1}/${P_.length}${nx?' → '+(nx.c||nx.n):''}`;
  $('fpNext').innerHTML=nx&&here?`<div><small>Next ${i+1}/${P_.length}</small><b>${esc(nx.c||nx.n)}</b></div><div><small>°M · NM</small><b>${fmt3(bNext-varE)} ${dNext<10?dNext.toFixed(1):Math.round(dNext)}</b></div><div><small>XTE</small><b>${xt==null?'—':Math.abs(xt).toFixed(1)+(Math.abs(xt)<0.05?'':xt>0?'R':'L')}</b></div><div><small>ETE</small><b>${ete(dNext)}</b></div><p class="fp-line">${legT?'Leg course '+legT+'°M · ':''}${rem<10?rem.toFixed(1):Math.round(rem)} NM to go${gs>20?' · total '+ete(rem):''}</p>`:'';
  profEnsure();
  const lpA=PROF&&PROF.legs&&i>0?PROF.legs[i]:null;
  if(lpA && $('fpNext').innerHTML) $('fpNext').insertAdjacentHTML('beforeend',`<p class="fp-line fp-alt">${legAltNote(lpA)}</p>`);
  drawProf();
  $('fpLegs').innerHTML=P_.map((p,k)=>{ const leg=k>0?distBrg(P_[k-1].la,P_[k-1].lo,p.la,p.lo):null; const lp=PROF&&PROF.legs?PROF.legs[k]:null;
    return `<li class="${k<i?'done':k===i?'on':''}" data-k="${k}"><span class="n">${k+1}</span><span class="w"><b>${esc(p.c||p.n)}</b> <span>${esc(p.desc||(p.c?'':''))}</span></span><span class="m">${leg?fmt3(leg[1]-varE)+'°':''}</span><span class="m">${leg?leg[0].toFixed(1)+' NM':''}</span><span class="m alt ${lp?'k-'+lp.kind:''}" title="Suggested VFR altitude for this leg">${legAltTxt(lp)}</span></li>`; }).join('');
}


function setGo(p){ GO=p?{k:p.k,c:p.c,n:p.n,la:p.la,lo:p.lo,t:p.t,f:p.f}:null; ls.set('goto',GO); $('goIn').value=GO?GO.c:''; $('goErr').hidden=true; render(); }
function renderGo(h,varE){
  $('goClr').hidden=!GO; $('goRes').hidden=!GO||!st.pos;
  if(!GO||!st.pos) return;
  const [d,b]=distBrg(st.pos[0],st.pos[1],GO.la,GO.lo);
  $('goName').textContent=GO.c; $('goSub').textContent=ptDesc(GO);
  $('goDist').textContent=(d<10?d.toFixed(1):Math.round(d))+' NM'; $('goBrg').textContent=fmt3(b-varE)+'°M';
  $('goArrow').style.transform=`rotate(${h?b-h.deg:b}deg)`;
}

/* ---------- runways: list + mini aerodrome map ---------- */
const SURF={a:'sealed',b:'concrete',c:'gravel/grass'};
function rwLabel(a){ return (a.rw||[]).map(r=>r[0]+'/'+r[1]); }
function renderRunways(a,pick,h){
  const box=$('rwBox'); if(!a.rw||!a.rw.length){ box.hidden=true; return; } box.hidden=false;
  const cc=a.cct||{};
  const end=d=>{ const c=cc[d]; return c&&c[0]==='R' ? `<span class="rh" title="${esc(c[1])}">${d}&nbsp;RH</span>` : ''; };
  const sch=a.rw.some(r=>r[10]), appx=a.rw.some(r=>r[10]===2);
  $('rwList').innerHTML=a.rw.map(r=>{
    const rh=[end(r[0]),end(r[1])].filter(Boolean).join(' ');
    return `<div class="rw" title="${r[8]?r[8]+' m wide':''}"><b>${r[0]}/${r[1]}</b><span>${r[6]?r[6].toLocaleString('en-AU')+' m':''}${r[7]?' '+SURF[r[7]]:''}</span>${rh}</div>`;
  }).join('') + `<div class="rwnote">${chip(a.rw.every(r=>r[9]==='DAH')?'DAH':a.rw.some(r=>r[9]==='DAH')?'DAH':'ERSA')} ${a.rw.some(r=>r[9]==='DAH')?'Thresholds from DAH. ':''}${sch?(appx?'Drawn from the ERSA designator heading and length (schematic, position approximate). ':'Drawn from the ERSA bearing and length (schematic). '):''}${a.rw.some(r=>!r[6])?'ERSA gives no length for '+a.rw.filter(r=>!r[6]).map(r=>r[0]+'/'+r[1]).join(', ')+' (drawn 600 m). ':'Lengths and surface from ERSA. '}${Object.keys(cc).length?'RH = right-hand circuit per ERSA (tap for conditions); other circuits left-hand unless ERSA says otherwise.':'Circuits left-hand unless ERSA says otherwise.'}</div>`;
  drawAdMap(a,pick,h);
}
function drawAdMap(a,pick,h){
  const cv=$('adMap'); const W=cv.clientWidth, H=cv.clientHeight; if(!W||!H) return;
  const dpr=window.devicePixelRatio||1; if(cv.width!==Math.round(W*dpr)){ cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr); }
  const g=cv.getContext('2d'); g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,W,H);
  const C={ink:cssv('--ink'),dim:cssv('--dim'),acc:cssv('--accent'),fr:cssv('--freq'),bg:cssv('--panel'),rule:cssv('--rule')};
  const la0=a.la, lo0=a.lo, cosl=Math.cos(la0*R);
  const rot = MAP.up==='trk'&&h ? h.deg : 0, cr=Math.cos(-rot*R), sr=Math.sin(-rot*R);
  // metres from ARP
  const xy=(la,lo)=>{ const x=(lo-lo0)*cosl*111320, y=(la-la0)*110540; return [x*cr-y*sr, x*sr+y*cr]; };
  const ends=a.rw.map(r=>[xy(r[2],r[3]),xy(r[4],r[5])]);
  let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9; for(const [p,q] of ends) for(const v of [p,q]){ x0=Math.min(x0,v[0]);x1=Math.max(x1,v[0]);y0=Math.min(y0,v[1]);y1=Math.max(y1,v[1]); }
  const mx=(x0+x1)/2, my=(y0+y1)/2, ext=Math.max(150,(x1-x0)/2/(W/H>1?W/H:1),(y1-y0)/2);
  const sc=(H/2-26)/ext, cx=W/2, cy=H/2, S=v=>[cx+(v[0]-mx)*sc, cy-(v[1]-my)*sc];
  const placed=[];
  // runways (labels drawn after all runways so they sit on top)
  const pend=[];
  a.rw.forEach((r,i)=>{ const [p,q]=ends[i].map(S);
    g.lineCap='butt'; g.strokeStyle=r[10]?C.dim:C.ink; g.lineWidth=Math.max(4,(r[8]||20)*sc*1.6);
    if(r[10]){ g.setLineDash([6,3]); } g.beginPath(); g.moveTo(p[0],p[1]); g.lineTo(q[0],q[1]); g.stroke(); g.setLineDash([]);
    // designators just beyond each end (label sits at the threshold you land on)
    const dx=q[0]-p[0], dy=q[1]-p[1], L=Math.hypot(dx,dy)||1, ux=dx/L, uy=dy/L;
    g.font='700 10px "IBM Plex Mono", monospace'; g.textAlign='center'; g.textBaseline='middle';
    const lab=(d,x,y,sx,sy)=>{ const rh=(a.cct||{})[d]&&(a.cct||{})[d][0]==='R'; const tw=g.measureText(d).width+4;
      for(let k=0;k<5;k++){ const bx=[x-tw/2,y-6,tw,12]; if(!placed.some(b=>!(bx[0]>b[0]+b[2]||bx[0]+bx[2]<b[0]||bx[1]>b[1]+b[3]||bx[1]+bx[3]<b[1]))){ placed.push(bx); break; } x+=sx*9; y+=sy*9; }
      g.fillStyle=C.bg; g.globalAlpha=.85; g.fillRect(x-tw/2,y-6,tw,12); g.globalAlpha=1; g.fillStyle=rh?C.acc:C.ink; g.fillText(d,x,y); };
    pend.push(()=>{ lab(r[0],p[0]-ux*12,p[1]-uy*12,-ux,-uy); lab(r[1],q[0]+ux*12,q[1]+uy*12,ux,uy); });
  });
  pend.forEach(f=>f());
  g.textBaseline='alphabetic';
  // you: inside the diagram if close, otherwise an arrow on the edge pointing in from your side
  const me=xy(st.pos[0],st.pos[1]); let m=S(me); const inside=m[0]>8&&m[0]<W-8&&m[1]>8&&m[1]<H-8;
  if(!inside){ const ang=Math.atan2(-(m[1]-cy),m[0]-cx), c_=Math.cos(ang), s_=Math.sin(ang), r0=Math.min((W/2-10)/Math.max(1e-6,Math.abs(c_)),(H/2-10)/Math.max(1e-6,Math.abs(s_))); m=[cx+c_*r0, cy-s_*r0];
    g.fillStyle=C.dim; g.font='600 9px "IBM Plex Mono", monospace'; g.textAlign='center';
    g.fillText((pick.d<10?pick.d.toFixed(1):Math.round(pick.d))+' NM', m[0]-Math.cos(ang)*22, m[1]+Math.sin(ang)*22+3); }
  g.save(); g.translate(m[0],m[1]); g.rotate(((h?h.deg:0)-rot)*R);
  g.beginPath(); g.moveTo(0,-8); g.lineTo(5,6); g.lineTo(0,3); g.lineTo(-5,6); g.closePath(); g.fillStyle=C.fr; g.strokeStyle=C.bg; g.lineWidth=1.5; g.stroke(); g.fill(); g.restore();
  // north tick + scale
  g.save(); g.translate(W-11,12); g.rotate(-rot*R); g.fillStyle=C.dim; g.beginPath(); g.moveTo(0,-7); g.lineTo(3,-1); g.lineTo(-3,-1); g.closePath(); g.fill(); g.font='700 8px sans-serif'; g.textAlign='center'; g.fillText('N',0,7); g.restore();
  const bar=ext>1500?1000:500, bl=bar*sc; g.strokeStyle=C.dim; g.lineWidth=1.5; g.beginPath(); g.moveTo(6,H-7); g.lineTo(6+bl,H-7); g.stroke();
  g.fillStyle=C.dim; g.font='500 8.5px "IBM Plex Mono", monospace'; g.textAlign='left'; g.fillText(bar+' m',8+bl,H-4);
}

/* ---------- map ---------- */
const MAP={range:ls.get('mapRange',10), up:ls.get('mapUp','trk'), ctaf:ls.get('mapCtaf',false), ter:ls.get('mapTer',true)};
const CTAF_NM=10;           // AIP: CTAF calls are made within 10 NM of the aerodrome
const CTAF_HUES=[210,0,130,275,30,185,320,55,240,160,345,95];
let ctafPal=new Map();       // frequency -> palette slot, kept while the frequency stays in view
function ctafAssign(freqs){  // stable hash slot, bumped to a free slot so frequencies in view never share a colour
  const next=new Map(), used=new Set();
  for(const f of freqs){ if(f==='126.7') continue; if(ctafPal.has(f)&&!used.has(ctafPal.get(f))){ next.set(f,ctafPal.get(f)); used.add(ctafPal.get(f)); } }
  for(const f of freqs){ if(f==='126.7'||next.has(f)) continue;
    let k=Math.round(parseFloat(f)*1000/5)%CTAF_HUES.length; for(let i=0;i<CTAF_HUES.length&&used.has(k);i++) k=(k+1)%CTAF_HUES.length;
    next.set(f,k); used.add(k); }
  ctafPal=next;
}
function ctafColour(f){
  const dark=getComputedStyle(document.documentElement).colorScheme.includes('dark');
  if(f==='126.7') return dark?'hsl(210 12% 62%)':'hsl(210 12% 45%)';   // AIP default: neutral so specific CTAFs stand out
  const h=CTAF_HUES[ctafPal.get(f)??0];
  return `hsl(${h} ${dark?80:72}% ${dark?62:42}%)`;
}
let ctafOff=null;
function cssv(n){ return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
function clipRect(pts,W,H){ // Sutherland-Hodgman against [0,W]x[0,H]
  const edges=[[p=>p[0]>=0,(a,b)=>{const t=(0-a[0])/(b[0]-a[0]);return[0,a[1]+t*(b[1]-a[1])]}],
               [p=>p[0]<=W,(a,b)=>{const t=(W-a[0])/(b[0]-a[0]);return[W,a[1]+t*(b[1]-a[1])]}],
               [p=>p[1]>=0,(a,b)=>{const t=(0-a[1])/(b[1]-a[1]);return[a[0]+t*(b[0]-a[0]),0]}],
               [p=>p[1]<=H,(a,b)=>{const t=(H-a[1])/(b[1]-a[1]);return[a[0]+t*(b[0]-a[0]),H]}]];
  let out=pts;
  for(const [ins,isect] of edges){ const inp=out; out=[]; if(!inp.length) break;
    for(let i=0;i<inp.length;i++){ const cur=inp[i], prev=inp[(i+inp.length-1)%inp.length];
      if(ins(cur)){ if(!ins(prev)) out.push(isect(prev,cur)); out.push(cur); } else if(ins(prev)) out.push(isect(prev,cur)); } }
  return out;
}
function polyCentroid(p){ let A=0,x=0,y=0; for(let i=0,j=p.length-1;i<p.length;j=i++){ const f=p[j][0]*p[i][1]-p[i][0]*p[j][1]; A+=f; x+=(p[j][0]+p[i][0])*f; y+=(p[j][1]+p[i][1])*f; }
  A/=2; if(Math.abs(A)<1) return null; return [x/(6*A),y/(6*A),Math.abs(A)]; }
function inScreenPoly(x,y,p){ let c=false; for(let i=0,j=p.length-1;i<p.length;j=i++){ const a=p[i],b=p[j];
  if((a[1]>y)!==(b[1]>y) && x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]) c=!c; } return c; }
/* ---------- VTC/VNC underlay: imported on the device, rendered with pdf.js, stored in Cache Storage ---------- */
// Georeference per chart sheet panel: chart pt (u,v) = similarity( Lambert conformal conic(lat,lon) ), LCC on a sphere with
// standard parallels 36°S/39°S, origin 37.8°S 145°E. Fitted offline (tools/chartref.py) by matching the chart's printed
// controlled-airspace boundaries to the DAH: median misfit 0.5 pt (about 45 m on the VTC, 90 m on the VNC).
const CHART_SHEETS=[{"sheet":"ML-VNC","name":"Melbourne VNC","kind":"VNC","page":[2834.64,1785.82],"re":"melbourne","levels":[0.5,2.0],"panels":[{"id":"ML-VNC","name":"Melbourne VNC","order":0,"sim":[10.507859,0.039723,1431.383697,877.542035],"clip":[[0,0],[2834,0],[2834,1596],[165,1596],[165,1255],[0,1255]]}]},{"sheet":"ML-VTC","name":"Melbourne VTC","kind":"VTC","page":[1417.33,2834.65],"re":"melbourne","levels":[0.5,2.5],"panels":[{"id":"ML-VTC","name":"Melbourne VTC","order":1,"sim":[21.01975,0.006852,824.508612,949.036418],"clip":[[1327,71],[1294,71],[987,69],[680,69],[374,69],[67,71],[34,71],[34,1833],[63,1833],[364,1831],[665,1831],[965,1831],[1266,1832],[1327,1832]]},{"id":"ML-VTC-B","name":"Melbourne VTC (Melbourne Basin panel)","order":2,"sim":[35.019006,0.024451,715.458872,2128.909217],"clip":[[46,2722],[46,1918],[80,1918],[355,1917],[630,1916],[905,1916],[1180,1917],[1185,1917],[1185,2721],[1179,2721],[897,2720],[615,2719],[333,2720],[52,2722]]}]}];
const CH={on:ls.get('mapCharts',true), op:ls.get('chartOp',0.7), idx:[], site:[], local:[], imgs:new Map(), busy:false, need:0, have:0};
const CH_CACHE='radio-au-charts', CH_TILE=512;
function lccFwd(la,lo){ const R_=6371008.8/1852, rad=Math.PI/180, p1=-36*rad, p2=-39*rad, p0=-37.8*rad, l0=145*rad;
  const n=Math.log(Math.cos(p1)/Math.cos(p2))/Math.log(Math.tan(Math.PI/4+p2/2)/Math.tan(Math.PI/4+p1/2)), F=Math.cos(p1)*Math.pow(Math.tan(Math.PI/4+p1/2),n)/n;
  const r0=R_*F/Math.pow(Math.tan(Math.PI/4+p0/2),n), r=R_*F/Math.pow(Math.tan(Math.PI/4+la*rad/2),n), th=n*(lo*rad-l0);
  return [r*Math.sin(th), r0-r*Math.cos(th)]; }
function chartPt(pan,la,lo){ const [x,y]=lccFwd(la,lo), [a,b,c,d]=pan.sim; return [a*x+b*y+c, -a*y+b*x+d]; }
function affine3(src,dst){ // canvas = [a c e; b d f]·[u v 1] from three point pairs
  const [[u1,v1],[u2,v2],[u3,v3]]=src, det=u1*(v2-v3)-v1*(u2-u3)+(u2*v3-u3*v2);
  const sol=k=>{ const [y1,y2,y3]=dst.map(p=>p[k]); return [ (y1*(v2-v3)-v1*(y2-y3)+(y2*v3-y3*v2))/det, (u1*(y2-y3)-y1*(u2-u3)+(u2*y3-u3*y2))/det, (u1*(v2*y3-v3*y2)-v1*(u2*y3-u3*y2)+y1*(u2*v3-u3*v2))/det ]; };
  const [a,c,e]=sol(0), [b,d,f]=sol(1); return [a,b,c,d,e,f]; }
// Charts come from the site (app/charts/, pre-rendered by tools/chartiles.py, downloaded and cached by default) or from a
// PDF imported on this device (stored the same way, and preferred for its sheet). Both live in Cache Storage CH_CACHE.
function chartMerge(){ CH.idx=CH.site.filter(s=>!CH.local.some(l=>l.sheet===s.sheet)).concat(CH.local); }
async function chartIndexLoad(){
  const c=await caches.open(CH_CACHE);
  try{ const r=await c.match('charts/local.json'); CH.local=r? await r.json() : []; }catch(e){ CH.local=[]; }
  try{ const r=await fetch('charts/index.json',{cache:'no-cache'}); if(!r.ok) throw 0; CH.site=await r.clone().json(); await c.put('charts/index.json',r); }
  catch(e){ try{ const r=await c.match('charts/index.json'); CH.site=r? await r.json() : []; }catch(e2){ CH.site=[]; } }
  chartMerge(); chartUI(); render(); chartsPrecache();
}
async function chartIndexSave(){ const c=await caches.open(CH_CACHE); await c.put('charts/local.json', new Response(JSON.stringify(CH.local),{headers:{'Content-Type':'application/json'}})); chartMerge(); }
const chartUrl=(e,L,i,j)=>`charts/${e.dir}/${L}/${i}_${j}.jpg`;
async function chartsPrecache(){ // download every site tile not yet stored (4 at a time), and drop tiles of old editions
  if(CH.pre) return; CH.pre=true;
  try{
    const c=await caches.open(CH_CACHE), keys=(await c.keys()).map(k=>new URL(k.url).pathname), have=new Set(keys.map(p=>p.slice(p.indexOf('/charts/')+1)));
    const dirs=new Set(CH.idx.map(e=>e.dir));
    for(const p of keys){ const rel=p.slice(p.indexOf('/charts/')+1), d=rel.split('/')[1]; if(rel.split('/').length>2 && !dirs.has(d)) await c.delete(p); }
    const todo=[]; let need=0;
    for(const e of CH.idx) if(e.src==='site') e.levels.forEach((lv,L)=>(lv.tiles||[]).forEach(([i,j])=>{ need++; const u=chartUrl(e,L,i,j); if(!have.has(u)) todo.push(u); }));
    CH.need=need; CH.have=need-todo.length; chartUI();
    let k=0; const worker=async()=>{ while(k<todo.length){ const u=todo[k++];
      try{ const r=await fetch(u); if(r.ok){ await c.put(u,r); CH.have++; } }catch(e){ break; }
      if(CH.have%10===0) chartUI(); } };
    if(todo.length && navigator.onLine!==false) await Promise.all([worker(),worker(),worker(),worker()]);
  }catch(e){}
  CH.pre=false; chartUI(); offlineStatus();
}
function chartTile(e,L,i,j){ const k=e.dir+'/'+L+'/'+i+'_'+j, v=CH.imgs.get(k);
  if(v instanceof ImageBitmap || (v&&v.width)) { CH.imgs.delete(k); CH.imgs.set(k,v); return v; }   // LRU touch
  if(v==='loading'||v==='none') return null;
  CH.imgs.set(k,'loading');
  const u='charts/'+k+'.jpg';
  caches.open(CH_CACHE).then(async c=>{ let r=await c.match(u);
      if(!r && e.src==='site'){ try{ const n=await fetch(u); if(n.ok){ await c.put(u,n.clone()); r=n; } }catch(er){} }
      return r? r.blob() : null; })
    .then(b=>b?createImageBitmap(b):null).then(img=>{
    CH.imgs.set(k,img||'none');
    if(CH.imgs.size>180){ for(const [kk,vv] of CH.imgs){ if(CH.imgs.size<=150) break; if(vv&&vv.close) vv.close(); CH.imgs.delete(kk); } }
    if(!chartTile.raf) chartTile.raf=requestAnimationFrame(()=>{ chartTile.raf=0; if(MAP.last) drawMap(...MAP.last); });
  }).catch(()=>CH.imgs.set(k,'none'));
  return null; }
function drawCharts(g,W,Hh,inv){
  if(!CH.on||!CH.idx.length) return false;
  const cv=[[0,0],[W,0],[0,Hh],[W,Hh]], geo=cv.map(([x,y])=>inv(x,y));
  const pans=[]; for(const sh of CHART_SHEETS){ const st_=CH.idx.find(s=>s.sheet===sh.sheet); if(st_) for(const p of sh.panels) pans.push([p,sh,st_]); }
  pans.sort((a,b)=>a[0].order-b[0].order);
  let drew=false;
  for(const [pan,sh,stx] of pans){
    const pc=geo.map(([qa,qo])=>chartPt(pan,qa,qo)), M=affine3(pc.slice(0,3),cv.slice(0,3));
    let u0=1e9,v0=1e9,u1=-1e9,v1=-1e9; for(const [u,v] of pc){ u0=Math.min(u0,u); v0=Math.min(v0,v); u1=Math.max(u1,u); v1=Math.max(v1,v); }
    let cu0=1e9,cv0=1e9,cu1=-1e9,cv1=-1e9; for(const [u,v] of pan.clip){ cu0=Math.min(cu0,u); cv0=Math.min(cv0,v); cu1=Math.max(cu1,u); cv1=Math.max(cv1,v); }
    u0=Math.max(u0,cu0); v0=Math.max(v0,cv0); u1=Math.min(u1,cu1); v1=Math.min(v1,cv1); if(u0>=u1||v0>=v1) continue;
    const need=Math.hypot(M[0],M[1])*(window.devicePixelRatio||1);   // device px per chart pt
    g.save(); g.transform(...M); g.beginPath(); pan.clip.forEach(([u,v],i)=>i?g.lineTo(u,v):g.moveTo(u,v)); g.closePath(); g.clip(); g.globalAlpha=CH.op;
    const levels=stx.levels.map((lv,L)=>{ if(lv.tiles&&!lv.tset) lv.tset=new Set(lv.tiles.map(t=>t[0]+'_'+t[1])); return {...lv,L}; }), lo_=levels[0], hi_=levels.find(l=>l.s>=need*0.7)||levels[levels.length-1];
    for(const lv of (hi_===lo_?[lo_]:[lo_,hi_])){
      const ts=CH_TILE/lv.s; // tile size in chart pt
      for(let j=Math.max(0,Math.floor(v0/ts)); j<=Math.min(lv.rows-1,Math.floor(v1/ts)); j++)
        for(let i=Math.max(0,Math.floor(u0/ts)); i<=Math.min(lv.cols-1,Math.floor(u1/ts)); i++){
          if(lv.tset && !lv.tset.has(i+'_'+j)) continue;      // site tiles outside every panel were never made
          const img=chartTile(stx,lv.L,i,j); if(img){ g.drawImage(img,i*ts,j*ts,img.width/lv.s,img.height/lv.s); drew=true; } }
    }
    g.restore();
  }
  return drew; }
function chartUI(){
  const n=CH.idx.length, dl=CH.need&&CH.have<CH.need? ` · downloading ${CH.have}/${CH.need}` : CH.need? ' · stored' : '';
  $('chartSum').textContent= n? CH.idx.map(s=>s.name+(s.ed?' '+s.ed:'')).join(' · ')+dl : 'none';
  $('chartList').innerHTML=CH.idx.map(s=>`<li><span><b>${esc(s.name)}</b> ${esc(s.ed||'')} · ${(s.bytes/1048576).toFixed(1)} MB · ${s.src==='site'?'from the app':'imported on this device'}${s.edT&&s.edT>Date.now()?' · <span class="w">effective '+esc(s.ed)+'</span>':''}</span>${s.src==='site'?'':`<button class="btn" data-del="${s.sheet}">Remove</button>`}</li>`).join('');
  $('mapChart').setAttribute('aria-pressed',CH.on&&n>0); $('chartOp').value=CH.op; }
function loadScript(src){ return new Promise((ok,no)=>{ const s=document.createElement('script'); s.src=src; s.onload=ok; s.onerror=()=>no(new Error('could not load '+src)); document.head.appendChild(s); }); }
async function chartImport(files){
  if(CH.busy) return; CH.busy=true; const prog=$('chartProg'); prog.hidden=false;
  const say=t=>{ prog.textContent=t; };
  try{
    if(!window.pdfjsLib){ say('Loading the PDF renderer…'); await loadScript('lib/pdfjs/pdf.min.js'); pdfjsLib.GlobalWorkerOptions.workerSrc='lib/pdfjs/pdf.worker.min.js'; }
    try{ navigator.storage&&navigator.storage.persist&&navigator.storage.persist(); }catch(e){}
    for(const f of files){
      say('Opening '+f.name+'…');
      const pdf=await pdfjsLib.getDocument({data:await f.arrayBuffer()}).promise, page=await pdf.getPage(1), vp=page.getViewport({scale:1});
      let title=''; try{ const md=await pdf.getMetadata(); title=(md.info&&md.info.Title)||''; }catch(e){}
      const key=(f.name+' '+title).toLowerCase();
      const sh=CHART_SHEETS.find(s=>Math.abs(vp.width-s.page[0])<2&&Math.abs(vp.height-s.page[1])<2&&key.includes(s.kind.toLowerCase())&&new RegExp(s.re,'i').test(key))
             || CHART_SHEETS.find(s=>Math.abs(vp.width-s.page[0])<2&&Math.abs(vp.height-s.page[1])<2&&new RegExp(s.re,'i').test(key));
      if(!sh){ say(f.name+': not a chart this app is calibrated for (Melbourne VTC or VNC). Nothing stored.'); continue; }
      const em=key.match(/(\d{2})\s?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s?(\d{4})/i), ed=em?(em[1]+' '+em[2].toUpperCase()+' '+em[3]):'';
      const c=await caches.open(CH_CACHE); let bytes=0; const levels=[];
      const dir=sh.sheet+'-local';
      for(const k of (await c.keys())) if(new URL(k.url).pathname.includes('/charts/'+dir+'/')) await c.delete(k);
      for(let L=0;L<sh.levels.length;L++){
        const s=sh.levels[L], Wp=Math.ceil(vp.width*s), Hp=Math.ceil(vp.height*s), B=2048, cols=Math.ceil(Wp/CH_TILE), rows=Math.ceil(Hp/CH_TILE);
        levels.push({s,cols,rows});
        const nb=Math.ceil(Wp/B)*Math.ceil(Hp/B); let done=0;
        for(let by=0;by<Hp;by+=B) for(let bx=0;bx<Wp;bx+=B){
          say(`${sh.name}: rendering ${L?'detail':'overview'} ${++done}/${nb}…`);
          const bw=Math.min(B,Wp-bx), bh=Math.min(B,Hp-by), cv=document.createElement('canvas'); cv.width=bw; cv.height=bh;
          const ctx=cv.getContext('2d'); ctx.fillStyle='#fff'; ctx.fillRect(0,0,bw,bh);
          await page.render({canvasContext:ctx, viewport:page.getViewport({scale:s, offsetX:-bx, offsetY:-by})}).promise;
          for(let ty=0;ty<bh;ty+=CH_TILE) for(let tx=0;tx<bw;tx+=CH_TILE){
            const tw=Math.min(CH_TILE,bw-tx), th=Math.min(CH_TILE,bh-ty), t=document.createElement('canvas'); t.width=tw; t.height=th;
            t.getContext('2d').drawImage(cv,tx,ty,tw,th,0,0,tw,th);
            const blob=await new Promise(r=>t.toBlob(r,'image/jpeg',0.82)); bytes+=blob.size;
            await c.put(`charts/${dir}/${L}/${(bx+tx)/CH_TILE}_${(by+ty)/CH_TILE}.jpg`, new Response(blob,{headers:{'Content-Type':'image/jpeg'}}));
          }
          cv.width=cv.height=0;
        }
      }
      const edT=ed? Date.parse(ed+' 00:00 UTC')-8*3600e3 : 0;
      CH.local=CH.local.filter(s=>s.sheet!==sh.sheet).concat([{sheet:sh.sheet,name:sh.name,ed,edT,bytes,levels,dir,src:'local'}]);
      for(const k of [...CH.imgs.keys()]) if(k.startsWith(dir+'/')) CH.imgs.delete(k);
      await chartIndexSave(); CH.on=true; ls.set('mapCharts',true);
      say(`${sh.name} ${ed} stored (${(bytes/1048576).toFixed(1)} MB). Works offline.`);
      pdf.destroy();
    }
  }catch(e){ say('Import failed: '+(e.message||e)); }
  CH.busy=false; chartUI(); render();
}
$('chartFile').addEventListener('change',e=>{ const fs=[...e.target.files]; e.target.value=''; if(fs.length) chartImport(fs); });
$('chartList').addEventListener('click',async e=>{ const b=e.target.closest('[data-del]'); if(!b) return; const sh=b.dataset.del;
  const dir=sh+'-local', c=await caches.open(CH_CACHE); for(const k of (await c.keys())) if(new URL(k.url).pathname.includes('/charts/'+dir+'/')) await c.delete(k);
  CH.local=CH.local.filter(s=>s.sheet!==sh); for(const k of [...CH.imgs.keys()]) if(k.startsWith(dir+'/')) CH.imgs.delete(k); await chartIndexSave(); chartUI(); render(); chartsPrecache(); });
$('chartOp').addEventListener('input',()=>{ CH.op=+$('chartOp').value; ls.set('chartOp',CH.op); if(MAP.last) drawMap(...MAP.last); });
$('mapChart').onclick=()=>{ if(!CH.idx.length){ $('chartBox').open=true; $('chartBox').scrollIntoView({block:'nearest'}); return; } CH.on=!CH.on; ls.set('mapCharts',CH.on); chartUI(); render(); };
if(window.caches) chartIndexLoad();

function drawLead(g,sc,C){   // in the ownship frame: forward is -y, 1 NM = sc px. Orange dashed, a cross line each NM, every 2nd numbered
  const L=10*sc, halo=C.bg, acc=C.acc;
  g.lineCap='round';
  const line=(w,col,dash)=>{ g.setLineDash(dash||[]); g.lineWidth=w; g.strokeStyle=col; g.beginPath(); g.moveTo(0,-14); g.lineTo(0,-L); g.stroke(); };
  const tick=(k,w,col)=>{ g.lineWidth=w; g.strokeStyle=col; g.beginPath(); g.moveTo(-6,-k*sc); g.lineTo(6,-k*sc); g.stroke(); };
  line(4.5,halo); line(2,acc,[6,5]); g.setLineDash([]);
  g.font='700 10px "IBM Plex Mono", monospace'; g.textAlign='left'; g.textBaseline='middle';
  for(let k=1;k<=10;k++){ tick(k,4.5,halo); tick(k,2,acc);
    if(k%2===0){ g.lineWidth=3; g.strokeStyle=halo; g.strokeText(String(k),10,-k*sc); g.fillStyle=acc; g.fillText(String(k),10,-k*sc); } }
  g.lineCap='butt'; g.textBaseline='alphabetic';
}
function drawMap(la,lo,h,pick,AS,altFt){
  const cv=$('map'); if(!cv) return;
  MAP.last=[la,lo,h,pick,AS,altFt];
  // panned: the view is centred on MAP.pan (fixed lat/lon, north up); otherwise on you
  const own=[la,lo]; if(MAP.pan){ la=MAP.pan[0]; lo=MAP.pan[1]; h=null; }
  $('mapHome').hidden=!MAP.pan;
  const W=cv.clientWidth, Hh=cv.clientHeight, dpr=window.devicePixelRatio||1;
  if(!W||!Hh) return;   // map not laid out (hidden tab/pane): nothing to draw
  if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(Hh*dpr)){ cv.width=Math.round(W*dpr); cv.height=Math.round(Hh*dpr); }
  const g=cv.getContext('2d'); g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,W,Hh);
  const rot = MAP.up==='trk' && h ? h.deg : 0;
  const cx=W/2, cy= MAP.up==='trk'&&h ? Hh*0.62 : Hh/2;
  const sc=Math.min(W,Hh)*0.46/MAP.range, cosl=Math.cos(la*R), cr=Math.cos(-rot*R), sr=Math.sin(-rot*R);
  const P=(pla,plo)=>{ const x=(plo-lo)*cosl*60, y=(pla-la)*60; return [cx+(x*cr-y*sr)*sc, cy-(x*sr+y*cr)*sc]; };
  const [ox,oy]=P(own[0],own[1]); MAP.sc=sc; MAP.cosl=cosl;
  const reach=MAP.range*1.6/60, bbHit=bb=>!(bb[1]<la-reach||bb[0]>la+reach||bb[3]<lo-reach/cosl||bb[2]>lo+reach/cosl);
  const C={C:cssv('--as-c'),D:cssv('--as-d'),E:cssv('--as-e'),CTR:cssv('--as-d'),A:cssv('--as-c'),R:cssv('--as-r'),Q:cssv('--as-q'),FIA:cssv('--as-fia'),EF:cssv('--as-e'),ink:cssv('--ink'),dim:cssv('--dim'),bg:cssv('--panel'),acc:cssv('--accent'),fr:cssv('--freq')};
  const curSet=new Set(AS.bands.filter(b=>altFt>=b.L-50&&altFt<b.H).map(b=>b.n));
  const invPx=(px,py)=>{ const dx=(px-cx)/sc, dy=(cy-py)/sc; const x=dx*cr+dy*sr, y=-dx*sr+dy*cr; return [la+y/60, lo+x/(60*cosl)]; };
  const chartsShown=drawCharts(g,W,Hh,invPx);
  // terrain relative to you (SRTM): red at or above you, amber within 500 ft below, grey relief otherwise (not over a chart)
  if(TER.ok && MAP.ter){
    const step=6, inv=(px,py)=>{ const dx=(px-cx)/sc, dy=(cy-py)/sc; const x=dx*cr+dy*sr, y=-dx*sr+dy*cr; return [la+y/60, lo+x/(60*cosl)]; };
    const red=cssv('--warn'), amb=cssv('--accent'), rel=cssv('--ink');
    for(let py=0;py<Hh;py+=step) for(let px=0;px<W;px+=step){
      const [qa,qo]=inv(px+step/2,py+step/2), t=terrainFt(qa,qo); if(t==null||t<=0) continue;
      if(st.alt!=null && t>=altFt-100){ g.fillStyle=red; g.globalAlpha=.42; }
      else if(st.alt!=null && t>=altFt-500){ g.fillStyle=amb; g.globalAlpha=.32; }
      else { if(chartsShown) continue; g.fillStyle=rel; g.globalAlpha=Math.min(.16,t/12000); }
      g.fillRect(px,py,step,step);
    }
    g.globalAlpha=1;
  }
  // CTAF layer: 10 NM around each aerodrome (and DAH broadcast areas), merged per frequency, one colour each
  const ctafAt=[];
  if(MAP.ctaf){
    const groups=new Map(); const add=(f,shape)=>{ if(!f) return; if(!groups.has(f)) groups.set(f,[]); groups.get(f).push(shape); };
    const rr=reach+CTAF_NM/60;
    for(const ad of DATA.ap){
      if(ad.t==='H'&&!st.heli) continue; if(!st.all && ad.s!=='E' && ad.t!=='H') continue;
      if(Math.abs(ad.la-la)>rr||Math.abs(ad.lo-lo)>rr/cosl) continue;
      const ci=ctafInfo(ad); if(!ci.f) continue;
      const [x,y]=P(ad.la,ad.lo); add(ci.f,{c:[x,y]}); ctafAt.push([ad,x,y,ci.f]);
    }
    for(const x of ASP) if(x.k==='BA' && x.f && bbHit(x.bb)) add(x.f,{p:x.p.map(q=>P(q[0],q[1]))});
    ctafAssign([...groups.keys()]);
    if(!ctafOff) ctafOff=document.createElement('canvas');
    ctafOff.width=cv.width; ctafOff.height=cv.height; const o=ctafOff.getContext('2d');
    const R_=CTAF_NM*sc, shapePath=sh=>{ o.beginPath(); if(sh.c) o.arc(sh.c[0],sh.c[1],R_,0,2*Math.PI); else { sh.p.forEach((q,i)=>i?o.lineTo(q[0],q[1]):o.moveTo(q[0],q[1])); o.closePath(); } };
    const leg=[];
    for(const [f,shapes] of groups){
      const col=ctafColour(f); leg.push([f,col,shapes.length]);
      o.setTransform(dpr,0,0,dpr,0,0); o.clearRect(0,0,W,Hh);
      // union fill (drawn opaque, composited once with alpha so overlaps don't darken)
      o.globalCompositeOperation='source-over'; o.fillStyle=col; for(const sh of shapes){ shapePath(sh); o.fill(); }
      g.globalAlpha= f==='126.7'?.10:.22; g.drawImage(ctafOff,0,0,W,Hh); g.globalAlpha=1;
      // union outline: stroke every shape, then erase the interiors
      o.clearRect(0,0,W,Hh); o.strokeStyle=col; o.lineWidth=2; for(const sh of shapes){ shapePath(sh); o.stroke(); }
      o.globalCompositeOperation='destination-out'; for(const sh of shapes){ shapePath(sh); o.fill(); }
      o.globalCompositeOperation='source-over';
      g.globalAlpha=.85; g.drawImage(ctafOff,0,0,W,Hh); g.globalAlpha=1;
    }
    leg.sort((a,b)=>(a[0]==='126.7')-(b[0]==='126.7')||b[2]-a[2]);
    $('ctafLeg').innerHTML=leg.length? leg.map(([f,c])=>`<span><i class="dotc" style="background:${c}"></i>${f}</span>`).join('') : '<span>No CTAF aerodromes in view</span>';
  }
  $('ctafLeg').hidden=!MAP.ctaf;
  const ceil=Math.max(12500, altFt+5000);
  const vis=ASP.filter(x=>bbHit(x.bb) && x.k!=='EF' && x.k!=='A' && (x.k==='FIA' || (x.lok==='AGL'?x.lo:(x.lo||0))<ceil) && !((x.k==='R'||x.k==='Q') && (x.lo||0)>=10000));
  const order={FIA:0,E:1,C:2,A:2,D:3,CTR:4,Q:5,R:6};
  vis.sort((a,b)=>order[a.k]-order[b.k]);
  const labels=[[ox-16,oy-16,32,32],[W-34,2,32,32]], drawL=[];
  // screen polygons up front: label placement needs the others to keep each label inside its own step
  const SPX=new Map(); for(const x of vis){ const sp=x.p.map(q=>P(q[0],q[1])); let a=1e9,b=1e9,c=-1e9,d=-1e9; for(const q of sp){ a=Math.min(a,q[0]); b=Math.min(b,q[1]); c=Math.max(c,q[0]); d=Math.max(d,q[1]); } SPX.set(x,{sp,bb:[a,b,c,d]}); }
  const CTLK=new Set(['C','D','CTR','E']), baseOf=x=>x.lok==='AGL'?x.lo:(x.lo||0);
  g.lineJoin='round';
  for(const x of vis){
    const sp=SPX.get(x).sp;
    g.beginPath(); sp.forEach((q,i)=>i?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1])); g.closePath();
    const col=C[x.k]||C.dim;
    if(x.k==='FIA'){ g.setLineDash([2,4]); g.lineWidth=1.2; g.strokeStyle=col; g.stroke(); g.setLineDash([]); }
    else{
      const here=curSet.has(x.n);
      if(here||x.k==='R'){ g.globalAlpha= here?0.18:0.06; g.fillStyle=col; g.fill(); g.globalAlpha=1; }
      g.setLineDash(x.k==='D'||x.k==='CTR'?[6,3]:x.k==='Q'?[3,3]:[]);
      g.lineWidth= here?2.4:(x.k==='E'?1:1.6); g.strokeStyle=col; g.stroke(); g.setLineDash([]);
    }
    // label: the whole box must sit inside the visible part of this airspace and, for controlled airspace, where no
    // lower controlled airspace overlaps (otherwise e.g. a C A045 label lands inside the A025 step or a CTR)
    const cl=clipRect(sp,W,Hh); if(cl.length<3) continue;
    const c=polyCentroid(cl); if(!c||c[2]<900) continue;
    let lines;
    if(x.k==='FIA'){ if(!x.f) continue; lines=[x.f]; }
    else{
      const gnd=0, top=x.hik==='NOTAM'?'NOTAM':x.hik==='BCTA'?'BCTA':limTxt(limFt(x.hi,x.hik,gnd,0)), bot=x.lok==='AGL'?x.lo+' AGL':x.lok==='NOTAM'?'NOTAM':limTxt(limFt(x.lo,x.lok,gnd,0));
      const cls=x.k==='CTR'?((x.n.match(/\(([A-Z])\)/)||[])[1]||'D'):x.k==='Q'?'D':x.k;
      lines=[(x.k==='R'||x.k==='Q'?x.n.split(' ')[0]+' ':'')+cls, top, bot];
    }
    g.font='600 10.5px "IBM Plex Mono", ui-monospace, monospace';
    const w=Math.max(...lines.map(t=>g.measureText(t).width))+8, hh=lines.length*12+4;
    const lower=CTLK.has(x.k)? vis.filter(o=>o!==x&&CTLK.has(o.k)&&baseOf(o)<baseOf(x)).map(o=>SPX.get(o)) : [];
    const okPt=(px,py)=>inScreenPoly(px,py,cl) && !lower.some(o=>px>=o.bb[0]&&px<=o.bb[2]&&py>=o.bb[1]&&py<=o.bb[3]&&inScreenPoly(px,py,o.sp));
    const S9=[[0,0],[-w/2,-hh/2],[w/2,-hh/2],[-w/2,hh/2],[w/2,hh/2],[0,-hh/2],[0,hh/2],[-w/2,0],[w/2,0]];
    const fits=(px,py)=>S9.every(([dx,dy])=>okPt(px+dx,py+dy)) && !labels.some(b=>!(px-w/2>b[0]+b[2]+2||px+w/2<b[0]-2||py-hh/2>b[1]+b[3]+2||py+hh/2<b[1]-2));
    let lx=null, ly=null;
    if(fits(c[0],c[1])){ lx=c[0]; ly=c[1]; }
    else { let bx0=1e9,by0=1e9,bx1=-1e9,by1=-1e9; for(const q of cl){ bx0=Math.min(bx0,q[0]); by0=Math.min(by0,q[1]); bx1=Math.max(bx1,q[0]); by1=Math.max(by1,q[1]); }
      const cand=[]; for(let py=by0+hh/2;py<=by1-hh/2;py+=14) for(let px=bx0+w/2;px<=bx1-w/2;px+=14) cand.push([px,py,(px-c[0])**2+(py-c[1])**2]);
      cand.sort((a,b)=>a[2]-b[2]); for(const [px,py] of cand){ if(fits(px,py)){ lx=px; ly=py; break; } } }
    if(lx==null) continue;
    const box=[lx-w/2,ly-hh/2,w,hh];
    if(labels.some(b=>!(box[0]>b[0]+b[2]+2||box[0]+box[2]<b[0]-2||box[1]>b[1]+b[3]+2||box[1]+box[3]<b[1]-2))) continue;
    labels.push(box);
    drawL.push(()=>{
      g.font='600 10.5px "IBM Plex Mono", ui-monospace, monospace';
      g.globalAlpha=.9; g.fillStyle=C.bg; g.fillRect(...box); g.globalAlpha=1;
      g.fillStyle=col; g.textAlign='center'; g.textBaseline='middle';
      lines.forEach((t,i)=>g.fillText(t,lx,box[1]+8+i*12));
      if(lines.length===3){ g.strokeStyle=col; g.lineWidth=1; g.beginPath(); g.moveTo(lx-w/2+4,box[1]+26); g.lineTo(lx+w/2-4,box[1]+26); g.stroke(); }
      g.textBaseline='alphabetic';
    });
  }
  // range rings
  g.strokeStyle=C.dim; g.globalAlpha=.5; g.lineWidth=1; g.setLineDash([1,3]);
  for(const r of [MAP.range/2,MAP.range]){ g.beginPath(); g.arc(ox,oy,r*sc,0,2*Math.PI); g.stroke(); }
  g.setLineDash([]); g.globalAlpha=1;
  g.fillStyle=C.dim; g.font='500 10px "IBM Plex Mono", monospace'; g.textAlign='left';
  g.fillText(rngTxt(MAP.range),ox+MAP.range*sc*0.707+3,oy-MAP.range*sc*0.707);
  // aerodromes
  g.font='600 10px "IBM Plex Mono", monospace';
  for(const ad of DATA.ap){
    if(ad.t==='H'&&!st.heli) continue;
    if(Math.abs(ad.la-la)>reach||Math.abs(ad.lo-lo)>reach/cosl) continue;
    const [x,y]=P(ad.la,ad.lo); if(x<-10||y<-10||x>W+10||y>Hh+10) continue;
    const sel=ad===pick.a;
    g.beginPath(); g.arc(x,y,sel?5:3,0,2*Math.PI); g.fillStyle=sel?C.acc:C.ink; g.fill();
    if(sel||MAP.range<=20){ g.fillStyle=sel?C.acc:C.dim; g.textAlign='left'; g.fillText(ad.i,x+6,y+3); }
  }
  if(MAP.ctaf && MAP.range<=40){ // frequency under each aerodrome, in its group colour
    g.font='700 10px "IBM Plex Mono", monospace'; g.textAlign='left';
    for(const [ad,x,y,f] of ctafAt){ if(x<-10||y<-10||x>W+10||y>Hh+10) continue; if(f==='126.7' && MAP.range>10 && ad!==pick.a) continue;
      const tw=g.measureText(f).width; g.globalAlpha=.85; g.fillStyle=C.bg; g.fillRect(x+5,y+5,tw+4,12); g.globalAlpha=1;
      g.fillStyle=ctafColour(f); g.fillText(f,x+7,y+15); }
  }
  if(MAP.range<=5){ // runways at close range
    g.lineCap='butt';
    for(const ad of DATA.ap){ if(!ad.rw) continue; if(Math.abs(ad.la-la)>reach||Math.abs(ad.lo-lo)>reach/cosl) continue;
      for(const r of ad.rw){ const p=P(r[2],r[3]), q=P(r[4],r[5]);
        g.strokeStyle=r[10]?C.dim:C.ink; g.lineWidth=Math.max(3,(r[8]||20)*sc/1852*1.6); if(r[10]) g.setLineDash([5,3]);
        g.beginPath(); g.moveTo(p[0],p[1]); g.lineTo(q[0],q[1]); g.stroke(); g.setLineDash([]);
        if(MAP.range<=2.5){ g.font='700 9px "IBM Plex Mono", monospace'; g.fillStyle=C.dim; g.textAlign='center';
          const dx=q[0]-p[0], dy=q[1]-p[1], L=Math.hypot(dx,dy)||1; g.fillText(r[0],p[0]-dx/L*10,p[1]-dy/L*10+3); g.fillText(r[1],q[0]+dx/L*10,q[1]+dy/L*10+3); } } }
  }
  drawL.forEach(f=>f());
  // navigation points (VFR waypoints like the VTC, navaids), within 20 NM range
  MAP.hits=[];
  for(const ad of DATA.ap){ if(ad.t==='H'&&!st.heli) continue; if(Math.abs(ad.la-la)>reach||Math.abs(ad.lo-lo)>reach/cosl) continue; const [x,y]=P(ad.la,ad.lo); if(x>=0&&y>=0&&x<=W&&y<=Hh) MAP.hits.push({x,y,p:{k:'AD',c:ad.i,n:ad.n,la:ad.la,lo:ad.lo}}); }
  if(MAP.range<=20){
    const wpC=cssv('--wp');
    g.font='600 9.5px "IBM Plex Mono", monospace'; g.textAlign='left';
    for(const p of VW){ if(Math.abs(p.la-la)>reach||Math.abs(p.lo-lo)>reach/cosl) continue;
      const [x,y]=P(p.la,p.lo); if(x<-8||y<-8||x>W+8||y>Hh+8) continue; MAP.hits.push({x,y,p});
      const go=GO&&GO.c===p.c;
      g.save(); g.translate(x,y); g.rotate(Math.PI/4); g.fillStyle=go?C.acc:wpC; g.fillRect(-4,-4,8,8); g.fillStyle=C.bg; g.fillRect(-1.6,-1.6,3.2,3.2); g.restore();
      g.fillStyle=go?C.acc:wpC; g.fillText(p.c,x+7,y-5); }
    for(const p of NA){ if(Math.abs(p.la-la)>reach||Math.abs(p.lo-lo)>reach/cosl) continue;
      const [x,y]=P(p.la,p.lo); if(x<-8||y<-8||x>W+8||y>Hh+8) continue; MAP.hits.push({x,y,p});
      g.strokeStyle=C.ink; g.fillStyle=C.ink; g.lineWidth=1.3;
      if(p.t==='NDB'){ g.setLineDash([1.5,2]); g.beginPath(); g.arc(x,y,6,0,2*Math.PI); g.stroke(); g.setLineDash([]); g.beginPath(); g.arc(x,y,1.6,0,2*Math.PI); g.fill(); }
      else { g.beginPath(); for(let i=0;i<6;i++){ const an=Math.PI/3*i; i?g.lineTo(x+6*Math.cos(an),y+6*Math.sin(an)):g.moveTo(x+6,y); } g.closePath(); g.stroke();
        if(p.t.includes('DME')||p.t==='TAC') g.strokeRect(x-6,y-5.2,12,10.4); g.beginPath(); g.arc(x,y,1.4,0,2*Math.PI); g.fill(); }
      g.fillStyle=C.dim; g.fillText(p.c+(p.f&&MAP.range<=10?' '+p.f:''),x+8,y+10); }
  }
  // towns (ABS urban centres; localities, then suburbs, as you zoom in; towns are listed first so they win label space) — the chart already names them when it's showing
  if(!chartsShown && MAP.range<=20){ g.font='italic 500 10.5px '+cssv('--f-body'); g.fillStyle=C.dim; g.textAlign='center';
    const tb=labels.slice(); tb.push([ox-14,oy-14,28,28]); { const rx=ox+MAP.range*sc*0.707+3, ry=oy-MAP.range*sc*0.707; tb.push([rx,ry-11,52,14]); }   // + the range ring label     // keep clear of airspace labels, you, and aerodrome codes
    for(const ad of DATA.ap){ if(ad.t==='H'&&!st.heli) continue; if(Math.abs(ad.la-la)>reach||Math.abs(ad.lo-lo)>reach/cosl) continue; const [x,y]=P(ad.la,ad.lo); tb.push([x-5,y-8,44,14]); }
    for(const p of VW){ if(Math.abs(p.la-la)>reach||Math.abs(p.lo-lo)>reach/cosl) continue; const [x,y]=P(p.la,p.lo); tb.push([x-7,y-12,48,22]); }
    for(const t of TOWNS){ if(t.t==='L'&&MAP.range>10||t.t==='S'&&MAP.range>5) continue; if(Math.abs(t.la-la)>reach||Math.abs(t.lo-lo)>reach/cosl) continue;
      const [x0,y0]=P(t.la,t.lo); if(x0<0||y0<8||x0>W||y0>Hh) continue; const w=g.measureText(t.n).width;
      for(const [dx,dy] of [[0,0],[0,14],[0,-14],[w/2+12,0],[-w/2-12,0]]){ const x=x0+dx, y=y0+dy, bx=[x-w/2-2,y-9,w+4,12];
        if(bx[0]<0||bx[0]+bx[2]>W||bx[1]<0||bx[1]+bx[3]>Hh) continue;
        if(tb.some(b=>!(bx[0]>b[0]+b[2]||bx[0]+bx[2]<b[0]||bx[1]>b[1]+b[3]||bx[1]+bx[3]<b[1]))) continue; tb.push(bx); g.fillText(t.n,x,y); break; } }
    g.textAlign='left'; }
  // flight plan route
  if(FP && FP.pts.length>1){ const wp=cssv('--wp'); const pts=FP.pts.map(p=>P(p.la,p.lo));
    g.lineWidth=3; g.strokeStyle=wp; g.globalAlpha=.75; g.beginPath(); pts.forEach((q,k)=>k?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1])); g.stroke(); g.globalAlpha=1;
    g.font='700 10px "IBM Plex Mono", monospace'; g.textAlign='left';
    FP.pts.forEach((p,k)=>{ const [x,y]=pts[k]; if(x<-20||y<-20||x>W+20||y>Hh+20) return;
      g.beginPath(); g.arc(x,y,k===FP.i?5.5:3.5,0,2*Math.PI); g.fillStyle=k===FP.i?wp:C.bg; g.fill(); g.strokeStyle=wp; g.lineWidth=2; g.stroke();
      const t=p.c||p.n; const tw=g.measureText(t).width; g.fillStyle=C.bg; g.globalAlpha=.85; g.fillRect(x+6,y-14,tw+4,12); g.globalAlpha=1; g.fillStyle=wp; g.fillText(t,x+8,y-4); }); }
  // go-to line
  if(GO){ const [gx,gy]=P(GO.la,GO.lo); g.strokeStyle=cssv('--wp'); g.lineWidth=2; g.setLineDash([2,4]); g.beginPath(); g.moveTo(ox,oy); g.lineTo(gx,gy); g.stroke(); g.setLineDash([]); }
  // line to selected aerodrome
  const [sx,sy]=P(pick.a.la,pick.a.lo);
  g.strokeStyle=C.acc; g.lineWidth=1.5; g.setLineDash([5,4]); g.beginPath(); g.moveTo(ox,oy); g.lineTo(sx,sy); g.stroke(); g.setLineDash([]);
  // lead line: 10 NM out along your track/heading, a cross line every 1 NM
  { const hd=heading(); if(hd){ g.save(); g.translate(ox,oy); g.rotate((hd.deg-rot)*R); drawLead(g,sc,C); g.restore(); } }
  // ownship
  { const hd=heading(); g.save(); g.translate(ox,oy); g.rotate(((hd?hd.deg:0)-rot)*R); }
  g.beginPath(); g.moveTo(0,-11); g.lineTo(7,8); g.lineTo(0,4); g.lineTo(-7,8); g.closePath();
  g.fillStyle=C.fr; g.strokeStyle=C.bg; g.lineWidth=2; g.stroke(); g.fill(); g.restore();
  // north pointer
  g.save(); g.translate(W-18,18); g.rotate(-rot*R); g.fillStyle=C.ink; g.font='700 11px "Barlow Condensed", sans-serif'; g.textAlign='center';
  g.beginPath(); g.moveTo(0,-11); g.lineTo(4,-3); g.lineTo(-4,-3); g.closePath(); g.fill(); g.fillText('N',0,8); g.restore();
  $('mapUp').textContent = MAP.pan ? 'North up' : MAP.up==='trk'&&h ? (h.src==='TRK'?'Track up':'Heading up') : 'North up';
  $('mapRng').textContent=rngTxt(MAP.range);
  $('terLeg').hidden=!TER.ok;
}

/* ---------- aerodrome selection ---------- */
function candidates(){
  const [la,lo]=st.pos; const out=[];
  const coslat=Math.cos(la*R);
  for(const a of DATA.ap){
    if(a.t==='H' && !st.heli) continue;
    if(!st.all && a.s!=='E' && a.t!=='H') continue;
    // quick reject > ~150 NM
    if(Math.abs(a.la-la)>2.6 || Math.abs(a.lo-lo)*coslat>2.6) continue;
    const [d,b]=distBrg(la,lo,a.la,a.lo); out.push({a,d,b});
  }
  if(out.length<8){ // remote: widen search
    for(const a of DATA.ap){ if(a.t==='H'&&!st.heli) continue; if(out.find(o=>o.a===a)) continue;
      const [d,b]=distBrg(la,lo,a.la,a.lo); out.push({a,d,b}); }
  }
  out.sort((x,y)=>x.d-y.d);
  return out.slice(0,40);
}
/* Compass alignment. A phone in a cradle rarely points exactly along the aircraft, and the airframe bends the
   compass too, so the raw compass can be well off the aircraft's heading. While you fly straight and steady at
   20 kt or more, the difference between GPS track and compass is averaged (about a 30 s time constant) and then
   added to the compass whenever the app falls back to it (slow, hovering, on the ground). The learnt offset also
   takes in the wind correction angle at the time, so it's best learnt into wind or in light wind. Kept on the
   phone until reset (the cradle usually stays put). */
const CMP_MIN=20;   // samples (about 20 s of fixes) before the offset is used
const CMP=Object.assign({off:0,n:0,s:0,c:0}, ls.get('cmp',{}));
let cmpPrev=null;
function cmpTrue(){ const v=st.pos?variation(st.pos[0],st.pos[1]):0; return st.compassMag? st.compass+v : st.compass; }
function cmpLearn(){
  const now=performance.now();
  if(st.sim||st.compass==null||st.trk==null||!(st.gs>=20)||now-(st.compassT||0)>2000){ cmpPrev=null; return; }
  const raw=cmpTrue(), d=((st.trk-raw+540)%360)-180;
  // steady: track and compass each changed less than about 3 deg/s since the last fix
  const ok=cmpPrev && now-cmpPrev.t<5000 && Math.abs(((st.trk-cmpPrev.trk+540)%360)-180)<3*(now-cmpPrev.t)/1000+3
    && Math.abs(((raw-cmpPrev.raw+540)%360)-180)<3*(now-cmpPrev.t)/1000+6;   // compass jitters more than GPS track
  cmpPrev={t:now,trk:st.trk,raw};
  if(!ok) return;
  const a=1/Math.min(30,CMP.n+1);   // running mean at first, then a 30-sample EMA
  CMP.s=CMP.s*(1-a)+Math.sin(d*R)*a; CMP.c=CMP.c*(1-a)+Math.cos(d*R)*a; CMP.n++;
  CMP.off=Math.atan2(CMP.s,CMP.c)/R;
  if(CMP.n%10===0||CMP.n===CMP_MIN) ls.set('cmp',CMP);
  cmpSync(); }
function cmpSync(){ const b=$('bCmp'); if(!b) return;
  b.textContent= CMP.n>=CMP_MIN? `Compass aligned ${CMP.off>=0?'+':'−'}${Math.abs(Math.round(CMP.off))}°` : CMP.n? `Compass: aligning ${Math.round(100*CMP.n/CMP_MIN)}%` : 'Compass: not aligned';
  b.setAttribute('aria-pressed', CMP.n>=CMP_MIN); }
const unitShort=u=>titleCase(u||'').replace(/\s*\(E Frequency\)/i,' E').replace(/\s*\([^)]*\)/g,'').replace(/ Centre$/,' Ctr').replace(/ Approach$/,' App').replace(/ Departures?$/,' Dep').replace(/ Tower$/,' Twr').replace(/ Ground$/,' Gnd');
/* Expected next CTAF and area frequency, with the distance to where each changes. The path ahead is the rest of
   the flight plan (to the active waypoint, then on), or else a straight line along your track while you're moving
   (GS over 5 kt); up to 80 NM, sampled every 0.5 NM at your current altitude. Next CTAF: the first point on the path
   within 10 NM of an ERSA aerodrome (the CTAF call distance; private strips and HLS are left out) whose CTAF differs from the one on screen. Next area
   frequency: the first point where the band at your altitude has a different frequency (DAH, as in the stack). */
const NX={key:'',ctaf:null,area:null};
function nxPath(la,lo){
  const pts=[[la,lo]], MAX=80;
  if(FP&&FP.pts[FP.i]){ for(let k=FP.i;k<FP.pts.length;k++) pts.push([FP.pts[k].la,FP.pts[k].lo]); }
  else if(st.trk!=null && st.gs>5){ const d=MAX/60*R, b=st.trk*R, p1=la*R, l1=lo*R;
    const p2=Math.asin(Math.sin(p1)*Math.cos(d)+Math.cos(p1)*Math.sin(d)*Math.cos(b));
    pts.push([p2/R,(l1+Math.atan2(Math.sin(b)*Math.sin(d)*Math.cos(p1),Math.cos(d)-Math.sin(p1)*Math.sin(p2)))/R]); }
  else return [];
  const out=[]; let D=0;
  for(let k=1;k<pts.length&&D<MAX;k++){ const [a0,o0]=pts[k-1],[a1,o1]=pts[k], L=distBrg(a0,o0,a1,o1)[0], n=Math.max(1,Math.ceil(L/0.5));
    for(let j=1;j<=n&&D+L*j/n<=MAX+0.01;j++) out.push([a0+(a1-a0)*j/n, o0+(o1-o0)*j/n, D+L*j/n]);
    D+=L; }
  return out; }
function nextFreqs(la,lo,altFt,ctafNow,adNow,cur){
  const key=[la.toFixed(3),lo.toFixed(3),Math.round(altFt/100),FP?FP.i+':'+FP.pts.length:'-',FP?'':Math.round((st.trk||0)/5)+(st.gs>5?'m':''),ctafNow,adNow.i,cur&&cur.f,st.heli,st.all].join('|');
  if(key!==NX.key){ NX.key=key; NX.ctaf=null; NX.area=null;
    const path=nxPath(la,lo);
    if(path.length){
      let la0=90,la1=-90,lo0=360,lo1=-360; for(const [a,o] of path){ la0=Math.min(la0,a); la1=Math.max(la1,a); lo0=Math.min(lo0,o); lo1=Math.max(lo1,o); }
      const pad=10/60, padl=pad/Math.cos(la*R);
      const ads=DATA.ap.filter(a=>a.s==='E' && a.t!=='H' && a.la>la0-pad&&a.la<la1+pad&&a.lo>lo0-padl&&a.lo<lo1+padl);
      for(const [pa,po,D] of path){
        if(!NX.ctaf){ let best=null; for(const a of ads){ if(Math.abs(a.la-pa)>0.17) continue; const d=distBrg(pa,po,a.la,a.lo)[0]; if(d<=10&&(!best||d<best.d)) best={a,d}; }
          if(best&&best.a!==adNow){ const f=ctafInfo(best.a).f; if(f&&f!==ctafNow) NX.ctaf={f,a:best.a,d:D}; } }
        if(!NX.area){ const t=terrainFt(pa,po), AS=airStack(pa,po,t!=null?t:0), b=AS.bands.find(b=>altFt>=b.L-50&&altFt<b.H)||AS.bands[AS.bands.length-1];
          if(b&&b.f&&b.f!==(cur&&cur.f)) NX.area={f:b.f,k:b.k==='CTR'?b.ctrCls:b.k,unit:b.unit,d:D}; }
        if(NX.ctaf&&NX.area) break; } } }
  const dd=d=>d<10?d.toFixed(1):Math.round(d);
  // distance before the name, so a narrow tile cuts the name, not the distance
  $('sCtafNx').innerHTML= NX.ctaf? `next <b>${NX.ctaf.f}</b> in ${dd(NX.ctaf.d)} NM · ${esc(NX.ctaf.a.i)}` : '';
  $('sAreaNx').innerHTML= NX.area? `next ${NX.area.k&&NX.area.k!=='G'&&NX.area.k!=='E'?'ATC ':''}<b>${NX.area.f}</b> in ${dd(NX.area.d)} NM · ${esc(unitShort(NX.area.unit))}` : '';
}
function heading(){ // returns {deg(true), src}
  if(st.trk!=null && (st.sim || (st.gs!=null && st.gs>5))) return {deg:st.trk, src:'TRK'};
  if(st.compass!=null) return {deg: norm(cmpTrue()+(CMP.n>=CMP_MIN?CMP.off:0)), src:'HDG'};
  return null;
}
function score(c,h){
  if(!st.ahead||!h) return c.d;
  const rel=Math.abs(((c.b-h.deg+540)%360)-180);
  return c.d*(1+Math.max(0,rel-20)/45) + (rel>100?8:0);
}

/* ---------- rendering ---------- */
const arrowSvg=deg=>`<svg viewBox="0 0 24 24" style="transform:rotate(${deg}deg)"><path d="M12 2 20 21 12 16.5 4 21Z"/></svg>`;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function titleCase(s){return s.toLowerCase().replace(/\b([a-z])/g,m=>m.toUpperCase())}

function freqRow(k,v,who,cls=''){
  return `<div class="fr ${cls}"><div class="k">${k}</div><div class="who">${who||''}</div><div class="v ${v?'':'none'}">${v||'—'}</div></div>`;
}

function render(){
  if(!st.pos){ return; }
  const [la,lo]=st.pos, varE=variation(la,lo), h=heading();
  $('hdgLbl').textContent=h?h.src+' °M':'TRK';
  $('sHdg').textContent=h?fmt3(h.deg-varE):'—';
  { // planned heading: to the active flight plan waypoint, else the Go to point; turn shown against your track/heading
    const fpT=FP&&FP.pts[FP.i], tg=fpT? {c:fpT.c||fpT.n,la:fpT.la,lo:fpT.lo} : GO;
    if(tg){ const b=distBrg(la,lo,tg.la,tg.lo)[1]; $('sPlan').textContent=fmt3(b-varE);
      let turn=''; if(h){ const d=((b-h.deg+540)%360)-180; turn= Math.abs(d)<3? 'on track' : (d<0?'L ':'R ')+Math.round(Math.abs(d))+'°'; }
      $('sPlanTo').textContent='→ '+(tg.c||''); $('sPlanTurn').textContent=turn; $('sPlanTurn').classList.toggle('off', !!h && Math.abs(((b-h.deg+540)%360)-180)>=10); }
    else { $('sPlan').textContent='—'; $('sPlanTo').textContent=''; $('sPlanTurn').textContent=''; }
  }

  const cands=candidates();
  let pick=null;
  if(st.pin){ const a=DATA.ap.find(x=>x.i===st.pin); if(a){const [d,b]=distBrg(la,lo,a.la,a.lo); pick={a,d,b}} }
  fpAdvance();
  let fpWhy=null;
  if(!pick){ const f=fpAerodrome(la,lo); if(f){ pick=f; fpWhy=f.why; } }
  if(!pick){ pick=[...cands].sort((x,y)=>score(x,h)-score(y,h))[0]; }
  $('adMode').textContent = st.pin?'Selected aerodrome': fpWhy ? fpWhy : (st.ahead&&h?'Closest ahead':'Closest aerodrome');
  $('unpin').hidden=!st.pin;

  const a=pick.a;
  $('adId').textContent=a.i;
  $('adName').textContent=titleCase(a.n)+(a.t==='H'?' · heliport':'');
  $('adDist').textContent=(pick.d<10?pick.d.toFixed(1):Math.round(pick.d))+' NM';
  $('adBrg').textContent=fmt3(pick.b-varE)+'°M';
  $('adElev').textContent=a.e!=null?('ELEV '+a.e):'';
  const rel=h?pick.b-h.deg:pick.b;
  $('adArrow').style.transform=`rotate(${rel}deg)`;

  // frequency stack
  let html='';
  const CI=ctafInfo(a);
  let csub=`<em>${CI.note}</em> ${chip(CI.src)}`;
  if(CI.other) csub+=`<br><span class="tag w">${CI.other.src} says ${CI.other.f}</span>`;
  const cf=(a.cf||[]).find(c=>c[0]==='c'); if(cf && CI.src==='ERSA') csub+=`<br><span class="tag">${SRC[cf[2]]||cf[2]} had ${cf[1]}</span>`;
  html+=freqRow('CTAF',CI.f,csub,'hero');
  $('sCtaf').textContent=CI.f||'—'; $('sCtafAd').textContent=a.i;
  $('ctafRow').innerHTML=html; html='';
  renderRunways(a,pick,h);
  renderFP(h,varE);
  renderGo(h,varE);
  renderCalls(a,pick,varE);
  if(a.a) html+=freqRow('ATIS',a.a[0],`Aerodrome terminal information${a.a.length>1?' · also '+a.a.slice(1).join(', '):''}${a.an?' · VOR '+a.an.join(', '):''} ${chip(SRC[a.aS])}`);
  if(a.w && !(a.a||[]).includes(a.w)) html+=freqRow('AWIS',a.w,`Automatic weather ${chip(SRC[a.wS])}`);
  if(a.x){ const seen=new Set();
    for(const x of a.x.filter(x=>['TWR','GND','SMC','DEL','APP','DEP','UNICOM'].includes(x[0]))){
      const key=x[0]+x[2]; if(seen.has(key)) continue; seen.add(key);
      const nm=esc(x[1]?titleCase(x[1]):a.i+' '+x[0].toLowerCase())+(x[4]?' <em>'+x[4]+'</em>':'');
      const ev=x[5]?`<br><span class="ev">ERSA: “${esc(x[5].split(' / ')[0])}”</span>`:'';
      const multi=x[0]==='TWR' && !x[4] && a.x.filter(y=>y[0]==='TWR').length>1 ? '<br><span class="ev">ERSA lists more than one tower frequency: the ATIS says which to use</span>':'';
      html+=freqRow(x[0]==='SMC'?'GND':(x[4]?'TWR '+x[4][0]:x[0]),x[2],`${nm}${x[3]&&!/^\(\d/.test(x[3])?' · '+esc(x[3]):''} ${chip(SRC[a.xS])}${ev}${multi}`);
    } }
  if(a.fia){ for(const f of a.fia) html+=freqRow('AREA',f[1],`<em>${esc(titleCase(f[0]))}</em>${f[2]?' · '+esc(f[2].toLowerCase()):''} at ${a.i} ${chip('ERSA')}`); }

  // airspace & frequency at your position, by altitude (DAH-derived)
  const altKnown = st.alt!=null, altFt = altKnown? st.alt : 0;
  const near=cands[0], terr=terrainFt(la,lo); terPrefetch(la,lo);
  const gnd = terr!=null ? terr : (near && near.d<15 && near.a.e!=null ? near.a.e : 0);
  $('sAgl').textContent = terr!=null && altKnown ? 'AGL '+Math.max(0,Math.round((altFt-terr)/10)*10) : (terr!=null?'GND '+Math.round(terr/10)*10:'');
  const AS=airStack(la,lo,gnd);
  const cur=AS.bands.find(b=>altFt>=b.L-50 && altFt<b.H) || AS.bands[AS.bands.length-1];
  { // status tile: class here and its cap (top of this band = where the next class starts)
    const k=cur? (cur.k==='CTR'?cur.ctrCls:cur.k) : null;
    const inP=AS.prd.find(p=>altFt>=p.L-50&&altFt<p.H);
    $('sCls').textContent = k ? k+(inP?' · '+(inP.k==='R'?'R':'D'):'') : '—';
    $('sCls').style.color = k ? `var(--as-${k==='A'?'c':k.toLowerCase()})` : '';
    if(k==='G') $('sCls').style.color='var(--ink)';
    $('sCap').textContent = cur ? (cur.H>=60000?'to UNL':'cap '+limTxt(cur.H)) : '';
    $('sLL').textContent = cur ? 'LL '+(cur.L<=0?'SFC':limTxt(cur.L)) : '';
    if(inP) $('sCap').textContent+=' · '+inP.n.split(' ')[0];
  }
  if(cur){
    const above=AS.bands.filter(b=>b.L>=cur.H-50).sort((x,y)=>x.L-y.L)[0];
    const what = cur.k==='G' ? `Class G · <em>${esc(cur.unit||'FIA')}</em>`
               : `Class ${cur.k==='CTR'?cur.ctrCls:cur.k} · <em>${esc(cur.unit||'see ERSA')}</em>${cur.k==='E'?'':' · clearance required'}${cur.alt&&cur.alt.length?`<br>ERSA also lists ${esc(cur.alt.slice(0,3).join(', '))}${cur.alt.length>3?' …':''}`:''}`;
    let sub=`${what} ${chip(cur.us)}<br><span class="tag">${limTxt(cur.L)}–${limTxt(cur.H)}</span> ${chip(ASRC)}${altKnown?'':' <span class="tag w">alt unknown · SFC assumed</span>'}`;
    for(const r of AS.rev) sub+=`<br><span class="tag w">${esc(titleCase(r.x.n))}: tower likely closed now, so class G</span> <span class="ev">ERSA ${r.a.i}: “${esc(r.ev)}”</span>`;
    if(above) sub+=`<br>Above ${limTxt(above.L)}: class ${above.k==='CTR'?above.ctrCls:above.k}${above.f?` <b class="mono">${above.f}</b>`:''}`;
    html+=freqRow(cur.k==='G'||cur.k==='E'?'AREA':'ATC',cur.f,sub,cur.k==='G'||cur.k==='E'?'':'ctl');
  } else html+=freqRow('AREA','', 'No airspace data here');
  nextFreqs(la,lo,altFt,CI.f,a,cur);
  { const g=!cur||cur.k==='G'||cur.k==='E'; $('sAreaLbl').textContent=g?'AREA':'ATC'; $('sArea').textContent=cur&&cur.f||'—';
    $('sArea').style.color=g?'':'var(--as-'+((cur.k==='CTR'?cur.ctrCls:cur.k)==='A'?'c':(cur.k==='CTR'?cur.ctrCls:cur.k).toLowerCase())+')';
    $('sAreaWho').textContent=cur? unitShort(cur.unit) : ''; }
  for(const b of AS.ba.filter(b=>altFt>=b.L-50&&altFt<b.H))
    html+=freqRow('BCST',b.f,`<em>${esc(titleCase(b.n))} broadcast area</em> · ${limTxt(b.L)}–${limTxt(b.H)} ${chip(ASRC)}`);
  for(const p of AS.prd.filter(p=>altFt>=p.L-50&&altFt<p.H))
    html+=freqRow(p.k==='R'?'R AREA':'DANGER','',`<em>${esc(p.n)}</em><br><span class="tag w">${limTxt(p.L)}–${p.hik==='NOTAM'?'NOTAM':limTxt(p.H)}</span> check status`,'prd');
  // the selected aerodrome's own approach unit
  const adName=callName(a.n).toLowerCase(), shown=new Set([cur&&cur.f]);
  for(const x of (a.x||[]).filter(x=>x[0]==='APP'||x[0]==='DEP')) shown.add(x[2]);
  for(const s of DATA.sec.filter(s=>(s.k==='APP') && s.n.toLowerCase().startsWith(adName+' ') && !(a.xS==='E'))){
    if(shown.has(s.f)) continue; shown.add(s.f);
    html+=freqRow('APP',s.f,`<em>${esc(s.n)}</em> · for ${a.i} ${chip('VATPAC')}`);
  }
  // vertical stack for this position
  if(AS.bands.length){
    html+=`<div class="vstack"><div class="lbl">Airspace above you${altKnown?' · GPS alt '+Math.round(altFt/10)*10+' ft':''}${terr!=null?' · terrain '+Math.round(terr/10)*10+' ft':''}</div>`+
      [...AS.bands,...AS.prd].sort((x,y)=>y.L-x.L||y.H-x.H).map(b=>{
        const on=b===cur, cls=b.k==='CTR'?b.ctrCls:b.k, isP=b.k==='R'||b.k==='Q';
        return `<div class="vb ${on?'on':''} ${isP?'p':''}"><span class="mono">${limTxt(b.L)}–${b.hik==='NOTAM'?'NTM':limTxt(b.H)}</span><span><b class="cls c-${isP?b.k:cls}">${isP?(b.k==='R'?'R':'D'):cls}</b> ${esc(isP?b.n:(b.unit||b.n))} ${b.us&&b.us!=='ERSA'&&b.us!=='DAH'?chip(b.us):''}</span><span class="mono f">${b.f||''}</span></div>`;
      }).join('')+`<div class="vnote">The area frequency changes with altitude and with each CTA step. GPS altitude is geometric, not pressure altitude, so near a boundary go by your altimeter and the chart.</div></div>`;
  }
  drawMap(la,lo,h,pick,AS,altFt);
  $('stack').innerHTML=html;

  // list
  const lst=[...cands].slice(0,8);
  $('list').innerHTML=lst.map(c=>{
    const r=h?c.b-h.deg:c.b;
    return `<button class="row ${c.a===a?'sel':''}" data-i="${c.a.i}">
      <span class="ra">${arrowSvg(r)}</span>
      <span class="id">${c.a.i}</span>
      <span class="nm">${esc(titleCase(c.a.n))}</span>
      <span class="r">${c.d<10?c.d.toFixed(1):Math.round(c.d)} NM · ${fmt3(c.b-varE)}°<br><span class="c">${(()=>{const ci=ctafInfo(c.a); return ci.f? ci.f+(ci.src==='ERSA'?'':'*') : 'TWR';})()}</span>${c.a.a?' / ATIS '+c.a.a[0]:''}</span></button>`;
  }).join('');
  $('listMode').textContent=h?'Arrows relative to '+h.src.toLowerCase():'Arrows north-up (no heading yet)';
}

/* ---------- sensors ---------- */
function onPos(p){
  if(st.sim) return;
  const c=p.coords;
  st.pos=[c.latitude,c.longitude]; st.acc=c.accuracy;
  st.alt = c.altitude!=null? c.altitude*3.28084 : null;
  st.gs = c.speed!=null? c.speed*1.943844 : st.gs;
  if(c.heading!=null && !isNaN(c.heading) && (c.speed||0)>2) st.trk=c.heading;
  cmpLearn();
  $('sAcc').textContent='±'+Math.round(c.accuracy)+' m';
  $('gpsDot').className='dot '+(c.accuracy<50?'ok':c.accuracy<300?'warn':'bad');
  $('sGs').textContent=st.gs!=null?Math.round(st.gs):'—';
  $('sAlt').textContent=st.alt!=null?Math.round(st.alt/10)*10:'—';
  fpLogFix(); render();
}
function onPosErr(e){
  if(st.sim) return;
  $('gpsDot').className='dot bad';
  $('sAcc').textContent=e.code===1?'denied':'no fix';
  $('startBox').hidden=false;
  $('startBox').firstElementChild.textContent = e.code===1
    ? 'Location permission was refused. Allow location for this site in your browser settings, then tap Start.'
    : 'Waiting for a GPS fix. Move clear of buildings or the aircraft roof if you can.';
}
/* Android (Chrome on a Pixel): deviceorientationabsolute gives alpha/beta/gamma (Z-X'-Y'' Euler angles, earth frame
   x East, y North, z up), not a heading, and 360-alpha is only right with the phone lying flat. In a cradle the phone
   stands nearly upright, so the heading comes from whichever is more horizontal: the top of the screen (phone flat)
   or the back of the phone (phone upright, screen facing you), worked out from the full rotation. That matches what
   iOS returns as webkitCompassHeading. Landscape: "top of the screen" follows the screen orientation. */
function tiltHeading(al,be,ga,so){
  const a=al*R,b=(be||0)*R,g=(ga||0)*R, ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b),cg=Math.cos(g),sg=Math.sin(g);
  // R = Rz(a) Rx(b) Ry(g); columns are the device x, y, z axes in earth coordinates
  const X=[ca*cg-sa*sb*sg, sa*cg+ca*sb*sg, -cb*sg], Y=[-sa*cb, ca*cb, sb], Z=[ca*sg+sa*sb*cg, sa*sg-ca*sb*cg, cb*cg];
  const u=so*R, top=[0,1,2].map(i=>Math.sin(u)*X[i]+Math.cos(u)*Y[i]), back=Z.map(v=>-v);
  const v= Math.hypot(top[0],top[1])>=Math.hypot(back[0],back[1]) ? top : back;
  return norm(Math.atan2(v[0],v[1])/R); }
let lastOri=0;
function onOri(e){
  const so=(screen.orientation&&screen.orientation.angle)||window.orientation||0;
  let h=null, mag=true;
  if(e.webkitCompassHeading!=null){ h=norm(e.webkitCompassHeading+so); mag=true; }      // iOS: magnetic, tilt-compensated
  else if(e.absolute && e.alpha!=null){ h=tiltHeading(e.alpha,e.beta,e.gamma,so); mag=true; }   // Android: magnetometer north
  if(h==null) return;
  st.compass=h; st.compassMag=mag; st.compassT=performance.now();
  const now=performance.now(); if(now-lastOri>400){lastOri=now; render();}
}
async function start(){
  if(!('geolocation' in navigator)){ $('startBox').firstElementChild.textContent='This browser has no location support.'; return; }
  wakeAcquire();
  if(!watching){watching=true; navigator.geolocation.watchPosition(onPos,onPosErr,{enableHighAccuracy:true,maximumAge:2000,timeout:20000});}
  try{
    if(typeof DeviceOrientationEvent!=='undefined' && typeof DeviceOrientationEvent.requestPermission==='function'){
      const r=await DeviceOrientationEvent.requestPermission(); if(r==='granted') addEventListener('deviceorientation',onOri);
      else throw new Error('compass');
    }else if('ondeviceorientationabsolute' in window){ addEventListener('deviceorientationabsolute',onOri); }
    else addEventListener('deviceorientation',onOri);
  }catch(e){
    $('startBox').hidden=false; $('startBox').firstElementChild.textContent='GPS is running. Tap to enable the compass, so arrows work while stationary.';
    $('startBtn').textContent='Enable compass'; ls.set('started',true); return;
  }
  $('startBox').hidden=true; ls.set('started',true);
}

/* ---------- controls ---------- */
function syncBtns(){
  $('bAhead').setAttribute('aria-pressed',st.ahead); $('bHeli').setAttribute('aria-pressed',st.heli);
  $('bAll').setAttribute('aria-pressed',st.all);
  $('bTheme').textContent='Theme: '+st.theme;
  if(st.theme==='auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme',st.theme);
  const tc={auto:null,light:'#eef1ee',dark:'#0d1417',night:'#000000'}[st.theme];
  document.querySelector('meta[name=theme-color]').content=tc||(matchMedia('(prefers-color-scheme: dark)').matches?'#0d1417':'#eef1ee');
}
let watching=false;
$('startBtn').onclick=start;
$('bAhead').onclick=()=>{st.ahead=!st.ahead;ls.set('ahead',st.ahead);syncBtns();render()};
$('bHeli').onclick=()=>{SEARCH=null;st.heli=!st.heli;ls.set('heli',st.heli);syncBtns();render()};
$('bAll').onclick=()=>{st.all=!st.all;ls.set('all',st.all);syncBtns();render()};
$('bTheme').onclick=()=>{const o=['auto','light','dark','night'];st.theme=o[(o.indexOf(st.theme)+1)%o.length];ls.set('theme',st.theme);syncBtns()};
/* Keep screen on. The browser drops a wake lock whenever the page is hidden (screen off, app switch, notification
   shade on some phones), so the wish is kept separately (st.wakeWant, remembered) and the lock is taken again on return,
   and on any tap if that fails. Fallback where the Wake Lock API is missing or refused (older iOS, and Home Screen apps
   before iOS 18.4): a tiny muted looping video, which also stops the screen dimming. */
let wakeVid=null;
function wakeVideo(on){
  if(on){ if(!wakeVid){ wakeVid=document.createElement('video'); wakeVid.muted=true; wakeVid.loop=true; wakeVid.playsInline=true; wakeVid.setAttribute('playsinline','');
      wakeVid.setAttribute('aria-hidden','true'); wakeVid.style.cssText='position:fixed;width:1px;height:1px;opacity:0.01;pointer-events:none;left:0;bottom:0';
      wakeVid.src='data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAMpbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAB9AAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAlN0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAB9AAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAABAAAAAQAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAAfQAAAAAAABAAAAAAHLbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAABAAAAAgABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABdm1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAATZzdGJsAAAAtnN0c2QAAAAAAAAAAQAAAKZhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAABAAEABIAAAASAAAAAAAAAABFUxhdmM2MC4zMS4xMDIgbGlieDI2NAAAAAAAAAAAAAAAGP//AAAALGF2Y0MBQsAK/+EAFWdCwAraewEQAAADABAAAAMAIPEiagEABGjOD8gAAAAQcGFzcAAAAAEAAAABAAAAFGJ0cnQAAAAAAAAKOAAACjgAAAAYc3R0cwAAAAAAAAABAAAAAgAAQAAAAAAUc3RzcwAAAAAAAAABAAAAAQAAABxzdHNjAAAAAAAAAAEAAAABAAAAAgAAAAEAAAAcc3RzegAAAAAAAAAAAAAAAgAAAoUAAAAJAAAAFHN0Y28AAAAAAAAAAQAAA1kAAABidWR0YQAAAFptZXRhAAAAAAAAACFoZGxyAAAAAAAAAABtZGlyYXBwbAAAAAAAAAAAAAAAAC1pbHN0AAAAJal0b28AAAAdZGF0YQAAAAEAAAAATGF2ZjYwLjE2LjEwMAAAAAhmcmVlAAAClm1kYXQAAAJvBgX//2vcRem95tlIt5Ys2CDZI+7veDI2NCAtIGNvcmUgMTY0IHIzMTA4IDMxZTE5ZjkgLSBILjI2NC9NUEVHLTQgQVZDIGNvZGVjIC0gQ29weWxlZnQgMjAwMy0yMDIzIC0gaHR0cDovL3d3dy52aWRlb2xhbi5vcmcveDI2NC5odG1sIC0gb3B0aW9uczogY2FiYWM9MCByZWY9MSBkZWJsb2NrPTE6MDowIGFuYWx5c2U9MHgxOjB4MTExIG1lPWhleCBzdWJtZT0yIHBzeT0xIHBzeV9yZD0xLjAwOjAuMDAgbWl4ZWRfcmVmPTAgbWVfcmFuZ2U9MTYgY2hyb21hX21lPTEgdHJlbGxpcz0wIDh4OGRjdD0wIGNxbT0wIGRlYWR6b25lPTIxLDExIGZhc3RfcHNraXA9MSBjaHJvbWFfcXBfb2Zmc2V0PTAgdGhyZWFkcz0xIGxvb2thaGVhZF90aHJlYWRzPTEgc2xpY2VkX3RocmVhZHM9MCBucj0wIGRlY2ltYXRlPTEgaW50ZXJsYWNlZD0wIGJsdXJheV9jb21wYXQ9MCBjb25zdHJhaW5lZF9pbnRyYT0wIGJmcmFtZXM9MCB3ZWlnaHRwPTAga2V5aW50PTI1MCBrZXlpbnRfbWluPTEgc2NlbmVjdXQ9NDAgaW50cmFfcmVmcmVzaD0wIHJjX2xvb2thaGVhZD0xMCByYz1jcmYgbWJ0cmVlPTEgY3JmPTIzLjAgcWNvbXA9MC42MCBxcG1pbj0wIHFwbWF4PTY5IHFwc3RlcD00IGlwX3JhdGlvPTEuNDAgYXE9MToxLjAwAIAAAAAOZYiEBb///w9FAAFPf4AAAAAFQZogFfU='; document.body.appendChild(wakeVid); }
    return wakeVid.play().then(()=>true,()=>false); }
  if(wakeVid) wakeVid.pause(); return Promise.resolve(false); }
async function wakeAcquire(){
  if(!st.wakeWant || document.visibilityState!=='visible') return wakeSync();
  if(st.wake && !st.wake.released) return wakeSync();
  let ok=false;
  if('wakeLock' in navigator){ try{ st.wake=await navigator.wakeLock.request('screen'); ok=true;
      st.wake.addEventListener('release',()=>{ st.wake=null; wakeSync(); }); }catch(e){ st.wake=null; } }
  st.wakeVia= ok? 'lock' : (await wakeVideo(true))? 'video' : null;
  if(ok) wakeVideo(false);
  wakeSync(); }
async function wakeRelease(){ if(st.wake){ try{await st.wake.release()}catch(e){} } st.wake=null; wakeVideo(false); st.wakeVia=null; wakeSync(); }
function wakeSync(){ const b=$('bWake'), held=!!(st.wake&&!st.wake.released) || (st.wakeVia==='video'&&wakeVid&&!wakeVid.paused);
  b.setAttribute('aria-pressed',!!st.wakeWant);
  b.textContent= !st.wakeWant? 'Keep screen on' : held? 'Screen stays on' : 'Screen on: tap to re-arm'; }
// Android/Chrome: offer "Install app" (the installed app runs full screen and keeps its offline data)
let instEv=null;
addEventListener('beforeinstallprompt',e=>{ e.preventDefault(); instEv=e; $('bInstall').hidden=false; });
addEventListener('appinstalled',()=>{ instEv=null; $('bInstall').hidden=true; });
$('bInstall').onclick=async()=>{ if(!instEv) return; instEv.prompt(); try{ await instEv.userChoice; }catch(e){} instEv=null; $('bInstall').hidden=true; };
$('bCmp').onclick=()=>{ Object.assign(CMP,{off:0,n:0,s:0,c:0}); cmpPrev=null; ls.set('cmp',CMP); cmpSync(); render(); };
cmpSync();
$('bWake').onclick=()=>{ st.wakeWant=!st.wakeWant; ls.set('wake',st.wakeWant); st.wakeWant? wakeAcquire() : wakeRelease(); };
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') wakeAcquire(); });
document.addEventListener('pointerdown',e=>{ if(e.target.closest&&e.target.closest('#bWake')) return; if(st.wakeWant && !(st.wake&&!st.wake.released) && !(wakeVid&&!wakeVid.paused)) wakeAcquire(); },true);
st.wakeWant=ls.get('wake',false); wakeSync(); wakeAcquire();   // the Wake Lock API needs no tap; the video fallback waits for the first one
$('list').addEventListener('click',e=>{const b=e.target.closest('.row'); if(!b) return; st.pin=b.dataset.i; render(); window.scrollTo({top:0,behavior:'smooth'})});
const RANGES=[2.5,5,10,20,40,80];
// buttons step through RANGES; pinch (or the mouse wheel) zooms smoothly in between, so step to the next one either way
$('mapIn').onclick=()=>{ MAP.range=[...RANGES].reverse().find(r=>r<MAP.range-0.01)||RANGES[0]; ls.set('mapRange',MAP.range); render(); };
$('mapOut').onclick=()=>{ MAP.range=RANGES.find(r=>r>MAP.range+0.01)||RANGES[RANGES.length-1]; ls.set('mapRange',MAP.range); render(); };
const rngTxt=r=>(r<10? (Math.round(r*10)/10) : Math.round(r))+' NM';
$('mapCtaf').onclick=()=>{ MAP.ctaf=!MAP.ctaf; ls.set('mapCtaf',MAP.ctaf); $('mapCtaf').setAttribute('aria-pressed',MAP.ctaf); render(); };
$('mapCtaf').setAttribute('aria-pressed',MAP.ctaf);
$('mapTer').onclick=()=>{ MAP.ter=!MAP.ter; ls.set('mapTer',MAP.ter); $('mapTer').setAttribute('aria-pressed',MAP.ter); render(); };
$('mapTer').setAttribute('aria-pressed',MAP.ter);
$('mapUp').onclick=()=>{ MAP.up=MAP.up==='trk'?'north':'trk'; ls.set('mapUp',MAP.up); render(); };
addEventListener('resize',()=>render());
$('goIn').value=GO?GO.c:'';
$('goIn').addEventListener('keydown',e=>{ if(e.key!=='Enter') return; e.preventDefault(); const p=findPoint($('goIn').value);
  if(p) setGo(p); else { $('goErr').textContent=`${$('goIn').value.trim().toUpperCase()} not found. Use a VFR waypoint code (CARR), navaid ident (AV), IFR waypoint or aerodrome code.`; $('goErr').hidden=false; } });
$('goIn').addEventListener('change',()=>{ const p=findPoint($('goIn').value); if(p) setGo(p); });
suggest($('goIn'),$('goList'),p=>{ if(p.k==='AD') st.pin=p.c; setGo(p); $('goIn').blur(); });
suggest($('simPos'),$('simList'),p=>{ $('simPos').value= p.k==='TOWN'? p.la.toFixed(5)+', '+p.lo.toFixed(5) : p.c; simApply(); $('simPos').blur(); });
$('goClr').onclick=()=>setGo(null);
$('fpFile').addEventListener('change',async e=>{ const f=e.target.files[0]; if(!f) return; $('fpErr').hidden=true;
  try{ const fp=parseGPX(await f.text()); $('fpToggle').setAttribute('aria-expanded','true'); fpSet(fp); }
  catch(err){ $('fpErr').textContent=err.message; $('fpErr').hidden=false; }
  e.target.value=''; });
$('fpToggle').onclick=()=>{ const open=$('fpToggle').getAttribute('aria-expanded')!=='true'; $('fpToggle').setAttribute('aria-expanded',open); ls.set('fpOpen',open); render(); };
$('fpToggle').setAttribute('aria-expanded',ls.get('fpOpen',true));
$('fpPrev').onclick=()=>{ if(FP&&FP.i>0) fpPick(FP.i-1); };
$('fpSkip').onclick=()=>{ if(FP&&FP.i<FP.pts.length-1) fpPick(FP.i+1); };
$('fpLog').onclick=()=>{ ls.set('tlog',TLOG.pts); const n=TLOG.pts.filter(p=>p[1]!=='ev').length; if(!n){ const b=$('fpLog'), t=b.textContent; b.textContent='No GPS log yet'; setTimeout(()=>b.textContent=t,2500); return; }
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([fpLogGpx()],{type:'application/gpx+xml'})); a.download='radio-calls-log-'+new Date().toISOString().slice(0,16).replace(/:/g,'').replace('T','-')+'.gpx'; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href); a.remove();},2000); };
$('fpRev').onclick=()=>{ if(!FP) return; FP.pts.reverse(); fpPick(Math.min(1,FP.pts.length-1)); };
$('fpClear').onclick=()=>{ fpSet(null); setGo(null); };
$('fpLegs').addEventListener('click',e=>{ const li=e.target.closest('li'); if(!li||!FP) return; fpPick(+li.dataset.k); });
// tap the map to pick a waypoint, navaid or aerodrome as go-to
// drag to pan (one finger or mouse); pinch with two fingers to zoom; a tap without movement still picks a point
{ const cv=$('map'); let drag=null, raf=0, pinch=null; const ptr=new Map();
  const redraw=()=>{ raf=0; if(MAP.last) drawMap(...MAP.last); };
  const zoomTo=r=>{ MAP.range=Math.min(80,Math.max(2.5,r)); if(!raf) raf=requestAnimationFrame(redraw); };
  const spread=()=>{ const [a,b]=[...ptr.values()]; return Math.hypot(a.x-b.x,a.y-b.y)||1; };
  const startDrag=e=>{ const c=MAP.pan||[MAP.last[0],MAP.last[1]]; drag={x:e.clientX,y:e.clientY,c,moved:false,id:e.pointerId}; };
  cv.addEventListener('pointerdown',e=>{ if(!MAP.last) return; cv.setPointerCapture(e.pointerId); ptr.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(ptr.size===2){ pinch={d0:spread(), r0:MAP.range}; if(drag) drag.moved=true; drag=null; return; }   // two fingers: zoom, no pan or tap
    if(ptr.size>2) return;
    // start from the current view centre (your position if not panned); dragging always works north up
    startDrag(e); });
  cv.addEventListener('pointermove',e=>{ if(ptr.has(e.pointerId)) ptr.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pinch && ptr.size>=2){ zoomTo(pinch.r0*pinch.d0/spread()); return; }
    if(!drag||e.pointerId!==drag.id) return;
    const dx=e.clientX-drag.x, dy=e.clientY-drag.y; if(!drag.moved && Math.hypot(dx,dy)<6) return;
    drag.moved=true; const sc=MAP.sc, cosl=MAP.cosl||1;
    MAP.pan=[drag.c[0]+dy/sc/60, drag.c[1]-dx/sc/(60*cosl)];
    if(!raf) raf=requestAnimationFrame(redraw); });
  const end=e=>{ ptr.delete(e.pointerId);
    if(pinch){ if(ptr.size<2){ pinch=null; ls.set('mapRange',MAP.range); render(); drag=null; } return; }   // lift both fingers before panning again
    if(!drag||e.pointerId!==drag.id) return; const d=drag; drag=null;
    if(d.moved){ render(); return; }
    const r=cv.getBoundingClientRect(), x=e.clientX-r.left, y=e.clientY-r.top;
    let best=null,bd=22; for(const it of (MAP.hits||[])){ const q=Math.hypot(it.x-x,it.y-y); if(q<bd){bd=q;best=it.p;} }
    if(best){ if(best.k==='AD') st.pin=best.c;   // tapping an aerodrome also selects it (card, frequencies, calls)
      setGo(best); } };
  cv.addEventListener('pointerup',end); cv.addEventListener('pointercancel',e=>{ ptr.delete(e.pointerId); if(ptr.size<2) pinch=null; drag=null; });
  // mouse wheel / trackpad pinch on a computer
  let wheelT=null;
  cv.addEventListener('wheel',e=>{ if(!MAP.last) return; e.preventDefault(); zoomTo(MAP.range*Math.exp(e.deltaY*(e.ctrlKey?0.01:0.002)));
    clearTimeout(wheelT); wheelT=setTimeout(()=>{ ls.set('mapRange',MAP.range); render(); },250); },{passive:false});
  $('mapHome').onclick=()=>{ MAP.pan=null; render(); };
}
$('unpin').onclick=()=>{st.pin=null;render()};


/* ---------- CTAF radio call guide ---------- */
const PTS=['north','north-east','east','south-east','south','south-west','west','north-west'];
// CTAF/tower location name. ERSA's "CITY/AERODROME" usually means the aerodrome part is said (Melbourne/Moorabbin -> Moorabbin).
// Local usage that differs, confirmed by a pilot who flies there, goes in CALL_AS.
const CALL_AS={YBRS:'Barwon Heads'};   // ERSA "BARWON HEADS/GEELONG": local call is "Barwon Heads traffic"
function callName(n,icao){ if(icao&&CALL_AS[icao]) return CALL_AS[icao];
  const strip=x=>x.replace(/\b(airport|aerodrome|airfield|international|intl|regional|ala|heliport|hls)\b/gi,'').replace(/\s+/g,' ').trim();
  const parts=n.split('/'); let t=strip(parts[parts.length-1]); if(!t && parts.length>1) t=strip(parts[0]);   // BROOME/INTL -> Broome
  return titleCase(t||n); }
function sayLevel(ft){ if(ft==null) return '<i>[level]</i>'; if(ft>10500) return 'flight level '+Math.round(ft/500)*5; const r=Math.max(100,Math.round(ft/100)*100); return r.toLocaleString('en-AU')+' feet'; }
/* tower hours from ERSA "TWR HR" notes, evaluated in the aerodrome's local time */
const DOW=['SUN','MON','TUE','WED','THU','FRI','SAT'];
function firstSun(y,m){ const d=new Date(Date.UTC(y,m,1)); return 1+((7-d.getUTCDay())%7); }
function isHDS(state,now){ if(!['NSW','VIC','ACT','TAS','SA'].includes(state)) return false;
  const y=now.getUTCFullYear(), start=Date.UTC(y,9,firstSun(y,9),16), end=Date.UTC(y,3,firstSun(y,3),16); // ~2-3am local
  return now.getTime()>=start || now.getTime()<end; }
function twrStatus(a,now=new Date()){
  const L=a.cnotes||[]; const i=L.findIndex(l=>/TWR HR/.test(l)); if(i<0 || a.utc==null) return null;
  const hds=isHDS(a.st,now), off=a.utc+(hds?1:0), loc=new Date(now.getTime()+off*3600e3);
  const dow=DOW[loc.getUTCDay()], mins=loc.getUTCHours()*60+loc.getUTCMinutes();
  const ent=[]; let hctx=false;
  for(let j=i;j<Math.min(L.length,i+14);j++){
    const l=L[j]; if(j>i && /^\d+\.\s/.test(l)) break;
    if(/During HDS/i.test(l)) hctx=true;
    const u=l.match(/(\d{4})\s*-\s*(\d{4})\s*UTC/); if(!u) continue;
    const lm=l.match(/\((\d{4})\s*-\s*(\d{4})\s*Local\)/);
    const dm=l.match(/\b(MON|TUE|WED|THU|FRI|SAT|SUN)(?:\s*-\s*(MON|TUE|WED|THU|FRI|SAT|SUN))?\b/);
    let days=DOW; if(dm){ const a0=DOW.indexOf(dm[1]), b0=DOW.indexOf(dm[2]||dm[1]); days=[]; for(let k=a0;;k=(k+1)%7){ days.push(DOW[k]); if(k===b0) break; } }
    if(/\bJF\b/.test(l)&&!dm) days=['SAT','SUN'];
    const tm=x=>Math.floor(x/100)*60+x%100;
    let s0,e0; if(lm){ s0=tm(+lm[1]); e0=tm(+lm[2]); } else { s0=(tm(+u[1])+off*60)%1440; e0=(tm(+u[2])+off*60)%1440; }
    ent.push({days,s0,e0,hds:hctx||/\bHDS\b/.test(l)});
  }
  if(!ent.length) return null;
  let use=ent.filter(e=>e.hds===hds); if(!use.length) use=ent.filter(e=>!e.hds);
  const inside=e=> e.s0<e.e0 ? mins>=e.s0&&mins<e.e0 : mins>=e.s0||mins<e.e0;
  const on=use.some(e=>e.days.includes(dow)&&inside(e));
  const today=use.filter(e=>e.days.includes(dow)).map(e=>`${String(Math.floor(e.s0/60)).padStart(2,'0')}${String(e.s0%60).padStart(2,'0')}–${String(Math.floor(e.e0/60)).padStart(2,'0')}${String(e.e0%60).padStart(2,'0')}`);
  return {on, today:today.join(', '), hds};
}
function ersaProcHtml(a,heli){
  const out=[]; const secs=Object.entries(a.proc||{});
  if(a.cnotes) secs.unshift(['COMMUNICATIONS NOTES',a.cnotes]);
  for(const [h,lines] of secs){
    out.push(`<h4>${esc(titleCase(h))}</h4>`); let inHel=false;
    for(const l of lines){
      const top=/^\d+\.\s/.test(l);
      if(top) inHel=/HELICOPTER|HEL\b/i.test(l);
      const t=esc(l);
      out.push(`<p class="${top?'n':''}">${heli&&(inHel||/\bHEL\b/.test(l))?`<mark>${t}</mark>`:t}</p>`);
    }
  }
  return out.join('');
}
function renderCalls(a,pick,varE){
  const loc=callName(a.n,a.i), T=v=>esc(v), heli=$('cCat').value==='H';
  const typeRaw=$('cType').value.trim(), csRaw=sayCallsign($('cSign').value);
  const type=typeRaw?T(typeRaw):'<i>[type]</i>', cs=csRaw?T(csRaw):'<i>[callsign]</i>';
  const fromBrg=norm(pick.b+180-varE), pt=PTS[Math.round(fromBrg/45)%8];
  // position from the aerodrome: "<n> mile(s) <direction>". When you're at or over the field there's no real
  // inbound position, so show a placeholder at the 10 NM call point instead of "overhead".
  const nmi=Math.max(1,Math.round(pick.d)), atField=pick.d<0.75;
  let dist= atField ? '<i>[10 miles north]</i>' : `${nmi} mile${nmi===1?'':'s'} ${pt}`;
  const nv=nearestVFR(st.pos[0],st.pos[1],1.5); if(nv && !atField) dist=`over ${esc(titleCase(nv.p.n))}, ${dist}`;
  const ovr = atField ? 'overhead' : dist;   // "overhead" is right for an overflying call over the field
  const sel=$('cRwy'), opts=(a.rw||[]).flatMap(r=>[r[0],r[1]]);
  if(sel.dataset.ad!==a.i){ sel.dataset.ad=a.i; sel.innerHTML='<option value="">[XX]</option>'+opts.map(o=>`<option value="${o}">${o}${(a.cct||{})[o]&&a.cct[o][0]==='R'?' (RH)':''}</option>`).join(''); }
  const rv=sel.value, rhTxt=rv&&(a.cct||{})[rv]&&a.cct[rv][0]==='R'?' right-hand':'';
  const lvl=sayLevel(st.alt), rwy= rv? `runway ${rv}` : 'runway <i>[XX]</i>';
  const X=a.x||[], twrs=X.filter(x=>x[0]==='TWR'), gnd=X.find(x=>x[0]==='GND'), towered=twrs.length>0;
  const ts=towered?twrStatus(a):null, K=a.keys||{};
  let mode=$('cMode').value; if(mode==='auto') mode = towered && (ts? ts.on : !a.c) ? 'twr' : 'ctaf';
  if(!towered && mode==='twr') mode='ctaf';
  const CI=ctafInfo(a);
  let calls=[], modeTxt='', note='';
  if(mode==='twr'){
    const gn=gnd?titleCase(gnd[1]):null;
    // East/West tower split (from ERSA text): suggest the side you are on
    // which side of the field: your position, or (on the aerodrome) the direction of your next flight plan waypoint
    const fpT=FP&&FP.pts[FP.i], onAd=pick.d<0.5;
    const sideBrg = !onAd ? norm(pick.b+180) : fpT ? distBrg(a.la,a.lo,fpT.la,fpT.lo)[1] : null;
    const sideNow = sideBrg==null ? null : sideBrg<180 ? 'East' : 'West';
    const twSide = twrs.find(t=>t[4]===sideNow) || twrs[0];
    const tw=titleCase(twSide[1]||loc+' Tower');
    const tf=twSide[2];
    const twAll=twrs.map(t=>`${titleCase(t[1])}${t[4]?' '+t[4]:''} ${t[2]}`).join(' · ');
    const sideNote = twrs.some(t=>t[4]) && !sideNow ? ` You are on the aerodrome: ERSA ties ${twrs.map(t=>`${t[4]||'?'} ${t[2]}`).join(' and ')} to departures and arrivals on that side. The ATIS says which frequency is in use.`
      : twrs.some(t=>t[4]) ? ` ${onAd?`Your next waypoint (${esc(fpT.c||fpT.n)}) is to the ${sideNow.toLowerCase()}`:`You are ${sideNow.toLowerCase()} of the aerodrome`}, so the suggestion is ${tw} ${twSide[4]||''} ${tf} (ERSA: departures/arrivals to the ${twSide[4]?twSide[4].toLowerCase():'…'}${twSide[4]==='West'?', and arrivals from the south via CARR':''}). The ATIS says which frequency is in use.` : (twrs.length>1?' ERSA lists more than one tower frequency; the ATIS says which to use.':'');
    const atisL = a.a?`<i>[ATIS letter]</i>`:'';
    const rptPts=(K.rpts||'').split(/,\s*|\s+or\s+/).map(x=>x.trim()).filter(Boolean).map(c=>VWby.get(c)||{c,n:c,missing:1});
    const nearR=rptPts.filter(p=>!p.missing).map(p=>({p,d:distBrg(st.pos[0],st.pos[1],p.la,p.lo)[0]})).sort((x,y)=>x.d-y.d)[0];
    const rp = nearR && nearR.d<3 ? `over ${T(titleCase(nearR.p.n))}` : K.rpts? `over <i>[${T(rptPts.map(p=>titleCase(p.n)).join(' / '))}]</i>` : dist;
    const ft=x=>x.replace(/\s*FT.*$/i,'')+' feet';
    const inAlt = heli&&K.hel ? ft(K.hel) : K.entry ? ft(K.entry) : lvl;
    $('callsAt').textContent=tw+' · '+tf;
    modeTxt=`<b>Tower procedures (Class D)</b> · ${twAll}${gn?` · ${gn} ${gnd[2]}`:''}${a.a?` · ATIS ${a.a[0]}`:''}<br>`+
      (ts? `ERSA tower hours today ${ts.today||'none'} local${ts.hds?' (daylight saving)':''}: <b>${ts.on?'tower likely active':'tower likely closed'}</b>. Public holidays and NOTAMs not included; confirm on the ATIS.` : 'Tower hours not parsed: confirm on the ATIS.');
    if(a.a) calls.push(['Before first contact',`Listen to ATIS ${a.a[0]} and note the information letter${heli?'. Nominate your landing site or aiming point on first contact if ERSA requires it':''}.`]);
    if(gn) calls.push(['Taxi · '+gn+' '+gnd[2],`${T(gn)}, ${cs}, ${type}, <i>[position on aerodrome]</i>, received ${atisL||'<i>[ATIS]</i>'}, request taxi ${heli?'<i>[for aiming point / HLS]</i> ':''}for <i>[circuits / VFR departure to the …]</i>.`]);
    const twOf=side=>{ const t=twrs.find(t=>t[4]===side)||twSide; return [titleCase(t[1]), t[2], t[4]||'']; };
    calls.push(['Ready · '+(twrs.some(t=>t[4])? twrs.map(t=>(t[4]||'')+' '+t[2]).join(' / ')+' by departure direction' : tw+' '+tf),`${T(tw)}, ${cs}, ready ${heli?'<i>[aiming point / HLS]</i>':rwy}, <i>[circuits / departing to the … at … feet]</i>.`]);
    calls.push(['Inbound · '+tw+(twSide[4]?' '+twSide[4]:'')+' '+tf+' · before entering the CTR',`${T(tw)}, ${cs}, ${type}, ${rp}, ${inAlt}, received ${atisL||'<i>[ATIS]</i>'}, inbound${heli?' for <i>[HLS / aiming point]</i>':' for landing'}.`]);
    if(/report turning downwind/i.test(JSON.stringify(a.proc||{}))) calls.push(['Turning downwind (ERSA requires)',`${cs}, downwind <i>[full stop / touch and go]</i>.`]);
    else calls.push(['Circuit',`${cs}, downwind <i>[full stop / touch and go]</i>.`]);
    calls.push(['Leaving the CTR',`Follow ATC instructions. ${a.fia?`For class G, ERSA lists ${T(titleCase(a.fia[0][0]))} ${a.fia[0][1]}.`:''}`]);
    note='Controlled aerodrome calls (AIP ENR 1.1). Read back clearances, runway and QNH. Words in brackets are yours to fill.'+sideNote;
  } else {
    const id=`${T(loc)} traffic, ${type} ${cs}`, end=`, ${T(loc)}`;
    $('callsAt').textContent=loc+' traffic · '+(CI.f||'—');
    modeTxt=`<b>CTAF procedures</b> · ${CI.f||'—'} ${chip(CI.src)}${towered?(ts?` · ERSA tower hours today ${ts.today||'none'} local: <b>${ts.on?'tower likely active':'tower likely closed'}</b>`:''):''}`;
    calls=[
      ['Inbound · by 10 NM',`${id}, ${dist}, ${lvl}, inbound, estimate circuit <i>[time]</i>, <i>[joining intentions]</i>${end}.`],
      ['Overflying',`${id}, ${ovr}, ${lvl}, overflying, <i>[tracking to …]</i>${end}.`],
      ['Joining circuit',`${id}, joining <i>[crosswind / downwind / base]</i> ${heli?'<i>[or helicopter arrival per ERSA]</i>':rwy}${end}.`],
      ['Straight-in · 3 NM final',`${id}, 3 mile final, straight in ${rwy}${end}.`],
      ['Taxiing',`${id}, taxiing for ${heli?'<i>[departure point]</i>':rwy} for <i>[departure / circuits]</i>${end}.`],
      ['Entering runway',`${id}, ${heli?'lifting from <i>[location]</i>':'lining up '+rwy} for <i>[departure direction / circuits]</i>${end}.`],
      ['Departing',`${id}, departed ${heli?'<i>[location]</i>':rwy}, climbing to <i>[level]</i>, tracking <i>[direction]</i>${end}.`],
    ];
    note=(atField?'You are at the aerodrome, so the inbound position is a placeholder: make the call by 10 NM with your actual distance and direction. ':'')+'Non-controlled aerodrome calls (AIP ENR 1.1). Inbound call by 10 NM; position and level are filled in from GPS. Start and end each call with the location name. Words in brackets are yours to fill.';
  }
  let rptHtml='';
  if(mode==='twr' && K.rpts){
    const pts=(K.rpts||'').split(/,\s*|\s+or\s+/).map(x=>x.trim()).filter(Boolean).map(c=>VWby.get(c)).filter(Boolean)
      .map(p=>{ const [d,b]=distBrg(st.pos[0],st.pos[1],p.la,p.lo); return {p,d,b}; }).sort((x,y)=>x.d-y.d);
    rptHtml=`<div class="rpts">${pts.map((x,i)=>`<button class="rpt${i===0?' near':''}" data-c="${x.p.c}">${x.p.c} ${fmt3(x.b-varE)}° ${x.d<10?x.d.toFixed(1):Math.round(x.d)}NM<small>${esc(titleCase(x.p.n))}</small></button>`).join('')}</div>`;
  }
  const keys=[mode==='twr'&&K.entry&&`CTR entry ${K.entry}`, K.cct&&`Circuit ${K.cct}`, heli&&K.hel&&`Helicopters ${K.hel}`, mode==='twr'&&K.rpts&&`Report at ${K.rpts}`].filter(Boolean);
  $('callsMode').innerHTML=modeTxt+rptHtml+(keys.length?`<div class="keys" style="padding:8px 0 0">${keys.map(k=>`<span>${T(k)}</span>`).join('')} ${chip('ERSA')}</div>`:'');
  $('callsList').innerHTML=calls.map(c=>`<div class="call"><div class="when">${c[0]}</div><div class="say">${c[1]}</div></div>`).join('');
  $('callsNote').textContent=note+(rhTxt?` Runway ${rv}: right-hand circuit per ERSA (${a.cct[rv][1]}).`:'')+(a.proc?' Aerodrome-specific requirements are in ERSA local procedures below.':'');
  const pb=$('ersaProc'); pb.hidden=!(a.proc||a.cnotes);
  if(!pb.hidden && pb.dataset.k!==a.i+heli){ $('ersaProcBody').innerHTML=ersaProcHtml(a,heli); pb.dataset.k=a.i+heli; }
}
$('cType').value=ls.get('cType',''); $('cSign').value=ls.get('cSign','');
/* callsign: type the registration (EAN, VH-EAN) or flight number and it is spelled with the ICAO phonetic alphabet.
   VH- is dropped, as in Australian practice for VH-registered aircraft. Anything with spaces, or a single word longer than
   4 letters with no digits (e.g. RESCUE), is left as typed. */
const PHON={A:'ALPHA',B:'BRAVO',C:'CHARLIE',D:'DELTA',E:'ECHO',F:'FOXTROT',G:'GOLF',H:'HOTEL',I:'INDIA',J:'JULIETT',K:'KILO',L:'LIMA',M:'MIKE',
  N:'NOVEMBER',O:'OSCAR',P:'PAPA',Q:'QUEBEC',R:'ROMEO',S:'SIERRA',T:'TANGO',U:'UNIFORM',V:'VICTOR',W:'WHISKEY',X:'X-RAY',Y:'YANKEE',Z:'ZULU',
  0:'ZERO',1:'ONE',2:'TWO',3:'THREE',4:'FOUR',5:'FIVE',6:'SIX',7:'SEVEN',8:'EIGHT',9:'NINER'};
function sayCallsign(raw){
  const t=(raw||'').trim().toUpperCase().replace(/\s+/g,' '); if(!t) return '';
  let c=t.replace(/[-.]/g,'');
  if(/^VH ?[A-Z]{3}$/.test(c)) c=c.replace(/^VH ?/,'');               // VH-EAN -> EAN
  else if(/\s/.test(t)) return t;                                      // already words: ECHO ALPHA NOVEMBER, POLAIR 31
  if(!/^[A-Z0-9]{1,8}$/.test(c) || (/^[A-Z]{5,}$/.test(c))) return t;   // RESCUE, LIFESAVER: say as typed
  return [...c].map(ch=>PHON[ch]).join(' ');
}
function csPreview(){ const v=$('cSign').value.trim(), s=sayCallsign(v); $('cSay').textContent = v && s!==v.toUpperCase().replace(/\s+/g,' ') ? 'Say: '+s : ''; }
$('cSign').addEventListener('change',()=>{ const s=sayCallsign($('cSign').value); if(s){ $('cSign').value=s; ls.set('cSign',s); } csPreview(); render(); });   // expand in the box on Enter / leaving it
$('cSign').addEventListener('input',csPreview); csPreview();
$('calls').open=ls.get('callsOpen',false);
$('calls').addEventListener('toggle',()=>ls.set('callsOpen',$('calls').open));
for(const id of ['cType','cSign']) $(id).addEventListener('input',()=>{ ls.set(id,$(id).value); render(); });
$('cRwy').addEventListener('change',()=>render());
$('callsMode').addEventListener('click',e=>{ const b=e.target.closest('.rpt'); if(!b) return; const p=VWby.get(b.dataset.c); if(p) setGo(p); });
$('cCat').value=ls.get('cCat','A'); $('cMode').value=ls.get('cMode','auto');
for(const id of ['cCat','cMode']) $(id).addEventListener('change',()=>{ ls.set(id,$(id).value); render(); });

/* ---------- simulation ---------- */
function parsePos(t){
  t=t.trim().toUpperCase();
  if(/^[A-Z][A-Z0-9 ]{1,30}$/.test(t) && !/^\d/.test(t)){ const p=findPoint(t); if(p) return [p.la,p.lo]; throw new Error(t+' is not an aerodrome, VFR waypoint, navaid or IFR waypoint.'); }
  // DMS / DM / decimal with hemisphere letters, e.g. 38 02 22S 144 28 10E, 3802.4S 14428.2E, 38°02'22"S
  const hemi=t.match(/([0-9.\s°'"’″:]+)\s*([NS])[\s,;\/]*([0-9.\s°'"’″:]+)\s*([EW])/);
  const conv=(str)=>{ const p=str.replace(/[°'"’″:]/g,' ').trim().split(/\s+/).map(Number);
    if(p.length===1){ const v=p[0]; if(v>=1000){ // DDMM.m or DDDMM.m packed
        const d=Math.floor(v/100); return d+(v-d*100)/60; } return v; }
    return p[0]+(p[1]||0)/60+(p[2]||0)/3600; };
  if(hemi){ let la=conv(hemi[1]), lo=conv(hemi[3]); if(hemi[2]==='S') la=-la; if(hemi[4]==='W') lo=-lo; return [la,lo]; }
  const n=t.match(/-?\d+(\.\d+)?/g);
  if(n&&n.length===2){ let la=+n[0], lo=+n[1]; if(la>0 && lo>100) la=-la; // forgot the minus: assume southern hemisphere
    return [la,lo]; }
  throw new Error('Could not read that position. Try "-38.04, 144.47", "38 02 22S 144 28 10E" or an ICAO code.');
}
function simApply(){
  $('simErr').hidden=true;
  let la,lo;
  try{ [la,lo]=parsePos($('simPos').value); }catch(e){ $('simErr').textContent=e.message; $('simErr').hidden=false; return false; }
  if(!(la>=-60&&la<=0&&lo>=90&&lo<=180)){ $('simErr').textContent='That position is outside the Australian region this app covers.'; $('simErr').hidden=false; return false; }
  const alt=parseFloat($('simAlt').value), trkM=parseFloat($('simTrk').value), gs=parseFloat($('simGs').value);
  st.pos=[la,lo]; st.acc=0; st.alt=isNaN(alt)?null:alt; st.gs=isNaN(gs)?0:gs;
  st.trk=isNaN(trkM)?null:norm(trkM+variation(la,lo));
  if(st.trk!=null && !(st.gs>5)) st.gs=Math.max(st.gs,0); // track shown via heading fallback below
  st.simHdg = st.trk; // used when GS is low
  ls.set('sim',{p:$('simPos').value,a:$('simAlt').value,t:$('simTrk').value,g:$('simGs').value});
  simStatus(); render(); simSummary(); return true;
}
function simStatus(){
  $('gpsDot').className='dot warn'; $('sAcc').textContent='SIM';
  $('sGs').textContent=st.gs!=null?Math.round(st.gs):'—';
  $('sAlt').textContent=st.alt!=null?Math.round(st.alt):'—';
}
let flyTimer=null, flyLast=0;
function flyStep(){
  const now=performance.now(), dt=(now-flyLast)/3600000; flyLast=now; // hours
  if(FP && FP.pts[FP.i] && !st.simManual){ const p=FP.pts[FP.i], [dd,bb]=distBrg(st.pos[0],st.pos[1],p.la,p.lo); if(dd>0.05){ st.trk=bb; $('simTrk').value=fmt3(bb-variation(st.pos[0],st.pos[1])); } }
  if(st.trk==null||!st.gs) return;
  const d=st.gs*dt/60*R, b=st.trk*R, p1=st.pos[0]*R, l1=st.pos[1]*R; // d in radians of arc (NM/60 deg)
  const p2=Math.asin(Math.sin(p1)*Math.cos(d)+Math.cos(p1)*Math.sin(d)*Math.cos(b));
  const l2=l1+Math.atan2(Math.sin(b)*Math.sin(d)*Math.cos(p1),Math.cos(d)-Math.sin(p1)*Math.sin(p2));
  st.pos=[p2/R,l2/R];
  $('simPos').value=st.pos[0].toFixed(5)+', '+st.pos[1].toFixed(5);
  render(); simSummary();
}
function setFly(on){
  clearInterval(flyTimer); flyTimer=null; $('simFly').setAttribute('aria-pressed',on);
  if(on){ if(!simApply()){ $('simFly').setAttribute('aria-pressed',false); return; }
    if((st.trk==null&&!FP)||!st.gs){ $('simErr').textContent='Set a track (or load a flight plan) and a ground speed to fly.'; $('simErr').hidden=false; $('simFly').setAttribute('aria-pressed',false); return; }
    st.simManual=false; flyLast=performance.now(); flyTimer=setInterval(flyStep,1000); }
  simSummary();
}
function setSim(on){
  st.sim=on; $('simBox').hidden=!on; $('bSim').setAttribute('aria-pressed',on); ls.set('simOn',on);
  if(on){ $('startBox').hidden=true; const s=ls.get('sim',null);
    if(s){ $('simPos').value=s.p; $('simAlt').value=s.a; $('simTrk').value=s.t; $('simGs').value=s.g; }
    if(!$('simPos').value) $('simPos').value='YMAV';
    simApply(); simFold(ls.get('simOpen',true)); }
  else { setFly(false); st.pos=null; st.trk=null; st.gs=null; st.alt=null;
    $('sAcc').textContent='—'; $('gpsDot').className='dot'; $('sGs').textContent='—'; $('sAlt').textContent='—';
    $('adId').textContent='----'; $('adName').textContent='Waiting for position'; $('stack').innerHTML=''; $('list').innerHTML='';
    if(!watching) $('startBox').hidden=false; }
}
function simFold(open){ $('simBody').hidden=!open; $('simToggle').setAttribute('aria-expanded',open); $('simBox').classList.toggle('collapsed',!open); ls.set('simOpen',open); simSummary(); }
function simSummary(){
  if(!st.pos){ $('simSum').textContent=''; return; }
  const fly=$('simFly').getAttribute('aria-pressed')==='true';
  const p=$('simPos').value.trim(), short=/^[A-Z]{4}$/i.test(p)?p.toUpperCase():st.pos[0].toFixed(3)+', '+st.pos[1].toFixed(3);
  const t=$('simTrk').value.trim();
  $('simSum').hidden=!$('simBody').hidden;
  $('simSum').textContent = $('simBody').hidden ? `${short} ${st.alt!=null?Math.round(st.alt)+'ft':'—'}${t?' '+String(Math.round(+t)%360).padStart(3,'0')+'°':''}${st.gs?' '+Math.round(st.gs)+'kt':''}${fly?' ▶':''}` : '';
}
$('simToggle').onclick=()=>simFold($('simBody').hidden);
$('bSim').onclick=()=>setSim(!st.sim);
$('simOff').onclick=()=>setSim(false);
$('simGo').onclick=()=>{ setFly(false); simApply(); };
$('simFly').onclick=()=>setFly($('simFly').getAttribute('aria-pressed')!=='true');
for(const id of ['simPos','simAlt','simTrk','simGs']) $(id).addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); simApply(); } });
// track, speed and altitude take effect as you type (a phone's number pad has no Enter key); a track typed while
// flying a plan takes over from the plan until Fly is pressed again
let simEditT=null;
for(const id of ['simAlt','simTrk','simGs']) $(id).addEventListener('input',()=>{ clearTimeout(simEditT);
  simEditT=setTimeout(()=>{ const v=$(id).value.trim(); if(v!=='' && isNaN(parseFloat(v))) return;
    if(id==='simTrk' && FP && flyTimer) st.simManual=true;
    simApply(); },350); });

function setFoot(){ $('foot').innerHTML=`<b>Not an authoritative source.</b> Always confirm against the current ERSA, charts and NOTAMs. Source order: <b>AIP first</b>. ERSA ${META.ersa||'—'} for aerodromes, CTAF, ATIS, AWIS, tower, approach and the area frequency listed for each aerodrome. DAH ${META.dah||'—'} for airspace classes, steps, area (FIA), class E and broadcast-area frequency boundaries (curved boundaries and features approximated). Aerodromes not in ERSA use the AIP default CTAF 126.7 unless inside a broadcast area. Anything not in the AIP is tagged with its source: VATPAC (controlling unit where ERSA has none), XC Australia, OurAirports. Terrain: ${TER.ok?'SRTM 30\u2033 grid (highest point per cell), loaded':'SRTM terrain not installed (see README)'}. Bearings magnetic (WMM ${DATA.var.epoch}). Data built ${DATA.built}.${META.next?` Next AIRAC (ERSA ${META.next[2]}) is stored and takes over at ${new Date(META.next[0]).toISOString().slice(0,16).replace('T',' ')} UTC.`:''}${URB.length?' Populous areas: ABS Urban Centres and Localities 2021 (CC BY 4.0).':''}<span id="offl"></span>`; offlineStatus(); }
setFoot();
(function(){ // effective-date check: the loader picked the dataset in force (META.eff = 1600 UTC the day before the AIRAC date)
  const eff=META.ersa||META.dah; if(!eff) return;
  const d=META.eff? new Date(META.eff) : new Date(eff+' 00:00 UTC'); if(isNaN(d)) return;
  const now=new Date();
  const b=$('effBanner'), key='effOpen_'+eff;
  const show=(head,body)=>{ b.hidden=false; $('effHead').innerHTML=head; $('effBody').textContent=body;
    b.open=ls.get(key,true); b.addEventListener('toggle',()=>ls.set(key,b.open)); };
  if(now<d) show(`<b>AIP data effective ${eff}</b>`,'Until then the current ERSA and DAH apply, and some frequencies or steps here may not be in force yet.');
  else if(!META.next && (now-d)/864e5>56) show(`<b>AIP data from ${eff} may be out of date</b>`,'Rebuild with the current ERSA and DAH.');
  // the next AIRAC is already stored: when it takes effect while the app is open, offer a reload
  if(META.next){ const t=setInterval(()=>{ if(Date.now()>=META.next[0]){ clearInterval(t);
    show('<b>New AIP data is now in force</b> <button class="btn" onclick="location.reload()" style="margin-left:8px;padding:4px 8px;font-size:11px">Reload</button>',`ERSA ${META.next[2]} took effect at 1600 UTC yesterday. Reload to switch; it is already stored on this device.`); } },60000); }
})();
syncBtns();
if(ls.get('started',false) && navigator.permissions){
  navigator.permissions.query({name:'geolocation'}).then(r=>{ if(r.state==='granted') start(); }).catch(()=>{});
}
(function(){ // ?sim=-38.04,144.47&alt=1500&trk=270&gs=90   or ?sim=YMAV
  const q=new URLSearchParams(location.search);
  if(q.has('sim')){ ls.set('sim',{p:q.get('sim'),a:q.get('alt')||'1500',t:q.get('trk')||'',g:q.get('gs')||'0'}); setSim(true); }
  else if(ls.get('simOn',false)) setSim(true);
})();
terInit();
// the loader in index.html registers the service worker; once it's active, top up the terrain cache and report
if('serviceWorker' in navigator && (location.protocol==='https:'||location.hostname==='localhost')){
  navigator.serviceWorker.ready.then(r=>{ if(r.active) r.active.postMessage('precache'); setTimeout(offlineStatus,4000); }).catch(()=>{}); }
// footer: is everything needed offline stored on this device?
async function offlineStatus(){
  const el=$('offl'); if(!el) return;
  if(!('serviceWorker' in navigator)||!navigator.serviceWorker.controller||!window.caches){ el.innerHTML=' <b>Offline:</b> not set up yet (open once online over https).'; return; }
  try{ const ks=(await caches.keys()).filter(k=>/^radio-au-[0-9a-f]{10}$/.test(k)); let app=false;
    for(const k of ks){ const c=await caches.open(k); if(await c.match('data.json',{ignoreSearch:true}) && await c.match('app.js',{ignoreSearch:true}) && await c.match('urban.json',{ignoreSearch:true}) && (!META.next || await c.match('data-next.json',{ignoreSearch:true}))) app=true; }
    const tc=await caches.open('radio-au-terrain'), n=(await tc.keys()).filter(k=>/\.bin\.z$/.test(k.url)).length, want=TER.have.size;
    el.innerHTML=` <b>Offline:</b> ${app?'app and AIP data stored':'app not stored yet'}${TER.ok?`, terrain ${n}/${want} tiles`:''}${CH.need?`, charts ${CH.have}/${CH.need} tiles`:''}${app&&(!TER.ok||n>=want)&&CH.have>=CH.need?' — ready to fly without signal.':'.'}`;
  }catch(e){ el.textContent=''; } }
