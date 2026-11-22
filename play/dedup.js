// Tiles shown once (19 Nov 2026, Michael: "Dedup the tiles"): GS only on the GS tile (with the head/tail wind), and a heading
// tape (A or D) takes the place of the HDG and →HDG tiles. node play/dedup.js  (app on :8811)
const {chromium}=require('playwright'); const {PX9,TAB}=require('./px9.js');
(async()=>{ const b=await chromium.launch(), errs=[], fail=[]; const ok=(c,m)=>{ console.log((c?'ok   ':'FAIL ')+m); if(!c) fail.push(m); };
  const vis=(p,id)=>p.evaluate(id=>{ const e=$(id); return !!e&&!e.hidden&&getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().height>0; },id);
  for(const [n,prof,fs] of [['phone classic',PX9,false],['phone full screen',PX9,true],['tablet',TAB,true]]){
    const ctx=await b.newContext({...prof,storageState:{cookies:[],origins:[{origin:'http://localhost:8811',localStorage:[{name:'rc_fsMap',value:String(fs)}]}]}});
    // the → TWR / → ATC checks need Moorabbin Tower open: the clock is pinned to local midday (0130Z), so the test doesn't fail at night
    await ctx.addInitScript(()=>{ const D=Date, off=D.parse('2026-11-01T01:30:00Z')-D.now(); window.Date=class extends D{ constructor(...a){ super(...(a.length?a:[D.now()+off])); } static now(){ return D.now()+off; } }; });
    const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
    await p.goto('http://localhost:8811/index.html?sim=-38.16,144.98&alt=1500&trk=040&gs=95'); await p.waitForFunction(()=>typeof render==='function'&&st.pos);
    await p.evaluate(()=>{ const a=DATA.ap.find(x=>x.i==='YMMB'); setGo({k:'AD',c:a.i,n:a.n,la:a.la,lo:a.lo}); ls.set('pcWsrc','set'); ls.set('pcWind',{dir:300,kt:18}); ls.set('pcGs',95); render(); }); await p.waitForTimeout(500);
    const gsTiles=await p.evaluate(()=>[...document.querySelectorAll('.st small')].filter(e=>/^GS kt$/i.test(e.textContent.trim())&&e.getBoundingClientRect().height>0&&!e.closest('.tpv')).length);
    ok(gsTiles===1&&/^(HW|TW) \d+$/.test(await p.evaluate(()=>$('sGsW').textContent)),`${n}: one GS tile, with the wind along your track (${await p.evaluate(()=>$('sGsW').textContent)})`);
    ok(await vis(p,'sTapeA')&&!(await vis(p,'nHdg'))&&!(await vis(p,'nTo'))&&await vis(p,'nTot'),`${n}: tape A (default) instead of HDG / →HDG; TOT stays`);
    // the same frequency once: CTAF tile = area frequency (no aerodrome within 10 NM) -> no AREA tile; → TWR = → ATC -> one → tile
    const fq=await p.evaluate(()=>({far:st.ctafFar, ctaf:$('sCtaf').textContent, area:$('sArea').textContent, areaShown:getComputedStyle($('sAreaBox')).display!=='none', nx:$('sCtafNx').textContent,
      g:$('gCtaf').textContent, ga:$('gArea').textContent, gaShown:!$('gAreaBox').hidden}));
    ok(!(fq.far&&fq.ctaf===fq.area)||(!fq.areaShown&&/ATC 123\.35|next 123\.35/.test(fq.nx)),`${n}: CTAF ${fq.ctaf} = AREA ${fq.area}: one tile, both "next" lines (${fq.nx})`);
    ok(fq.g===fq.ga&&!fq.gaShown,`${n}: → TWR ${fq.g} = → ATC ${fq.ga}: one → tile`);
    // TRK hidden with a tape (the tape's box is your track); the GPS wind moves to the tape's line
    ok(!(await vis(p,'sHdgBox')),`${n}: tape A: no TRK tile`);
    const wl=await p.evaluate(()=>{ WIND.est={from:270,spd:20,tas:95,rms:1,t:Date.now(),la:st.pos[0],lo:st.pos[1]}; windUI(); render(); return $('sGsW').textContent; });
    ok(/^(HW|TW) \d+ · \d{3}\/20$/.test(wl)&&await vis(p,'sGsBox'),`${n}: GPS wind on the GS tile: ${wl}`);
    if(n==='phone classic'){ const g=await p.evaluate(()=>{ const sb=document.querySelector('.wrap>.status').getBoundingClientRect(), t=[...document.querySelectorAll('.wrap>.status>.st')].filter(e=>e.getBoundingClientRect().height>0&&Math.abs(e.getBoundingClientRect().top-$('gpsTile').getBoundingClientRect().top)<3);
        return {right:Math.max(...t.map(e=>e.getBoundingClientRect().right)), sb:sb.right}; }); ok(g.sb-g.right<12,`${n}: top row fills the width without TRK (${Math.round(g.right)} of ${Math.round(g.sb)})`); }
    await p.evaluate(()=>{ $('optHdgMode').value='D'; $('optHdgMode').dispatchEvent(new Event('change')); }); await p.waitForTimeout(200);
    ok(!(await vis(p,'sHdgBox')),`${n}: tape D: no TRK tile`);
    await p.evaluate(()=>{ $('optHdgMode').value='C'; $('optHdgMode').dispatchEvent(new Event('change')); }); await p.waitForTimeout(200);
    ok(await vis(p,'nHdg')&&await vis(p,'nTo')&&await vis(p,'sHdgBox'),`${n}: arc only (C): HDG / →HDG and TRK tiles back`);
    await p.evaluate(()=>{ $('optHdgMode').value='A'; $('optHdgMode').dispatchEvent(new Event('change')); }); await p.waitForTimeout(200);
    await p.screenshot({path:__dirname+`/dedup_${n.replace(/ /g,'_')}.png`}); await ctx.close(); }
  console.log(fail.length? fail.length+' FAILED':'all passed'); console.log(errs); await b.close(); process.exit(fail.length?1:0); })();
