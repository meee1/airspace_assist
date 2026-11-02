// on-screen keyboard: the viewport shrinks while typing in the leg altitude box; focus must stay
const {chromium}=require('playwright');
(async()=>{ const b=await chromium.launch(); for(const [n,w,h,kh] of [['tablet landscape',1280,800,400],['tablet portrait',800,1280,420],['phone',412,915,330]]){
 const ctx=await b.newContext({viewport:{width:w,height:h},screen:{width:w,height:h},isMobile:true,hasTouch:true,deviceScaleFactor:1.5,storageState:{cookies:[],origins:[{origin:'http://localhost:8811',localStorage:[{name:'rc_fsMap',value:'true'}]}]}}); await ctx.addInitScript(([w,h])=>{ Object.defineProperty(screen,'width',{get:()=>w}); Object.defineProperty(screen,'height',{get:()=>h}); },[w,h]);   // a real device's screen doesn't shrink with the keyboard
 const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YBRS&alt=1500&trk=045&gs=90'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(600);
 await p.evaluate(()=>{ const ad=i=>{ const a=DATA.ap.find(x=>x.i===i); return {n:a.i,c:a.i,la:a.la,lo:a.lo}; }; fpSet({name:'T',pts:[ad('YBRS'),{n:'BELLARINE',la:-38.20,lo:144.62},ad('YLIL')],i:1}); FP_EDIT=true; render(); $('fsTabs').querySelector('[data-fs="fpBox"]').click(); });
 await p.waitForTimeout(700); const cls0=await p.evaluate(()=>document.body.className);
 await p.focus('#fpLegs .altin[data-k="2"]'); await p.setViewportSize({width:w,height:h-kh}); await p.waitForTimeout(1500);   // the keyboard opens
 await p.keyboard.type('45',{delay:400});
 const r=await p.evaluate(()=>({scr:screen.width+'x'+screen.height+' in '+innerWidth+'x'+innerHeight, cls:document.body.className, focus:document.activeElement&&document.activeElement.className, val:document.activeElement&&document.activeElement.value}));
 await p.keyboard.press('Enter'); await p.setViewportSize({width:w,height:h}); await p.waitForTimeout(800);
 console.log(n.padEnd(18), cls0,'->',JSON.stringify(r),'alt',await p.evaluate(()=>FP.pts[2].alt), errs); await ctx.close(); } await b.close(); })();
