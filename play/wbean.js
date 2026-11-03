// the weighed Bell 206B profile (weighing record, fuel gauge placard): default, existing installs, gauge-reading fuel entry
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({...PX9}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YBRS&alt=50&trk=000&gs=0'); await p.waitForFunction(()=>typeof wbCheck==='function'); await p.waitForTimeout(400);
 await p.evaluate(()=>{ localStorage.removeItem('rc_wb'); WB={profiles:[],cur:null,load:{}}; FP=null; ls.set('pcBurn',100); $('fpWb').click(); });
 console.log('default:', await p.evaluate(()=>{ const P=wbCur(); return `${P.name} · ${P.u} · empty ${P.ew} kg @ ${P.ea} / ${P.el} mm · MTOW ${P.maxW} · stations ${P.st.map(s=>s.n).join(', ')} · gauge rows ${wbCal(P).length} · ready: ${wbReady(P).length?wbReady(P).join(','):'yes'}`; }));
 await p.selectOption('#wbEuW','kg'); await p.selectOption('#wbEuF','gauge'); await p.waitForTimeout(200);
 for(const [k,v] of [[0,'82'],[1,'68'],[2,'145'],[3,'27']]){ await p.fill(`#wbLoad input[data-v="${k}"]`,v); await p.waitForTimeout(150); }
 await p.selectOption('#wbLoad select[data-v="4"]','200'); await p.waitForTimeout(400);
 console.log(await p.evaluate(()=>[...$('wbLoad').querySelectorAll('tr')].map(r=>[...r.children].map(c=>{ const i=c.querySelector('input,select'); return (i?(i.tagName==='SELECT'?i.selectedOptions[0].text:i.value)+' ':'')+c.innerText.replace(/\n/g,' ').replace(/^(E|FULL|\d+) → .*?L\s*/,''); }).join(' | ')).join('\n')));
 console.log(await p.evaluate(()=>$('wbOut').querySelector('.wb-res').innerText+' · '+[...$('wbOut').querySelectorAll('table.pc-t tr')].slice(1,3).map(r=>r.innerText.replace(/\s+/g,' ')).join(' / ')+'\n'+$('wbOut').querySelector('.wb-sug').innerText));
 console.log('stored fuel L:', await p.evaluate(()=>WB.load[wbCur().id][4]));
 await p.evaluate(()=>{ $('wbDlg').scrollTop=$('wbLoad').offsetTop-90; }); await (await p.$('#wbDlg')).screenshot({path:'play/wbean_sheet.png'});
 await p.evaluate(()=>{ $('wbDlg').scrollTop=$('wbCv').offsetTop-40; }); await (await p.$('#wbDlg')).screenshot({path:'play/wbean_plot.png'});
 // an existing install (Bell 206B-3 profile already there) gets it added once and selected
 await p.evaluate(()=>{ const old=wbFromTpl('b206b3'); localStorage.setItem('rc_wb',JSON.stringify({profiles:[old],cur:old.id,load:{}})); });
 await p.reload(); await p.waitForFunction(()=>typeof wbCheck==='function');
 console.log('existing install:', await p.evaluate(()=>WB.profiles.map(q=>q.name).join(' | ')+' · current '+wbCur().name));
 await p.reload(); await p.waitForFunction(()=>typeof wbCheck==='function'); console.log('after 2nd reload:', await p.evaluate(()=>WB.profiles.length));
 console.log(errs); await b.close(); })();
