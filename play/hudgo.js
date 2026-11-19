// Phone full screen: the → CTAF / → AREA tiles over the map when there's a Go to or plan (19 Nov 2026). node play/hudgo.js (app on :8811)
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(), errs=[], fail=[]; const ok=(c,m)=>{ console.log((c?'ok   ':'FAIL ')+m); if(!c) fail.push(m); };
  for(const [n,vp] of [['pixel',null],['n360',{width:360,height:780}]]){
    const ctx=await b.newContext({...PX9,...(vp?{viewport:vp,screen:vp}:{}),storageState:{cookies:[],origins:[{origin:'http://localhost:8811',localStorage:[{name:'rc_fsMap',value:'true'}]}]}});
    await ctx.addInitScript(()=>{ const D=Date, off=D.parse('2026-11-01T01:30:00Z')-D.now(); window.Date=class extends D{ constructor(...a){ super(...(a.length?a:[D.now()+off])); } static now(){ return D.now()+off; } }; });
    const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
    await p.goto('http://localhost:8811/index.html?sim=-38.20,145.15&alt=1500&trk=330&gs=90'); await p.waitForFunction(()=>typeof render==='function'&&st.pos); await p.waitForTimeout(600);
    const vis=id=>p.evaluate(id=>{ const e=$(id), r=e.getBoundingClientRect(); return {par:e.parentElement.id, shown:!e.hidden&&getComputedStyle(e).display!=='none'&&r.height>0, top:Math.round(r.top), bot:Math.round(r.bottom), txt:e.textContent.replace(/\s+/g,' ').trim().slice(0,70)}; },id);
    let g=await vis('gCtafBox'); ok(g.par==='hudL'&&!g.shown,`${n}: no Go to: → tiles in the HUD column, hidden`);
    await p.evaluate(()=>{ const a=DATA.ap.find(x=>x.i==='YMMB'); setGo({k:'AD',c:a.i,n:a.n,la:a.la,lo:a.lo}); render(); }); await p.waitForTimeout(300);
    g=await vis('gCtafBox'); const a=await vis('gAreaBox'), sheet=await p.evaluate(()=>Math.round($('fsSheet').getBoundingClientRect().top));
    ok(g.shown&&(a.shown||await p.evaluate(()=>$('gCtaf').textContent===$('gArea').textContent))&&/TWR W ?123\.0 ?YMMB/.test(g.txt)&&/GO TO/.test(g.txt),`${n}: Go to YMMB: → TWR shown over the map: ${g.txt}`);
    ok((a.shown?a.bot:g.bot)<sheet&&await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${n}: → AREA ends above the sheet (${a.bot} < ${sheet}), no sideways scroll`);
    await p.screenshot({path:__dirname+`/hudgo_${n}.png`});
    // the whole top bar: the → tiles are back in it with their full lines
    await p.click('#sAreaBox'); await p.click('#sAreaBox'); await p.waitForTimeout(300);
    const bar=await p.evaluate(()=>({bar:document.body.classList.contains('fsm-bar'), par:$('gCtafBox').parentElement.className, nx:getComputedStyle($('gCtafNx')).display}));
    ok(bar.bar&&/status/.test(bar.par)&&bar.nx!=='none',`${n}: whole top bar: → tiles with their full lines`);
    await ctx.close(); }
  console.log(fail.length? fail.length+' FAILED':'all passed'); console.log(errs); await b.close(); process.exit(fail.length?1:0); })();
