// Bell 206B-3 default profile vs the MM ch 8 Figure 8-4 sample (most forward / most aft CG)
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const p=await (await b.newContext({...PX9})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YBRS&alt=50&trk=000&gs=0'); await p.waitForFunction(()=>typeof wbCheck==='function'); await p.waitForTimeout(400);
 await p.evaluate(()=>{ localStorage.removeItem('rc_wb'); WB={profiles:[],cur:null,load:{}}; $('fpWb').click(); });
 console.log('default:', await p.evaluate(()=>{ const P=wbCur(); return P.name+' · '+P.u+' · max '+P.maxW+' · '+P.st.map(s=>`${s.n} ${s.k} ${s.a}/${s.l}${s.max!=null?' max '+s.max:''}`).join(' | '); }));
 console.log('needs:', await p.evaluate(()=>$('wbOut').innerText.slice(0,200)));
 const r=await p.evaluate(()=>{ const P=wbCur(); P.ew=1760.5; P.ea=116.1; P.el=0.2; P.env='100,1500\n100,3200\n120,3200\n120,1500'; P.st[3].a=148;   // sample weight empty; dummy wide envelope only to compute
   const f=v=>{ const x=wbSum(P,v); return Math.round(x.w*10)/10+' lb @ '+x.a.toFixed(1)+' in, lat '+x.l.toFixed(1); };
   return {fwd:f([170,170,510,0,null,0]), aft:f([170,0,510,0,null,91])}; });
 console.log('most fwd  (MM 2622.8 @ 107.4, lat 0.4):', r.fwd); console.log('most aft  (MM 3071.6 @ 111.9, lat 0.9):', r.aft);
 console.log('load fields:', await p.evaluate(()=>{ wbRender(); return [...$('wbLoad').querySelectorAll('label')].map(l=>l.textContent.trim()).join(' | '); }));
 await (await p.$('#wbDlg')).screenshot({path:'play/wb206.png'}); console.log(errs); await b.close(); })();
