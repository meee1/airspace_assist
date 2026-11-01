// aerodrome card head (code, name, distance) stays in view while scrolling down the card: phone and landscape tablet
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const errs=[];
 for(const [n,o] of [['phone',PX9],['tab',{viewport:{width:1280,height:800},deviceScaleFactor:1.5}]]){
  const p=await (await b.newContext(o)).newPage(); p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(1200);
  await p.evaluate(()=>{ const r=$('ctafRow').getBoundingClientRect(); window.scrollBy(0,r.top-60); }); await p.waitForTimeout(400);
  const h=await p.evaluate(()=>{ const a=document.querySelector('.ad-head').getBoundingClientRect(), s=document.querySelector('.status').getBoundingClientRect(), c=$('adCard').getBoundingClientRect(); return {head:Math.round(a.top), statusBottom:Math.round(s.bottom), cardTop:Math.round(c.top)}; });
  console.log(n,JSON.stringify(h)); await p.screenshot({path:`play/adsticky_${n}.png`}); }
 console.log(errs); await b.close(); })();
