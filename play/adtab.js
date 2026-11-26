// Aerodrome tab on the tablet's full-screen map: the header (code, name) stays visible as the card scrolls (26 Nov 2026, Michael's
// screenshot at ~1204x927: the Aerodrome tab showed the card from the runway diagram down, no code or name; .ad-head's sticky top
// was the landscape rule's --stickH = the whole tile column). node play/adtab.js (app on :8811)
const {chromium}=require('playwright'); const {TAB,PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(), errs=[], fail=[]; const ok=(c,m)=>{ console.log((c?'ok   ':'FAIL ')+m); if(!c) fail.push(m); };
  for(const [nm,prof] of [['tablet 1204x927',{...TAB,viewport:{width:1204,height:927},screen:{width:1204,height:927}}],['tablet (Lenovo)',TAB],['phone',PX9]]){
    const ctx=await b.newContext({...prof,storageState:{cookies:[],origins:[{origin:'http://localhost:8811',localStorage:[{name:'rc_fsMap',value:'true'}]}]}}); const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
    await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'&&st.pos); await p.waitForTimeout(500);
    await p.evaluate(()=>{ st.pin='YOLA'; render(); [...document.querySelectorAll('#fsTabs button,[data-t]')].find(x=>/Aerodrome/.test(x.textContent)).click(); }); await p.waitForTimeout(600);
    // the tile column's height, as on the owner's tablet (headless measures it short): the landscape rule put the header that far down
    await p.evaluate(()=>{ const ro=document.documentElement.style; ro.setProperty('--stickH','700px'); new MutationObserver(()=>{ if(ro.getPropertyValue('--stickH')!=='700px') ro.setProperty('--stickH','700px'); }).observe(document.documentElement,{attributes:true,attributeFilter:['style']}); });
    const ch=await p.evaluate(()=>$('adCard').offsetHeight), seen=[];
    for(const dy of [0,150,400,Math.max(450,ch-300)]){ await p.evaluate(dy=>{ const b=$('fsBody'); const c=$('adCard'); b.scrollTop=c.offsetTop-b.offsetTop+dy; },dy); await p.waitForTimeout(400);
      seen.push(await p.evaluate(()=>{ const id=$('adId'), r=id.getBoundingClientRect(), B=$('fsBody').getBoundingClientRect(), e=document.elementFromPoint(r.left+5,r.top+r.height/2);
        return {top:Math.round(r.top-B.top), vis:r.bottom>B.top&&r.top<B.bottom&&!!e&&(e.id==='adId'||id.contains(e)), name:$('adName').textContent}; })); }
    ok(seen.every(s=>s.vis&&s.top>=-2&&s.top<120),`${nm}: YOLA ${seen[0].name} header visible at the top of the sheet as the card scrolls (offsets ${seen.map(s=>s.top).join(', ')} px)`);
    if(nm.startsWith('tablet 1204')) await p.screenshot({path:__dirname+'/adtab.png'});
    await ctx.close(); }
  console.log(fail.length? fail.length+' FAILED':'all passed'); console.log(errs); await b.close(); process.exit(fail.length?1:0); })();
