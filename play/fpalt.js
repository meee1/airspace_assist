// Edit plan: your own altitude per leg (overrides the suggestion; warnings; profile; plan check)
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({...PX9,storageState:{cookies:[],origins:[{origin:'http://localhost:8811',localStorage:[{name:'rc_fsMap',value:'false'}]}]}}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YBRS&alt=50&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(800);
 await p.evaluate(()=>{ const ad=i=>{ const a=DATA.ap.find(x=>x.i===i); return {n:a.i,c:a.i,la:a.la,lo:a.lo}; }; fpSet({name:'T',pts:[ad('YBRS'),{n:'BELLARINE',la:-38.20,lo:144.62},ad('YLIL')],i:0}); FP_EDIT=true; render(); });
 await p.waitForTimeout(2500);   // terrain
 const st_=()=>p.evaluate(()=>[...$('fpLegs').children].map(li=>{ const i=li.querySelector('.altin'); return li.querySelector('.w b').textContent+' ['+(i?i.value+'|ph '+i.placeholder:'-')+'] '+li.querySelector('.alt').textContent; }).join('  ·  '));
 console.log('before  ', await st_());
 const set=async(k,v)=>{ await p.evaluate(([k,v])=>{ const i=$('fpLegs').querySelector(`.altin[data-k="${k}"]`); i.value=v; i.dispatchEvent(new Event('change',{bubbles:true})); },[k,v]); await p.waitForTimeout(700); return p.evaluate(k=>({alt:FP.pts[k].alt, note:legAltNote(PROF.legs[k]).replace(/<[^>]+>/g,'').slice(0,230)}),k); };
 for(const v of ['3000','A045','25','abc','']) console.log(`leg1 "${v}" ->`, JSON.stringify(await set(1,v)));
 console.log('leg2 "2500" ->', JSON.stringify(await set(2,'2500')));
 console.log('after   ', await st_());
 console.log('stored', await p.evaluate(()=>JSON.stringify(JSON.parse(localStorage.getItem('rc_fp')||'{}').pts.map(q=>q.alt))));
 // plan check uses each leg's altitude
 console.log('pc', await p.evaluate(()=>{ const r=planCheck(1500,90,Date.now()); return r.legs.map(l=>(l.to.c||l.to.n)+' '+l.alt+(l.set?' set':'')).join(' | '); }));
 await p.evaluate(()=>{ FP_EDIT=true; render(); $('fpBox').scrollIntoView(); }); await (await p.$('#fpBox')).screenshot({path:'play/fpalt_edit.png'});
 await p.evaluate(()=>{ FP_EDIT=false; render(); }); await (await p.$('#fpBox')).screenshot({path:'play/fpalt_view.png'});
 console.log(errs); await b.close(); })();
// GPX round trip keeps the leg altitude
(async()=>{ await new Promise(r=>setTimeout(r,9000)); const b=await chromium.launch(); const p=await (await b.newContext(PX9)).newPage(); await p.goto('http://localhost:8811/index.html?sim=YBRS&alt=50&trk=000&gs=0'); await p.waitForFunction(()=>typeof parseGPX==='function');
 console.log('gpx', await p.evaluate(()=>{ const r=parseGPX('<gpx><rte><name>T</name><rtept lat="-38.27" lon="144.42"><name>YBRS</name><cmt>ALT 9999</cmt></rtept><rtept lat="-38.2" lon="144.62"><name>BELLARINE</name><cmt>ALT 2500</cmt></rtept><rtept lat="-37.69" lon="145.37"><name>YLIL</name></rtept></rte></gpx>'); return JSON.stringify(r.pts.map(q=>q.alt)); })); await b.close(); })();
