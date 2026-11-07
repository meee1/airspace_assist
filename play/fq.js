const {chromium,devices}=require('playwright');
(async()=>{ const b=await chromium.launch(); require('./classic.js')(b); const errs=[];
 for(const [dev,name] of [[devices['iPhone 13'],'fq_13.png'],[devices['iPhone SE'],'fq_se.png']]){
 const p=await (await b.newContext({...dev})).newPage(); p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YBRS&alt=1500&trk=045&gs=90'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(500);
 for(const [pos,alt] of [['YBRS',1500],['YMMB',800],['-37.95,145.0',3000]]){ await p.evaluate(([pos,alt])=>{ $('simPos').value=pos; $('simAlt').value=alt; simApply(); },[pos,alt]); await p.waitForTimeout(300);
   console.log(name,pos, await p.evaluate(()=>[...document.querySelectorAll('.st.fq')].map(e=>e.innerText.replace(/\n/g,' ')).join(' | '))); }
 await p.evaluate(()=>{ $('simPos').value='YBRS'; simApply(); }); await p.waitForTimeout(300);
 await (await p.$('.status')).screenshot({path:'play/'+name}); }
 console.log(errs); await b.close(); })();
