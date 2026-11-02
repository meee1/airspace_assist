// W&B: build a profile through the editor fields (typing), then load it
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const p=await (await b.newContext({...PX9})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YBRS&alt=50&trk=000&gs=0'); await p.waitForFunction(()=>typeof wbCheck==='function'); await p.waitForTimeout(500);
 await p.evaluate(()=>{ localStorage.removeItem('rc_wb'); WB={profiles:[],cur:null,load:{}}; $('cType').value='R44'; $('fpWb').click(); });
 console.log('first open:', await p.evaluate(()=>$('wbProfSel').value&&$('wbProfSel').selectedOptions[0].textContent), '|', await p.evaluate(()=>$('wbOut').innerText.slice(0,90)));
 const f=async(sel,v)=>{ await p.fill(sel,v); await p.waitForTimeout(60); };
 await f('#wbEd [data-f="ew"]','680'); await f('#wbEd [data-f="ea"]','2600'); await f('#wbEd [data-f="maxW"]','1090');
 for(const [k,a] of [[0,'1250'],[1,'1250'],[2,'2000'],[3,'2200'],[4,'2650']]) await f(`#wbEd tr[data-k="${k}"] [data-s="a"]`,a);
 await f('#wbEd tr[data-k="4"] [data-s="max"]','180');
 await f('#wbEd [data-f="env"]','2400,680\n2400,1090\n2700,1090\n2700,680'); await p.waitForTimeout(400);
 await p.evaluate(()=>document.activeElement.blur()); await p.evaluate(()=>wbRender()); await p.waitForTimeout(200);
 console.log('load fields:', await p.evaluate(()=>[...$('wbLoad').querySelectorAll('label')].map(l=>l.textContent.trim()).join(' | ')));
 await f('#wbLoad [data-v="0"]','90'); await f('#wbLoad [data-v="4"]','100'); await p.waitForTimeout(400);
 console.log('result:', await p.evaluate(()=>$('wbOut').querySelector('.wb-res').innerText+' · '+$('wbOut').querySelector('.wb-sug').innerText.split('\n')[0]));
 await p.reload(); await p.waitForFunction(()=>typeof wbCheck==='function'); console.log('after reload:', await p.evaluate(()=>{ const P=wbCur(); return P.name+' ew '+P.ew+' load '+JSON.stringify(WB.load[P.id]); }));
 console.log(errs); await b.close(); })();
