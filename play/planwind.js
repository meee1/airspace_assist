// Wind on the plan (Plan check): wind triangle against hand-worked cases; an entered wind gives each leg a heading, ground
// speed and time and changes the totals, fuel and the route times; "nearest TAF" takes each leg's surface wind from the
// loaded NAIPS briefing (fixture) at the time you'd be there; no wind = as before; the Range ring leans downwind.
const {chromium}=require('playwright'); const {PX9}=require('./px9.js'); const fs=require('fs');
(async()=>{ const b=await chromium.launch(); require('./classic.js')(b); const ctx=await b.newContext(PX9);
 // the briefing fixture was issued 2259 UTC 7 Nov 2026: run the clock from just after it
 await ctx.addInitScript(()=>{ const D=Date, off=D.parse('2026-11-07T23:30:00Z')-D.now(); window.Date=class extends D{ constructor(...a){ super(...(a.length?a:[D.now()+off])); } static now(){ return D.now()+off; } }; });
 const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YBRS&alt=1500&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(500);
 // wind triangle: [track, TAS, wind from, kt] -> expected GS, heading (worked by hand / E6B)
 const tri=await p.evaluate(()=>[[0,100,0,20],[0,100,180,20],[0,100,90,20],[90,100,45,30],[270,90,300,25],[0,60,90,70]].map(a=>{ const r=windTri(...a); return [a.join('/'), r.gs==null?null:+r.gs.toFixed(1), +r.hdg.toFixed(1)]; }));
 const want=[[80,0],[120,0],[97.98,11.54],[76.5,77.75],[67.5,277.99],[null,0]];
 tri.forEach((t,i)=>{ const ok=(t[1]==null? want[i][0]==null : Math.abs(t[1]-want[i][0])<0.2)&&(want[i][0]==null||Math.abs(t[2]-want[i][1])<0.2); console.log('tri', t.join('  '), ok?'ok':'WRONG, want '+want[i]); if(!ok) errs.push('wind triangle '+t[0]); });
 await p.evaluate(()=>{ fpSet({name:'Wind test',kind:'map',pts:[fpPt(findPoint('YBRS')),fpPt(findPoint('YMMB')),fpPt(findPoint('YLIL'))],i:1}); });
 await p.click('#fpCheck'); await p.waitForTimeout(400);
 await p.fill('#pcGs','90'); await p.fill('#pcBurn','100'); await p.fill('#pcFuel','250'); await p.fill('#pcDep','10:45'); await p.selectOption('#pcWsrc','none'); await p.waitForTimeout(300);
 const head=()=>p.evaluate(()=>$('pcOut').querySelector('.pc-sec').textContent);
 const fuelTot=()=>p.evaluate(()=>{ const t=[...$('pcOut').querySelectorAll('.pc-sec')].find(x=>/Time and fuel/.test(x.textContent)); return t? [...t.nextElementSibling.querySelectorAll('tr')].pop().innerText.replace(/\s+/g,' ') : ''; });
 console.log('no wind:', await head(), '|', await fuelTot(), '| label', await p.textContent('#pcGsLbl'), '| wind table', await p.evaluate(()=>/Wind by leg/.test($('pcOut').textContent)));
 const T0=await p.evaluate(()=>planLegs(90).T);
 // entered: 060°T at 25 kt (a headwind on the way to Moorabbin)
 await p.selectOption('#pcWsrc','set'); await p.fill('#pcWdir','060'); await p.fill('#pcWkt','25'); await p.click('#pcRun'); await p.waitForTimeout(300);
 const rows=()=>p.evaluate(()=>{ const t=[...$('pcOut').querySelectorAll('.pc-sec')].find(x=>/Wind by leg/.test(x.textContent)); return t? [t.textContent, ...[...t.parentNode.querySelectorAll('.pc-sec')].includes(t)? [...(t.nextElementSibling.tagName==='TABLE'?t.nextElementSibling:t.nextElementSibling.nextElementSibling).querySelectorAll('tr')].map(r=>r.innerText.replace(/\s+/g,' ')) : []] : []; });
 console.log('entered:', await head(), '| label', await p.textContent('#pcGsLbl')); for(const r of await rows()) console.log('   ', r); console.log('   ', await fuelTot());
 const chk=await p.evaluate(()=>{ const PL=planLegs(90), l=PL.legs[0], [L,trk]=distBrg(FP.pts[0].la,FP.pts[0].lo,FP.pts[1].la,FP.pts[1].lo), t=windTri(trk,90,60,25);
   return {T:PL.T, legOk:Math.abs(l.gs-t.gs)<1e-6&&Math.abs(l.ms-L/t.gs*3600e3)<1, tAtEnd:Math.abs(PL.tAt(PL.D)-PL.T)<1, tAtMid:Math.abs(PL.tAt(L/2)-l.ms/2)<1, saved:JSON.stringify([ls.get('pcWsrc'),ls.get('pcWind')])}; });
 console.log('checks:', JSON.stringify({...chk,T:Math.round(chk.T/60e3)+' min vs '+Math.round(T0/60e3)+' min still air'})); if(!chk.legOk||!chk.tAtEnd||!chk.tAtMid||!(chk.T>T0)) errs.push('leg times wrong');
 await p.screenshot({path:'play/planwind_set.png'});
 // W&B's plan fuel uses the same time
 console.log('W&B plan fuel hours:', await p.evaluate(()=>{ const f=wbPlanFuel({u:'kg'}); return f? (f.h*60).toFixed(0)+' min' : 'n/a'; }));
 // nearest TAF: no briefing -> says so; with the briefing -> each leg has a station
 await p.selectOption('#pcWsrc','taf'); await p.waitForTimeout(300); console.log('taf, no briefing:', await p.evaluate(()=>{ const n=[...$('pcOut').querySelectorAll('.vnote')].find(x=>/TAF winds/.test(x.textContent)); return n? n.textContent.slice(-60) : ''; }));
 const j=JSON.parse(fs.readFileSync(__dirname+'/fixtures/naips_area_full.json','utf8'));
 await p.evaluate(t=>{ nbLoad(t); },j.text); await p.click('#pcRun'); await p.waitForTimeout(400);
 console.log('taf:', await head()); for(const r of await rows()) console.log('   ', r);
 console.log('taf at the leg times:', await p.evaluate(()=>JSON.stringify(planLegs(90,pcDepMs($('pcDep').value)).legs.map(l=>l.w&&[l.w.src,l.w.dir,l.w.kt,Math.round(l.w.d)]))));
 await p.screenshot({path:'play/planwind_taf.png'});
 await p.click('#pcClose');
 // Range ring with the entered wind: further downwind (240°T) than upwind (060°T)
 await p.evaluate(()=>{ ls.set('pcWsrc','set'); fuSet(200,100); ls.set('rangeRing',true); MAP.range=160; MAP.up='north'; CH.on=false; MAP.ctaf=false; render(); });
 console.log('range:', await p.evaluate(()=>{ const S=fuState(), h=S.endMin/60, W=S.wind; return JSON.stringify({wind:W, down:Math.round(windTri(240,W.tas,W.dir,W.kt).gs*h), up:Math.round(windTri(60,W.tas,W.dir,W.kt).gs*h), still:Math.round(S.rangeNM)}); }));
 await (await p.$('#map')).scrollIntoViewIfNeeded(); await (await p.$('.mapwrap')).screenshot({path:'play/planwind_range.png'});
 console.log(errs); await b.close(); })();
