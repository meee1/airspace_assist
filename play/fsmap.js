// full-screen map: phone HUD (C), tablet column (D), sheet tabs/drag, classic toggle
const {chromium}=require('playwright'); const {PX9}=require('./px9.js'); require('fs').mkdirSync(__dirname+'/fs',{recursive:true});   // its screenshots go in play/fs/
(async()=>{ const b=await chromium.launch();
 const FSON={cookies:[],origins:[{origin:'http://localhost:8811',localStorage:[{name:'rc_fsMap',value:'true'}]}]};
 const devs=[['phone',{...PX9,storageState:FSON}],['tablet',{viewport:{width:1280,height:800},deviceScaleFactor:1.5,isMobile:true,hasTouch:true}],['n360',{viewport:{width:360,height:780},deviceScaleFactor:3,isMobile:true,hasTouch:true}]];
 for(const [dn,dv] of devs){
  const ctx=await b.newContext(dv); await ctx.addInitScript(()=>{ const D=Date, off=D.parse('2026-11-01T01:30:00Z')-D.now(); window.Date=class extends D{ constructor(...a){ super(...(a.length?a:[D.now()+off])); } static now(){ return D.now()+off; } }; });
  const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message+' '+(e.stack||'').split('\n')[1]));
  await p.goto('http://localhost:8811/index.html?sim=-37.93,145.20&alt=1500&trk=250&gs=90'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(1500);
  await p.evaluate(()=>{ const a=DATA.ap.find(x=>x.i==='YMMB'); setGo({k:'AD',c:'YMMB',n:a.n,la:a.la,lo:a.lo}); render(); }); await p.waitForTimeout(800);
  const info=()=>p.evaluate(()=>JSON.stringify({cls:document.body.className,map:(r=>[r.left,r.top,r.width,r.height].map(Math.round))($('map').getBoundingClientRect()),sheet:Math.round($('fsSheet').getBoundingClientRect().height),hudL:$('hudL').children.length,hudR:$('hudR').children.length,hudA:$('hudA').children.length,scrollY:window.scrollY,docH:document.documentElement.scrollHeight}));
  console.log(dn,'fs', await info()); await p.screenshot({path:`play/fs/${dn}_fs.png`});
  if(dn!=='tablet'){ await p.click('#hudL'); await p.waitForTimeout(200); await p.click('#hudL'); await p.waitForTimeout(300);   /* first tap enlarges the tile, the second opens the bar */ console.log(dn,'bar', await info()); await p.screenshot({path:`play/fs/${dn}_bar.png`}); await p.click('#fsBarX'); await p.waitForTimeout(300); }
  await p.click('#fsTabs [data-fs="calls"]'); await p.waitForTimeout(700); console.log(dn,'calls tab', await info(), await p.evaluate(()=>$('calls').open+' '+Math.round($('calls').getBoundingClientRect().top))); await p.screenshot({path:`play/fs/${dn}_calls.png`});
  // drag the sheet up to full
  const hb=await p.$('#fsHead'); const bb=await hb.boundingBox(); await p.mouse.move(bb.x+bb.width/2,bb.y+5); await p.mouse.down(); await p.mouse.move(bb.x+bb.width/2,60,{steps:8}); await p.mouse.up(); await p.waitForTimeout(400);
  console.log(dn,'drag', await p.evaluate(()=>FS.s+' '+Math.round($('fsSheet').getBoundingClientRect().height)));
  await p.click('#fsTabs [data-fs="fsLayers"]'); await p.waitForTimeout(500); await p.click('#mapLog'); console.log(dn,'layer btn works', await p.evaluate(()=>$('mapLog').getAttribute('aria-pressed')));
  await p.click('#fsTabs [data-fs="fsLayers"]'); await p.waitForTimeout(400); console.log(dn,'tap again ->', await p.evaluate(()=>FS.s));
  // map menu
  await p.evaluate(()=>{ const r=$('map').getBoundingClientRect(); mapMenu(r.width/2,r.height/2); }); await p.waitForTimeout(300); await p.screenshot({path:`play/fs/${dn}_menu.png`}); await p.evaluate(()=>mapMenuClose());
  // exit to classic and back
  await p.click('#fsBtn'); await p.waitForTimeout(500); console.log(dn,'classic', await info(), await p.evaluate(()=>[...document.querySelector('.wrap').children].map(e=>e.id||e.className).join(',').slice(0,200)));
  console.log(dn,'classic layer parent', await p.evaluate(()=>$('mapCtaf').parentElement.className+' '+$('mapLeg').parentElement.className+' '+$('adCard').parentElement.className)); await p.screenshot({path:`play/fs/${dn}_classic.png`,fullPage:true});
  await p.click('#fsBtn'); await p.waitForTimeout(500); console.log(dn,'fs again', await info());
  console.log(dn,'errors',errs); await ctx.close(); }
 await b.close(); })();
