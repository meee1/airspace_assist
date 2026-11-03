// Bell 206 baggage at FS 131.0: loads, limit 250 lb, old profiles get the arm
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const p=await (await b.newContext({...PX9})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YBRS'); await p.waitForFunction(()=>typeof wbCheck==='function');
 await p.evaluate(()=>{ localStorage.removeItem('rc_wb'); WB={profiles:[],cur:null,load:{}}; FP=null; $('fpWb').click(); { const q=wbFromTpl('b206b3'); WB.profiles=[q]; WB.cur=q.id; WB.load={}; WB.added={b206bw:1}; WB.eu={}; wbSave(); $('wbEd').innerHTML=''; $('wbLoad').innerHTML=''; wbRender(); } const P=wbCur(); P.ew=1760.5; P.ea=116.1; P.el=0.2; wbSave(); });
 for(const [n,v] of [['pilot+pax, 100 lb bags, 60 gal',[170,170,0,100,null,60]],['pilot, 3 aft, 250 lb bags, 91 gal',[170,0,510,250,null,91]],['bags 260 (over)',[170,0,0,260,null,40]]])
   console.log(n.padEnd(36), await p.evaluate(v=>{ const P=wbCur(), r=wbCheck(P,v), fx=r.ok?[]:wbFixes(P,v); return `${r.ok?'OK ':'OUT'} ${Math.round(r.to.w)} lb @ ${r.to.a.toFixed(1)}${r.why.length?' · '+r.why.join(' | '):''}${fx.length?' · fix: '+fx.map(x=>x.txt.replace(/<[^>]+>/g,'')).join(' | '):''}`; },v));
 console.log('bag box:', await p.evaluate(()=>{ wbRender(); const i=$('wbLoad').querySelector('[data-v="3"]'); return 'disabled '+i.disabled+' ph '+i.placeholder; }));
 // an earlier Bell profile with no baggage arm gets 131.0 on load
 await p.evaluate(()=>{ const P=wbCur(); P.st[3].a=null; wbSave(); }); await p.reload(); await p.waitForFunction(()=>typeof wbCheck==='function');
 console.log('migrated arm:', await p.evaluate(()=>wbCur().st[3].a), errs); await b.close(); })();
