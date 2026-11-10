// Pixel 9 Pro: 1280x2856 at DPR 3 -> 427x952 CSS px; Chrome on Android, with ~70 px of browser chrome (installed app: full height)
const {chromium}=require('playwright');
// TEST_DPR (set to 1 by play/run-all.js): the device pixel ratio for both profiles. Headless Chromium paints in software, so the
// phone's 3x costs nine times the pixels of 1x for the same checks; run a test on its own (no TEST_DPR) for full-density screenshots.
const DPR=+process.env.TEST_DPR||0;
const PX9={viewport:{width:427,height:880},screen:{width:427,height:952},deviceScaleFactor:DPR||3,isMobile:true,hasTouch:true,
  userAgent:'Mozilla/5.0 (Linux; Android 15; Pixel 9 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  storageState:{cookies:[],origins:[{origin:'http://localhost:8811',localStorage:[{name:'rc_fsMap',value:'false'}]}]}};   // older tests: classic page layout (play/fsmap.js turns full screen on)
// Michael's tablet, a Lenovo Tab 10.1" (TB311XU) (10 Nov 2026): the render timing panel's viewport line reads 1470x970 @1.5 (CSS px, landscape, after browser bars) ->
// ~2205x1455 device px. Android Chrome, touch; full-screen map uses the tablet layout here (fsTab: landscape, >=800 wide).
const TAB={viewport:{width:1470,height:970},screen:{width:1470,height:970},deviceScaleFactor:DPR||1.5,isMobile:true,hasTouch:true,
  userAgent:'Mozilla/5.0 (Linux; Android 14; TB311XU) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  storageState:{cookies:[],origins:[{origin:'http://localhost:8811',localStorage:[{name:'rc_fsMap',value:'false'}]}]}};
module.exports={PX9,TAB};
if(require.main===module)(async()=>{ const b=await chromium.launch(); const errs=[];
 for(const scheme of ['light','dark']){
 const ctx=await b.newContext({...PX9,colorScheme:scheme}); const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=-37.95,145.0&alt=1500&trk=090&gs=90'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(600);
 await p.setInputFiles('#fpFile',__dirname+'/fixtures/ybrs.gpx'); await p.waitForFunction(()=>FP); await p.evaluate(()=>{FP.i=8; render();}); await p.waitForTimeout(600);
 const H=await p.evaluate(()=>document.documentElement.scrollHeight); const ow=await p.evaluate(()=>[document.documentElement.scrollWidth, innerWidth]);
 console.log(scheme,'page height',H,'scrollWidth/innerWidth',ow);
 // anything wider than the viewport?
 console.log('overflowing:', await p.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect(); return r.width>0 && (r.right>innerWidth+1);}).slice(0,8).map(e=>e.tagName+'#'+e.id+'.'+e.className+' '+Math.round(e.getBoundingClientRect().right))));
 for(let y=0,i=0;y<H&&i<8;y+=880,i++){ await p.evaluate(y=>scrollTo(0,y),y); await p.waitForTimeout(150); await p.screenshot({path:`play/px9_${scheme}_${i}.png`}); }
 await ctx.close(); }
 console.log(errs); await b.close(); })();
