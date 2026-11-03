// emergency page: call text, who to call, position, nearest places, in class G / a control zone / class C; full-screen button
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); for(const fs of [false,true]){ const ctx=await b.newContext({...PX9,storageState:{cookies:[],origins:[{origin:'http://localhost:8811',localStorage:[{name:'rc_fsMap',value:String(fs)}]}]}});
 await ctx.addInitScript(()=>{ const D=Date, off=D.parse('2026-11-03T02:00:00Z')-D.now(); window.Date=class extends D{ constructor(...a){ super(...(a.length?a:[D.now()+off])); } static now(){ return D.now()+off; } }; });
 const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YBRS&alt=1500&trk=045&gs=90'); await p.waitForFunction(()=>typeof sosRender==='function'); await p.waitForTimeout(800);
 await p.evaluate(()=>{ $('cType').value='Bell 206'; $('cSign').value='ABC'; });
 const at=async(n,la,lo,alt,trk)=>{ await p.evaluate(([la,lo,alt,trk])=>{ $('simPos').value=la+','+lo; $('simAlt').value=alt; $('simTrk').value=String(trk).padStart(3,'0'); simApply(); render(); },[la,lo,alt,trk]); await p.waitForTimeout(300);
   if(!(await p.evaluate(()=>$('sosDlg').open))) await p.click('#sosBtn'); await p.evaluate(()=>sosRender()); await p.waitForTimeout(100);
   return p.evaluate(()=>({freq:$('sosFreq').innerText, call:$('sosCall').innerText, pos:$('sosPos').innerText.replace(/\n/g,' | '), near:[...$('sosNear').querySelectorAll('tr')].slice(0,4).map(r=>r.innerText.replace(/\s+/g,' ')).join(' / ')})); };
 if(!fs){ for(const [n,la,lo,alt,trk] of [['class G near Barwon Heads',-38.20,144.47,1500,45],['Avalon control zone',-38.06,144.43,1200,90],['class C over Melbourne',-37.81,144.96,2500,0]]){
     const r=await at(n,la,lo,alt,trk); console.log(`== ${n}\n  ${r.freq}\n  ${r.call}\n  ${r.pos}\n  ${r.near}`); }
   console.log('== medical divert:', await p.evaluate(()=>{ $('sosNat').value='medical emergency on board'; $('sosInt').value='divert'; sosRender(); return $('sosCall').innerText; }));
   await p.selectOption('#sosNat','low fuel'); await p.selectOption('#sosInt','divert'); await p.click('#sosPobP'); await p.click('#sosDlg .sos-kind [data-k="PAN PAN"]'); await p.waitForTimeout(200);
   console.log('PAN, low fuel, divert, 2 POB:', await p.evaluate(()=>$('sosCall').innerText));
   await (await p.$('#sosDlg')).screenshot({path:'play/sos.png'});
   await p.click('#sosNear tr'); await p.waitForTimeout(200); console.log('tap nearest -> Go to', await p.evaluate(()=>GO&&GO.c), 'dialog open', await p.evaluate(()=>$('sosDlg').open)); }
 else { const box=await p.evaluate(()=>{ const r=$('sosBtn').getBoundingClientRect(); return [Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height), getComputedStyle($('sosBtn')).display]; }); console.log('full-screen SOS button', box);
   await p.click('#sosBtn'); await p.waitForTimeout(300); console.log('opens', await p.evaluate(()=>$('sosDlg').open)); await p.screenshot({path:'play/sos_fs.png'}); }
 console.log(fs?'fs':'classic','errors',errs); await ctx.close(); } await b.close(); })();
