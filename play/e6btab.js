// Flight computer on the tablet (TAB profile) and on a 360 px phone: screenshots, no sideways scroll. node play/e6btab.js (app on :8811)
const {chromium}=require('playwright'); const {PX9,TAB}=require('./px9.js');
(async()=>{ const b=await chromium.launch(), errs=[], fail=[]; const ok=(c,m)=>{ console.log((c?'ok   ':'FAIL ')+m); if(!c) fail.push(m); };
  for(const [n,prof] of [['tab',TAB],['360',{...PX9,viewport:{width:360,height:740},screen:{width:360,height:740}}]]){
    const ctx=await b.newContext({...prof,storageState:{cookies:[],origins:[{origin:'http://localhost:8811',localStorage:[{name:'rc_fsMap',value:'true'}]}]}}); const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
    await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'&&st.pos);
    await p.evaluate(()=>{ $('bE6b').click(); E6.comp.setIndex(90); }); await p.waitForTimeout(300);
    for(const t of ['comp','wind','prob']){ await p.evaluate(t=>e6Tab(t),t); await p.waitForTimeout(200);
      const r=await p.evaluate(()=>{ const d=$('e6bDlg'), q=d.getBoundingClientRect(); return {w:Math.round(q.width), sw:d.scrollWidth<=d.clientWidth+1, inView:q.left>=0&&q.right<=innerWidth}; });
      ok(r.sw&&r.inView,`${n} ${t}: dialog ${r.w} px wide, fits`); await p.screenshot({path:__dirname+`/e6b_${n}_${t}.png`}); }
    await ctx.close(); }
  console.log(fail.length? fail.length+' FAILED':'all passed'); console.log(errs); await b.close(); process.exit(fail.length?1:0); })();
