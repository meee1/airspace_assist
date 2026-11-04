// final reserve by category and day/night (CASA Part 91 MOS 19.02): helicopter 20/30 min, aeroplane 30/45 min
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({...PX9}); await ctx.addInitScript(()=>{ const D=Date, off=D.parse('2026-11-04T00:30:00Z')-D.now(); window.Date=class extends D{ constructor(...a){ super(...(a.length?a:[D.now()+off])); } static now(){ return D.now()+off; } }; });
 const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=090&gs=0'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(600);
 await p.evaluate(()=>{ const ap=i=>{ const x=DATA.ap.find(y=>y.i===i); return {n:i,c:i,la:x.la,lo:x.lo}; }; fpSet({name:'T',pts:[ap('YMMB'),ap('YLIL')],i:1}); render(); });
 for(const [cat,dep] of [['H','11:30'],['H','21:30'],['A','11:30'],['A','21:30']]){
   const r=await p.evaluate(([cat,dep])=>{ $('pcRes').value=''; $('cCat').value=cat; $('pcAlt').value=1500; $('pcGs').value=90; $('pcBurn').value=100; $('pcFuel').value=80; $('pcDep').value=dep; pcRun();
     const sec=[...document.querySelectorAll('#pcOut .pc-sec')].map(e=>e.textContent).find(t=>/Time and fuel/.test(t))||'-';
     const pf=wbPlanFuel(WB&&WB.p&&WB.p[WB.cur]||{u:'kg'}); return sec+'  |  W&B plan fuel: '+(pf?pf.res+' min, need '+Math.ceil(pf.need):'-'); },[cat,dep]);
   console.log(cat, dep, '→', r); }
 // your own reserve overrides, and clearing it goes back to CASA
 for(const v of ['45','0','']){ console.log('setting', JSON.stringify(v), '→', await p.evaluate(v=>{ $('cCat').value='H'; $('pcDep').value='11:30'; $('pcRes').value=v; pcRun();
   const sec=[...document.querySelectorAll('#pcOut .pc-sec')].map(e=>e.textContent).find(t=>/Time and fuel/.test(t))||'-'; const pf=wbPlanFuel({u:'kg'}); return sec.replace(/^.*reserve /,'reserve ')+' | W&B '+pf.res+' min | stored '+JSON.stringify(ls.get('pcRes',null)); },v)); }
 await p.evaluate(()=>{ $('pcDlg').close(); ls.set('pcRes',30); $('fpCheck').click(); }); console.log('dialog shows', await p.inputValue('#pcRes'));
 await p.screenshot({path:'reserve_opt.png'});
 console.log(errs); await b.close(); })();
