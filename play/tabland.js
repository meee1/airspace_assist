// which full-screen layout each landscape/portrait size gets (fsm-tab = tablet landscape: tiles column on the left)
const {chromium}=require('playwright');
const V=[['lenovo 1280x800',1280,800],['tab 960x600',960,600],['tab 853x533',853,533],['tab 800x480',800,480],['tab portrait 800x1280',800,1280],['phone land 915x412',915,412],['phone land 915x360',915,360],['phone 412x915',412,915]];
(async()=>{ const b=await chromium.launch(); for(const [n,w,h] of V){ const ctx=await b.newContext({viewport:{width:w,height:h},isMobile:true,hasTouch:true,deviceScaleFactor:2,storageState:{cookies:[],origins:[{origin:'http://localhost:8811',localStorage:[{name:'rc_fsMap',value:'true'}]}]}});
 const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); await p.goto('http://localhost:8811/index.html?sim=YBRS&alt=1500&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(800);
 console.log(n.padEnd(22), await p.evaluate(()=>document.body.className), errs.length?errs:''); if(n.startsWith('tab 853')) await p.screenshot({path:'play/tabland_853.png'}); await ctx.close(); } await b.close(); })();
