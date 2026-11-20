// The map menu (press and hold / right click) above the floating tiles in full screen (21 Nov 2026, Michael: "The right
// click menu shows under the tiles, this means I can't close the menu"). Phone, narrow phone and tablet full screen, and
// the classic page: every button in the menu is the top element at its middle; ✕ closes it. node play/mmtop.js  (app on :8811)
const {chromium}=require('playwright'); const {PX9,TAB}=require('./px9.js');
(async()=>{ const b=await chromium.launch(), errs=[], fail=[]; const ok=(c,m)=>{ console.log((c?'ok   ':'FAIL ')+m); if(!c) fail.push(m); };
  for(const [n,prof,fs] of [['phone',PX9,true],['360',{...PX9,viewport:{width:360,height:740},screen:{width:360,height:740}},true],['tablet',TAB,true],['classic',PX9,false]]){
    const ctx=await b.newContext({...prof,storageState:{cookies:[],origins:[{origin:'http://localhost:8811',localStorage:[{name:'rc_fsMap',value:String(fs)}]}]}});
    const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(n+': '+e.message));
    await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'&&st.pos); await p.waitForTimeout(500);
    // right click on the map, upper part (under where the tiles float)
    const at=await p.evaluate(()=>{ const r=$('map').getBoundingClientRect(); return [r.left+r.width*0.5, r.top+Math.min(r.height*0.35,260)]; });
    if(!fs) await p.evaluate(()=>$('map').scrollIntoView({block:'center'}));
    await p.mouse.click(at[0],at[1]+(fs?0:0),{button:'right'}); await p.waitForTimeout(500);
    const r=await p.evaluate(()=>{ const m=$('mapMenu'); if(m.hidden) return {open:false};
      const bad=[...m.querySelectorAll('button')].filter(x=>x.offsetParent).filter(x=>{ const q=x.getBoundingClientRect(), M=m.getBoundingClientRect(), cy=q.top+q.height/2; if(q.bottom<0||q.top>innerHeight||cy<M.top||cy>M.bottom) return false; /* scrolled out of the menu's own box */ const e=document.elementFromPoint(q.left+q.width/2,q.top+q.height/2); return !(e&&(e===x||x.contains(e))); }).map(x=>x.textContent.trim().slice(0,30));
      const q=m.getBoundingClientRect(); return {open:true, bad, top:Math.round(q.top), bot:Math.round(q.bottom), ih:innerHeight}; });
    ok(r.open&&!r.bad.length,`${n}: menu open (${r.top}–${r.bot} of ${r.ih}), every visible button on top${r.bad&&r.bad.length?' — covered: '+r.bad.join(' | '):''}`);
    await p.screenshot({path:__dirname+`/mmtop_${n}.png`});
    await p.click('#mmClose'); await p.waitForTimeout(200); ok(await p.evaluate(()=>$('mapMenu').hidden),`${n}: ✕ closes it`);
    await ctx.close(); }
  console.log(fail.length? fail.length+' FAILED':'all passed'); console.log(errs); await b.close(); process.exit(fail.length?1:0); })();
