// Plan check with a coast leg: one row per leg, not per turn point (24 Nov 2026, Michael: "Consolidate the cst WPs from the
// plan check, treat it as one item not per cst point"). YBRS -> YMMB along the coast, then YMMB -> YTYA direct.
// node play/pccoast.js  (app on :8811)
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(), errs=[], fail=[]; const ok=(c,m)=>{ console.log((c?'ok   ':'FAIL ')+m); if(!c) fail.push(m); };
  const ctx=await b.newContext({...PX9,storageState:{cookies:[],origins:[{origin:'http://localhost:8811',localStorage:[{name:'rc_fsMap',value:'false'},{name:'rc_pcBurn',value:'100'},{name:'rc_pcFuel',value:'300'},{name:'rc_pcGs',value:'100'},{name:'rc_pcWsrc',value:'"set"'},{name:'rc_pcWind',value:'{"dir":270,"kt":15}'}]}]}});
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8811/index.html?sim=YBRS&alt=1500&trk=090&gs=0'); await p.waitForFunction(()=>typeof render==='function'&&st.pos);
  const r=await p.evaluate(async()=>{ ls.set('coastOff',500); ls.set('coastGap',2); COAST.off=500; COAST.gap=2;
    fpSet({name:'t',kind:'map',pts:[fpPt(findPoint('YBRS')),fpPt(findPoint('YMMB')),fpPt(findPoint('YTYA'))],i:1}); await fpCoastSet(FP.pts[1],true);
    $('fpCheck').onclick(); await new Promise(r=>setTimeout(r,500)); pcRun();
    const out=$('pcOut'), secs={}; let cur='';
    for(const el of out.children){ if(el.classList.contains('pc-sec')) cur=el.textContent.split(' (')[0]; else if(el.tagName==='TABLE') secs[cur]=[...el.querySelectorAll('tr')].map(tr=>tr.textContent.replace(/\s+/g,' ').trim()); }
    const P=planLegs(+ls.get('pcGs'),Date.now()), y=FP.pts.findIndex(q=>q.c==='YMMB'); let L=0, ms=0; for(const l of P.legs) if(l.k<=y){ L+=l.L; ms+=l.ms; }
    return {tp:FP.pts.filter(q=>q.cg).length, secs, text:PC.text, html:out.innerText, L, ms}; });
  const S=r.secs, legs=k=>(S[k]||[]).filter(t=>!/^Total/.test(t));
  console.log('     sections: '+Object.keys(S).join(' | '));
  ok(r.tp>50,`coast leg with ${r.tp} turn points`);
  ok(!/\bCST\d+/.test(r.html)&&!/\bCST\d+/.test(r.text),'no CSTn anywhere in Plan check or its copy text');
  for(const k of ['Wind by leg','Time and fuel by leg','LSALT by leg']){ const L=legs(k); ok(L.length===2&&/^YBRS → YMMB \(coast\)/.test(L[0])&&/^YMMB → YTYA/.test(L[1]),`${k}: 2 rows (${L.map(t=>t.slice(0,60)).join(' | ')})`); }
  const fuel=legs('Time and fuel by leg')[0], m=/([\d.]+) NM/.exec(fuel), hm=/(\d+):(\d\d)/.exec(fuel);
  ok(m&&Math.abs(+m[1]-r.L)<0.6&&hm&&Math.abs((+hm[1]*60+ +hm[2])-r.ms/60e3)<1,`coast row = the sum of its pieces: ${m&&m[1]} NM (${r.L.toFixed(1)}), ${hm&&hm[0]} (${(r.ms/60e3).toFixed(1)} min)`);
  ok(/HDG varies/.test(legs('Wind by leg')[0])&&/along the coast/.test(legs('Wind by leg')[0]),'wind row: track along the coast, heading varies, average GS');
  const along=S['Along the route']||[]; ok(along.filter(t=>/ WP /.test(' '+t+' ')||/^\S+ \S+ WP/.test(t)).length<=3,`Along the route: ${along.length} rows, waypoints only YBRS, YMMB, YTYA`);
  console.log(fail.length? fail.length+' FAILED':'all passed'); console.log(errs); await b.close(); process.exit(fail.length?1:0); })();
