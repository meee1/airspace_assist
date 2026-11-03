// Lenovo Tab 10.1" (ZAEJ0157AU, TB311XU): 1920x1200 WUXGA at DPR 1.5 -> 1280x800 CSS px; Android status + nav bars ~48 px (installed app), Chrome adds ~56 px
const {chromium}=require('playwright');
const UA='Mozilla/5.0 (Linux; Android 14; TB311XU) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const FSON={cookies:[],origins:[{origin:'http://localhost:8811',localStorage:[{name:'rc_fsMap',value:'true'}]}]};
const V=[['land_app',1280,752],['land_chrome',1280,696],['port_app',800,1232]];
(async()=>{ const b=await chromium.launch();
 for(const scheme of ['light','dark']) for(const [n,w,h] of V){ if(scheme==='dark'&&n==='land_chrome') continue;
  const ctx=await b.newContext({viewport:{width:w,height:h},screen:{width:w,height:h+48},deviceScaleFactor:1.5,isMobile:true,hasTouch:true,userAgent:UA,colorScheme:scheme,storageState:FSON});
  await ctx.addInitScript(()=>{ const D=Date, off=D.parse('2026-11-01T01:30:00Z')-D.now(); window.Date=class extends D{ constructor(...a){ super(...(a.length?a:[D.now()+off])); } static now(){ return D.now()+off; } }; });
  const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8811/index.html?sim=-38.02,145.18&alt=1500&trk=250&gs=90'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(1500);
  await p.evaluate(()=>{ $('cType').value='Bell 206'; $('cSign').value='ABC'; fpSet({name:'YBRS-YMMB-YLIL',kind:'map',i:1,pts:['YBRS','CARR','YMMB','YLIL'].map(c=>{ const q=findPoint(c); return {la:q.la,lo:q.lo,c:q.c||c,n:q.n}; })}); MAP.range=15; render(); });
  await p.waitForTimeout(2500); await p.evaluate(()=>{ render(); if(MAP.last) drawMap(...MAP.last); }); await p.waitForTimeout(600);
  await p.screenshot({path:`play/fs/lenovo_${n}_${scheme}.png`});
  if(scheme==='light'){ await p.click('#fsTabs [data-fs="calls"]'); await p.waitForTimeout(900); await p.screenshot({path:`play/fs/lenovo_${n}_calls.png`}); }
  console.log(scheme,n,await p.evaluate(()=>document.body.className),errs); await ctx.close(); }
 await b.close(); })();
