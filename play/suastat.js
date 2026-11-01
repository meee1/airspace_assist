// SUA status from a NAIPS briefing (play/fixtures/naips_sua.txt) at fixed times, warning rows, temporary zone
const {chromium}=require('playwright'); const {PX9}=require('./px9.js'); const fs=require('fs');
const TXT=fs.readFileSync(__dirname+'/fixtures/naips_sua.txt','utf8');
(async()=>{ const b=await chromium.launch(); const errs=[];
 for(const [lab,iso] of [['night','2026-10-28T10:00:00Z'],['day','2026-10-29T03:00:00Z']]){
  const ctx=await b.newContext(PX9); await ctx.addInitScript(t=>{ const T=Date.parse(t), D=Date, o=D.now; const off=T-o.call(D); Date.now=()=>o.call(D)+off; },iso);
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8811/index.html?sim=YPKL&alt=2000&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(600);
  console.log(lab, await p.evaluate(t=>{ nbLoad(t); render(); return ['R352','D342','R360A','R360C','R360E','R350A','R350B','R350C','R351A','D349','D373','R222F'].map(i=>{ const s=suaStatus(i); return i+'='+(s?s.s+'('+s.why+(s.until?' '+hhmmZ(s.until):'')+(s.lo!=null?' '+s.lo+'-'+s.hi:'')+')':'?'); }).join(' '); },TXT));
  for(const [n,pos,alt] of [['ypkl','-36.88,145.03',2000],['ypkl_hi','-36.88,145.03',2800],['air','-37.97,144.75',3000],['ua','-37.96,143.78',600]]){
   await p.evaluate(([pos,alt])=>{ $('simPos').value=pos; $('simAlt').value=String(alt); simApply(); CH.on=false; MAP.ter=false; MAP.range=20; MAP.up='north'; MAP.pan=null; render(); },[pos,alt]).catch(e=>errs.push(String(e)));
   await p.waitForTimeout(400);
   console.log(' ',n, await p.evaluate(()=>[$('sCls').textContent, $('sInSua').hidden?'-':$('sInSua').innerText.replace(/\n/g,' | ')].join(' || ')));
   if(lab==='night'&&(n==='ypkl'||n==='air')){ await p.evaluate(()=>window.scrollTo(0,0)); await (await p.$('.status')).screenshot({path:`play/suastat_${n}_rows.png`}); await (await p.$('#map')).screenshot({path:`play/suastat_${n}_map.png`}); } }
  await ctx.close(); }
 console.log(errs); await b.close(); })();
