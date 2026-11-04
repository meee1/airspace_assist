// one-line aerodrome header: shrinks once the card scrolls well up, no flicker while scrolling, back to full at the top; tap = back up
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch();
 const cases=[['phone classic',{...PX9},false,null],['phone full screen',{...PX9},true,null],['tablet full screen',{viewport:{width:1280,height:740},deviceScaleFactor:1.5,isMobile:true,hasTouch:true},true,[1280,800]]];
 for(const [n,dv,fs,scr] of cases){ const ctx=await b.newContext(dv); await ctx.addInitScript(([fs,scr])=>{ if(scr){ Object.defineProperty(screen,'width',{get:()=>scr[0]}); Object.defineProperty(screen,'height',{get:()=>scr[1]}); } try{ localStorage.setItem('rc_fsMap',fs?'true':'false'); }catch(e){} },[fs,scr]);
  const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8811/index.html?sim=-37.95,145.13&alt=1500&trk=200&gs=90'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(1500);
  await p.evaluate(()=>{ $('calls').open=true; render(); const card=$('adCard'); if(document.body.classList.contains('fsm')&&typeof fsShow==='function') fsShow(card); });
  await p.waitForTimeout(500);
  const step=(dy)=>p.evaluate(dy=>{ const fsb=document.body.classList.contains('fsm')&&$('fsBody').contains($('adCard'))? $('fsBody') : null; if(fsb) fsb.scrollTop+=dy; else window.scrollBy(0,dy); },dy);
  const state=()=>p.evaluate(()=>{ const h=document.querySelector('.ad-head'); return [h.classList.contains('cx'), Math.round(h.getBoundingClientRect().height)]; });
  // to the card top first
  await p.evaluate(()=>{ const card=$('adCard'), fsb=document.body.classList.contains('fsm')&&$('fsBody').contains(card)? $('fsBody'):null; if(fsb) fsb.scrollTop=card.offsetTop-10; else window.scrollTo(0,card.getBoundingClientRect().top+scrollY-200); });
  await p.waitForTimeout(200);
  let flips=0, prev=(await state())[0], seq=''; for(let i=0;i<40;i++){ await step(15); await p.waitForTimeout(40); const [c]=await state(); if(c!==prev){ flips++; prev=c; } seq+=c?'▬':'█'; }
  const down=await state(); let flipsUp=0; for(let i=0;i<40;i++){ await step(-15); await p.waitForTimeout(40); const [c]=await state(); if(c!==prev){ flipsUp++; prev=c; } seq+=c?'▬':'█'; }
  const up=await state();
  // tap the slim header
  for(let i=0;i<20;i++) await step(30); await p.waitForTimeout(150); const s1=await state(); await p.click('.ad-head .ad-name'); await p.waitForTimeout(900); const s2=await state();
  console.log(n.padEnd(19), `down: ${flips} switch(es), slim ${down[1]} px · up: ${flipsUp} switch(es), full ${up[1]} px · tap: ${s1[0]?'slim':'full'}→${s2[0]?'slim':'full'} ${s2[1]} px`, errs);
  console.log('   ', seq);
  await ctx.close(); }
 await b.close(); })();
