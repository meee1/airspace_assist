// ERSA FAC sheet: button on the aerodrome card, in-app viewer (pdf.js), plan aerodromes prefetched
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({...PX9}); await ctx.addInitScript(()=>{ const D=Date, off=D.parse('2026-11-02T01:30:00Z')-D.now(); window.Date=class extends D{ constructor(...a){ super(...(a.length?a:[D.now()+off])); } static now(){ return D.now()+off; } }; });
 const p=await ctx.newPage(); const errs=[], got=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('request',r=>{ if(/\/ersa\//.test(r.url())) got.push(r.url().replace(/^.*\/ersa\//,'')); });
 await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=270&gs=0'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForFunction(()=>FAC.idx,null,{timeout:8000}); await p.waitForTimeout(600);
 console.log('cycle', await p.evaluate(()=>FAC.cyc), '| button:', await p.evaluate(()=>$('adFac').hidden?'hidden':$('adFac').textContent));
 await (await p.$('#adFac')).screenshot({path:'fac_btn.png'}).catch(()=>{});
 await p.click('#adFac'); await p.waitForFunction(()=>$('facBody').querySelectorAll('canvas').length>=7,null,{timeout:20000});
 console.log('viewer:', await p.evaluate(()=>[$('facTitle').textContent, $('facBody').querySelectorAll('canvas').length+' pages', $('facStat').textContent, $('facExt').getAttribute('href')].join(' | ')));
 await p.waitForTimeout(500); console.log('scrollTop', await p.evaluate(()=>$('facBody').scrollTop)); await p.screenshot({path:'fac_view.png'});
 await p.click('#facZoom'); await p.waitForTimeout(1500); console.log('zoom width', await p.evaluate(()=>$('facBody').querySelector('canvas').style.width), 'scrollW>clientW', await p.evaluate(()=>$('facBody').scrollWidth>$('facBody').clientWidth));
 await p.click('#facClose'); console.log('closed', await p.evaluate(()=>!$('facDlg').open));
 // plan with YLIL, YBRS: their sheets get fetched in the background
 got.length=0; await p.evaluate(()=>{ const ap=i=>{ const x=DATA.ap.find(y=>y.i===i); return {n:i,c:i,la:x.la,lo:x.lo}; }; fpSet({name:'T',pts:[ap('YMMB'),ap('YLIL'),ap('YBRS')],i:1}); render(); }); await p.waitForTimeout(800);
 console.log('prefetched', got.sort().join(' '));
 // an aerodrome with no ERSA entry: no button
 console.log('non-ERSA', await p.evaluate(()=>{ const a=DATA.ap.find(x=>x.s!=='E'&&!FAC.idx[x.i]); st.adShown=a; facBtn(); return a.i+' '+($('adFac').hidden?'hidden':'shown'); }));
 console.log(errs); await b.close(); })();
