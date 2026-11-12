// The Range circle and the map's range are separate settings: zooming (buttons, wheel/pinch save) never switches the
// circle on, turning the circle off doesn't reset the range, both are kept across a reload; an old true/false left in
// rc_mapRange moves to rc_rangeRing (and the map gets 10 NM).
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const errs=[];
 const run=async(init,name,fn)=>{ const ctx=await b.newContext({...PX9}); await ctx.addInitScript(init);
   const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(400);
   await fn(p); await ctx.close(); };
 const S=p=>p.evaluate(()=>({range:MAP.range, ring:ls.get('rangeRing',false), btn:$('mapRange').getAttribute('aria-pressed'), saved:localStorage.getItem('rc_mapRange')}));
 // the reported case: circle off, zoom out
 await run(()=>{ if(!sessionStorage.getItem('x')){ sessionStorage.setItem('x','1'); localStorage.setItem('rc_mapRange','10'); localStorage.setItem('rc_rangeRing','false'); } },'off',async p=>{
   await p.evaluate(()=>fuSet(200,100));
   for(let i=0;i<3;i++){ await p.click('#mapOut'); await p.waitForTimeout(100); }
   let s=await S(p); console.log('circle off, zoom out ×3:', JSON.stringify(s)); if(s.ring||s.btn!=='false'||s.range<=10) errs.push('zoom out turned it on '+JSON.stringify(s));
   await p.click('#mapRange'); await p.waitForTimeout(100); await p.click('#mapIn'); await p.waitForTimeout(100);
   s=await S(p); console.log('circle on, zoom in:', JSON.stringify(s)); if(!s.ring||s.btn!=='true') errs.push('on '+JSON.stringify(s));
   await p.click('#mapRange'); await p.waitForTimeout(100); const r0=(await S(p)).range; await p.reload(); await p.waitForFunction(()=>typeof render==='function');
   s=await S(p); console.log('circle off, after reload:', JSON.stringify(s)); if(s.ring||s.range!==r0) errs.push('reload '+JSON.stringify(s)+' range was '+r0); });
 // left over from before: rc_mapRange = true (the circle) -> the circle on, the map at 10 NM
 await run(()=>{ if(!sessionStorage.getItem('x')){ sessionStorage.setItem('x','1'); localStorage.setItem('rc_mapRange','true'); localStorage.removeItem('rc_rangeRing'); } },'old',async p=>{
   const s=await S(p); console.log('old true/false moved:', JSON.stringify(s)); if(!s.ring||s.range!==10||s.saved!=='10') errs.push('migration '+JSON.stringify(s)); });
 console.log(errs); await b.close(); })();
