// Tap a tile to enlarge it: the first tap grows the tile (inside the screen) and does not run its action; a second tap
// while it's big runs the action (full screen: the whole top bar; FUEL: the fuel timer); it stays big (no timeout) until
// you tap elsewhere; with the option off a tap acts at once. Phone full screen, phone classic and the tablet.
const {chromium}=require('playwright'); const {PX9,TAB}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const errs=[];
 for(const [nm,prof,fs] of [['phone full screen',PX9,true],['phone classic',PX9,false],['tablet',TAB,true]]){
  const ctx=await b.newContext({...prof,storageState:undefined}); const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(nm+': '+e.message));
  await p.addInitScript(v=>{ try{ localStorage.setItem('rc_fsMap',v); }catch(e){} },String(fs));
  await p.goto('http://localhost:8811/index.html?sim=YBRS&alt=1500&trk=045&gs=90'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(700);
  await p.evaluate(()=>{ fuSet(200,100); render(); }); await p.waitForTimeout(200);
  const box=id=>p.evaluate(id=>{ const r=$(id).getBoundingClientRect(); return {w:Math.round(r.width),h:Math.round(r.height),l:Math.round(r.left),t:Math.round(r.top),r:Math.round(r.right),b:Math.round(r.bottom),big:$(id).hasAttribute('data-zb'),vw:innerWidth,vh:innerHeight}; },id);
  for(const id of ['sAltBox','sCtafBox','sHdgBox']){ const a=await box(id); await p.click('#'+id,{position:{x:8,y:8}}); await p.waitForTimeout(250); const z=await box(id);
    const inside=z.l>=0&&z.t>=0&&z.r<=z.vw&&z.b<=z.vh, bar=await p.evaluate(()=>!!FS.bar);
    console.log(nm.padEnd(18), id.padEnd(9), `${a.w}x${a.h} -> ${z.w}x${z.h}`, z.big?'big':'NOT BIG', inside?'inside the screen':'OFF SCREEN', '· action ran:', bar);
    if(!z.big||z.w<a.w*1.24||!inside||bar) errs.push(`${nm} ${id}: first tap`);
    if(id==='sAltBox') await p.screenshot({path:`play/tilezoom_${nm.replace(/ /g,'_')}.png`});
    await p.mouse.click(z.vw/2,z.vh*0.6); await p.waitForTimeout(150); if((await box(id)).big) errs.push(`${nm} ${id}: tap elsewhere did not shrink it`); }
  // second tap while big: the tile's own action
  await p.click('#sFuel',{position:{x:8,y:8}}); await p.waitForTimeout(200); const f1=await p.evaluate(()=>[$('sFuel').hasAttribute('data-zb'),$('fuDlg').open]);
  if(f1[0]){ await p.click('#sFuel',{position:{x:8,y:8}}); await p.waitForTimeout(200); }
  const f2=await p.evaluate(()=>$('fuDlg').open); console.log(nm.padEnd(18), 'FUEL row: first tap', f1[0]?'big':'(too wide to grow: acts at once)', '· timer open after', f1[0]?'second tap':'first tap', f2); if(!f2) errs.push(nm+': fuel timer did not open'); await p.evaluate(()=>$('fuDlg').close());
  if(fs&&nm!=='tablet'){ await p.click('#sAltBox',{position:{x:8,y:8}}); await p.waitForTimeout(200); await p.click('#sAltBox',{position:{x:8,y:8}}); await p.waitForTimeout(300);
    const bar=await p.evaluate(()=>!!FS.bar); console.log(nm.padEnd(18), 'second tap on ALT opens the top bar:', bar); if(!bar) errs.push(nm+': second tap did not open the bar'); await p.evaluate(()=>{ FS.bar=false; fsApply(); }); }
  // no timeout: still big 6 s later (renders in between), then a tap elsewhere
  await p.click('#sGsBox',{position:{x:8,y:8}}); await p.waitForTimeout(300); const g1=(await box('sGsBox')).big; await p.waitForTimeout(6000); const g2=(await box('sGsBox')).big;
  await p.mouse.click(5,(await box('sGsBox')).vh-5); await p.waitForTimeout(150); const g3=(await box('sGsBox')).big;
  console.log(nm.padEnd(18), 'big', g1, '-> after 6 s', g2, '-> tap elsewhere', g3); if(!g1||!g2||g3) errs.push(nm+': stays big till a tap elsewhere');
  // off: a tap acts at once
  await p.evaluate(()=>{ $('optTileZoom').click(); }); await p.click('#sFuel',{position:{x:8,y:8}}); await p.waitForTimeout(200);
  console.log(nm.padEnd(18), 'option off: saved', await p.evaluate(()=>ls.get('tileZoom')), '· one tap opens the fuel timer', await p.evaluate(()=>$('fuDlg').open&&!$('sFuel').hasAttribute('data-zb')));
  await ctx.close(); }
 console.log(errs); await b.close(); })();
