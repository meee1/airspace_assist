// The Measure box is fully on screen and not under the tile column, in every layout: tablet full-screen map (it was at
// the left, under the 300 px tile column), tablet classic, phone on its side with and without the full-screen map (classic:
// the map runs past the bottom of the screen, so the box is lifted into the visible part, also after scrolling), phone portrait.
const {chromium}=require('playwright'); const {PX9,TAB}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const errs=[]; const land={...PX9,viewport:{width:PX9.viewport.height,height:PX9.viewport.width}};
 const cases=[['tab-fs',TAB,true],['tab-classic',TAB,false],['phone-land-fs',land,true],['phone-land',land,false],['phone-portrait-fs',PX9,true],['phone-portrait',PX9,false]];
 for(const [nm,prof,fs] of cases){ const ctx=await b.newContext({...prof}); await ctx.addInitScript(fs=>{ try{ localStorage.setItem('rc_fsMap',JSON.stringify(fs)); }catch(e){} },fs);
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=090&gs=0'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(900);
  const r=await p.evaluate(()=>{ measSet(true); measAdd({la:-37.98,lo:145.1,n:'A'}); measAdd({la:-38.1,lo:145.3,n:'B'});
    const el=$('measBox'), q=el.getBoundingClientRect(), pts=[[q.left+5,q.top+5],[q.right-5,q.top+5],[q.left+5,q.bottom-5],[q.right-5,q.bottom-5]].map(([x,y])=>{ const t=x>=0&&y>=0&&x<innerWidth&&y<innerHeight? document.elementFromPoint(x,y):null; return t? (t.closest('#measBox')?'ok':(t.closest('[id]')||t).id||t.tagName) : 'OFF'; });
    return {vw:innerWidth, vh:innerHeight, scrollY:Math.round(scrollY), box:[q.left,q.top,q.right,q.bottom].map(Math.round), corners:pts, body:document.body.className}; });
  console.log(nm.padEnd(18), JSON.stringify(r)); if(r.corners.some(c=>c!=='ok')) errs.push(nm+': '+r.corners);
  if(!fs){ await p.evaluate(()=>scrollBy(0,120)); await p.waitForTimeout(200); const s=await p.evaluate(()=>{ const q=$('measBox').getBoundingClientRect(), m=$('measBox').parentElement.getBoundingClientRect(); return {top:Math.round(q.top),bottom:Math.round(q.bottom),vh:innerHeight,inMap:q.top>=m.top-1&&q.bottom<=m.bottom+1}; });
    console.log(''.padEnd(18), 'scrolled 120 px:', JSON.stringify(s)); if(s.bottom>s.vh||s.top<0&&s.inMap===false||!s.inMap) errs.push(nm+' scrolled: '+JSON.stringify(s)); } await ctx.close(); }
 console.log(errs); await b.close(); })();
