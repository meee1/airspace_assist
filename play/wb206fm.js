// Bell 206B-3 default profile with the flight manual envelope: sample loadings
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const p=await (await b.newContext({...PX9})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YBRS&alt=50&trk=000&gs=0'); await p.waitForFunction(()=>typeof wbCheck==='function'); await p.waitForTimeout(400);
 await p.evaluate(()=>{ localStorage.removeItem('rc_wb'); WB={profiles:[],cur:null,load:{}}; ls.set('pcBurn',100); ls.set('pcGs',100); FP=null; $('fpWb').click(); });
 console.log('needs:', await p.evaluate(()=>$('wbOut').innerText.slice(0,120)));
 await p.evaluate(()=>{ const P=wbCur(); P.ew=1760.5; P.ea=116.1; P.el=0.2; wbSave(); wbRender(); });   // MM sample weight empty, for the test only
 // [pilot, fwd pax, aft pax(3), baggage(no arm), oil(fixed), fuel USG]
 for(const [n,v] of [['MM most fwd',[170,170,510,0,null,0]],['MM most aft (full 91 gal)',[170,0,510,0,null,91]],['pilot only, 40 gal',[170,0,0,0,null,40]],['light pilot 140',[140,0,0,0,null,40]],['4 heavy pax + full fuel',[200,200,600,0,null,91]],['heavy right pilot only',[250,0,0,0,null,10]]]){
   console.log(n.padEnd(26), await p.evaluate(v=>{ const P=wbCur(), r=wbCheck(P,v), f=q=>q?Math.round(q.w)+' lb @ '+q.a.toFixed(1)+' / '+q.l.toFixed(2):'-', mf=wbMaxFuel(P,v), fx=r.ok?[]:wbFixes(P,v);
     return `${r.ok?'OK ':'OUT'} TO ${f(r.to)} · ZF ${f(r.zf)} · max fuel ${mf}${r.why.length?'\n      '+r.why.join(' | '):''}${fx.length?'\n      fix: '+fx.map(x=>x.txt.replace(/<[^>]+>/g,'')).join(' | '):''}`; },v)); }
 await p.evaluate(()=>{ WB.load[wbCur().id]=[170,0,510,0,null,91]; wbSave(); $('wbEd').innerHTML=''; $('wbLoad').innerHTML=''; wbRender(); }); await p.waitForTimeout(300);
 console.log('baggage box:', await p.evaluate(()=>{ const i=$('wbLoad').querySelector('[data-v="3"]'); return i.disabled+' '+i.placeholder; }));
 await p.evaluate(()=>{ const d=$('wbDlg'); d.scrollTop=380; }); await (await p.$('#wbDlg')).screenshot({path:'play/wb206fm.png'});
 console.log(errs); await b.close(); })();
