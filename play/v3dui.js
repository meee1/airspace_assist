// 3D window UI: open from Options, select camera/surface, toggle a layer, drag, resize, close; the box and options are remembered
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch({args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']}); const ctx=await b.newContext({...PX9}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YBRS&alt=1500&trk=060&gs=90'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(1500);
 await p.evaluate(()=>{ $('optV3d').checked=true; $('optV3d').dispatchEvent(new Event('change')); }); await p.waitForTimeout(1500);
 const box=()=>p.evaluate(()=>{ const r=$('v3dWin').getBoundingClientRect(); return [r.x,r.y,r.width,r.height].map(Math.round).join(','); });
 console.log('open', await p.evaluate(()=>!$('v3dWin').hidden), 'box', await box());
 await p.selectOption('#v3dCam','chase'); await p.selectOption('#v3dSurf','relief'); await p.click('#v3dWin [data-v3="air"]'); await p.waitForTimeout(500);
 console.log('opts', await p.evaluate(()=>JSON.stringify(V3.opt)), 'walls', await p.evaluate(()=>V3.nW));
 const h=await (await p.$('#v3dWin .v3h b')).boundingBox(); await p.mouse.move(h.x+10,h.y+5); await p.mouse.down(); await p.mouse.move(h.x-60,h.y-200,{steps:5}); await p.mouse.up();
 const rz=await (await p.$('#v3dWin .v3rz')).boundingBox(); await p.mouse.move(rz.x+10,rz.y+10); await p.mouse.down(); await p.mouse.move(rz.x-40,rz.y+60,{steps:5}); await p.mouse.up();
 await p.waitForTimeout(400); console.log('moved+resized', await box()); await p.screenshot({path:'/tmp/claude-0/v3d_page.png'});
 await p.click('#v3dX'); console.log('closed', await p.evaluate(()=>$('v3dWin').hidden), 'option', await p.evaluate(()=>$('optV3d').checked));
 await p.reload(); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(1200);
 console.log('after reload: open', await p.evaluate(()=>!$('v3dWin').hidden), 'saved box', await p.evaluate(()=>JSON.stringify(ls.get('v3dBox'))), 'opts', await p.evaluate(()=>ls.get('v3dOpt').cam));
 console.log(errs); await b.close(); })();
