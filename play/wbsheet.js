// W&B load sheet (per-station weights, arm, moment, can add) and the loading-path plot: Bell 206B-3 example
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); for(const dev of ['phone','tab']){ const ctx=await b.newContext(dev==='phone'?{...PX9}:{viewport:{width:1280,height:800},deviceScaleFactor:1.5,isMobile:true,hasTouch:true});
 const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YBRS&alt=50&trk=000&gs=0'); await p.waitForFunction(()=>typeof wbCheck==='function'); await p.waitForTimeout(400);
 await p.evaluate(()=>{ localStorage.removeItem('rc_wb'); WB={profiles:[],cur:null,load:{}}; FP=null; ls.set('pcBurn',100); $('fpWb').click(); { const q=wbFromTpl('b206b3'); WB.profiles=[q]; WB.cur=q.id; WB.load={}; WB.added={b206bw:1}; WB.eu={}; wbSave(); $('wbEd').innerHTML=''; $('wbLoad').innerHTML=''; wbRender(); } const P=wbCur(); P.ew=1760.5; P.ea=116.1; P.el=0.2; WB.load[P.id]=[]; wbSave(); $('wbEd').innerHTML=''; $('wbLoad').innerHTML=''; wbRender(); });
 // type the example load into the station boxes, as on the phone
 for(const [k,v] of [[0,'180'],[1,'150'],[2,'320'],[3,'60'],[5,'70']]){ await p.fill(`#wbLoad input[data-v="${k}"]`,v); await p.waitForTimeout(250); }
 await p.evaluate(()=>document.activeElement.blur()); await p.waitForTimeout(300);
 if(dev==='phone') console.log(await p.evaluate(()=>[...$('wbLoad').querySelectorAll('tr')].map(r=>[...r.children].map(c=>(c.querySelector('input')?c.querySelector('input').value+' ':'')+c.innerText.replace(/\n/g,' ')).join(' | ')).join('\n')));
 if(dev==='phone') console.log(await p.evaluate(()=>$('wbOut').querySelector('.wb-res').innerText+'\n'+$('wbOut').querySelector('.wb-sug').innerText));
 await p.evaluate(()=>{ const d=$('wbDlg'); d.scrollTop=$('wbLoad').offsetTop-60; }); await p.waitForTimeout(200); await (await p.$('#wbDlg')).screenshot({path:`play/wbsheet_${dev}.png`});
 await p.evaluate(()=>{ const d=$('wbDlg'); d.scrollTop=$('wbCv').offsetTop-40; }); await p.waitForTimeout(200); await (await p.$('#wbDlg')).screenshot({path:`play/wbplot_${dev}.png`});
 console.log(dev,'errors',errs); await ctx.close(); } await b.close(); })();
