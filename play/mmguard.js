// press and hold on a touch phone: the menu's buttons ignore the lifting finger, then work normally
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({...PX9,hasTouch:true,isMobile:true}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(600);
 await p.evaluate(()=>{ window.GOS=0; const o=setGo; window.setGo=(...a)=>{ GOS++; return o(...a); }; });
 const cv=await p.$('#map'), bb=await cv.boundingBox(), cdp=await ctx.newCDPSession(p);
 const touch=async(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints: type==='touchEnd'?[]:[{x,y}]});
 // find where the first button ends up, then hold right there
 await p.evaluate(()=>{ const [x,y]=[180,200]; mapMenu(x,y); }); const btn=await (await p.$('#mmBtns .btn')).boundingBox(); await p.evaluate(()=>mapMenuClose());
 const hx=btn.x+btn.width/2, hy=btn.y+btn.height/2; console.log('holding at', Math.round(hx), Math.round(hy), 'inside map', hy>bb.y&&hy<bb.y+bb.height);
 await touch('touchStart',hx,hy); await p.waitForTimeout(800);
 console.log('menu open after hold:', await p.evaluate(()=>!$('mapMenu').hidden));
 await touch('touchEnd'); await p.waitForTimeout(100);
 // the browser may turn the lift into a click on what's now under the finger: emulate that
 await p.evaluate(([x,y])=>{ const el=document.elementFromPoint(x,y); window.UNDER=el&&el.textContent; el&&el.click(); },[hx,hy]);
 console.log('under finger:', await p.evaluate(()=>UNDER), '| go-to fired by the lift:', await p.evaluate(()=>GOS), '| menu still open:', await p.evaluate(()=>!$('mapMenu').hidden));
 await p.waitForTimeout(500); await p.tap('#mmBtns .btn'); await p.waitForTimeout(200);
 console.log('a real tap later: go-to fired', await p.evaluate(()=>GOS), 'menu open', await p.evaluate(()=>!$('mapMenu').hidden));
 console.log(errs); await b.close(); })();
