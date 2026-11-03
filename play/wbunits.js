// W&B load entry in kg / litres on a lb / USG profile (and back)
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const p=await (await b.newContext({...PX9})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YBRS&alt=50&trk=000&gs=0'); await p.waitForFunction(()=>typeof wbCheck==='function'); await p.waitForTimeout(400);
 await p.evaluate(()=>{ localStorage.removeItem('rc_wb'); WB={profiles:[],cur:null,load:{}}; FP=null; $('fpWb').click(); { const q=wbFromTpl('b206b3'); WB.profiles=[q]; WB.cur=q.id; WB.load={}; WB.added={b206bw:1}; WB.eu={}; wbSave(); $('wbEd').innerHTML=''; $('wbLoad').innerHTML=''; wbRender(); } const P=wbCur(); P.ew=1760.5; P.ea=116.1; P.el=0.2; WB.load[P.id]=[]; wbSave(); $('wbLoad').innerHTML=''; wbRender(); });
 await p.selectOption('#wbEuW','kg'); await p.selectOption('#wbEuF','L'); await p.waitForTimeout(200);
 for(const [k,v] of [[0,'82'],[1,'68'],[2,'145'],[3,'27'],[5,'265']]){ await p.fill(`#wbLoad input[data-v="${k}"]`,v); await p.waitForTimeout(200); }
 await p.evaluate(()=>document.activeElement.blur()); await p.waitForTimeout(300);
 const row=()=>p.evaluate(()=>[...$('wbLoad').querySelectorAll('tr')].map(r=>[...r.children].map(c=>(c.querySelector('input')?c.querySelector('input').value+' ':'')+c.innerText.replace(/\n/g,' ')).join(' | ')).join('\n'));
 console.log('kg / L entry:\n'+await row());
 console.log('stored (lb, USG):', await p.evaluate(()=>JSON.stringify(WB.load[wbCur().id].map(v=>v==null?v:Math.round(v*10)/10))), '| result', await p.evaluate(()=>$('wbOut').querySelector('.wb-res').innerText));
 await p.selectOption('#wbEuW','lb'); await p.selectOption('#wbEuF','USG'); await p.waitForTimeout(200);
 console.log('back to lb / USG boxes:', await p.evaluate(()=>[...$('wbLoad').querySelectorAll('input')].map(i=>i.value).join(', ')));
 await p.reload(); await p.waitForFunction(()=>typeof wbCheck==='function'); console.log('remembered:', await p.evaluate(()=>JSON.stringify(WB.eu)));
 await p.evaluate(()=>{ $('fpWb').click(); WB.eu={w:'kg',f:'L'}; wbSave(); $('wbLoad').innerHTML=''; wbRender(); $('wbDlg').scrollTop=$('wbLoad').offsetTop-90; }); await p.waitForTimeout(300); await (await p.$('#wbDlg')).screenshot({path:'play/wbunits.png'});
 console.log(errs); await b.close(); })();
