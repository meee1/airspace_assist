// Options → Top bar tiles: a Phone and a Tablet tick per tile (19 Nov 2026). node play/tiles2.js  (app on :8811)
const {chromium}=require('playwright'); const {PX9,TAB}=require('./px9.js');
(async()=>{ const b=await chromium.launch(), errs=[], fail=[]; const ok=(c,m)=>{ console.log((c?'ok   ':'FAIL ')+m); if(!c) fail.push(m); };
  const open=async(prof,ls)=>{ const ctx=await b.newContext({...prof,storageState:{cookies:[],origins:[{origin:'http://localhost:8811',localStorage:[{name:'rc_fsMap',value:'true'},...ls]}]}}); const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
    await p.goto('http://localhost:8811/index.html?sim=-37.95,145.0&alt=1500&trk=000&gs=90'); await p.waitForFunction(()=>typeof render==='function'&&st.pos); await p.waitForTimeout(500); return {ctx,p}; };
  const shown=(p,id)=>p.evaluate(id=>getComputedStyle($(id)).display!=='none',id);
  // an existing phone choice (CLASS off) is the tablet's starting point too
  let {ctx,p}=await open(PX9,[{name:'rc_tilesOff',value:'["cls"]'}]);
  await p.evaluate(()=>$('bOpts').click()); await p.waitForTimeout(300);
  let r=await p.evaluate(()=>({rows:document.querySelectorAll('#optsTiles .tl-row:not(.tl-head)').length, n:TILES.length, ph:$('optsTiles').querySelector('[data-tile="cls"][data-m="phone"]').checked, tb:$('optsTiles').querySelector('[data-tile="cls"][data-m="tab"]').checked, now:document.querySelector('#optsTiles .tl-h.now').textContent}));
  ok(r.rows===r.n&&!r.ph&&!r.tb&&r.now==='Phone','a row per tile with two ticks; old phone setting copied to the tablet; phone column marked as in use');
  await p.locator('#optsTiles').screenshot({path:__dirname+'/tiles2_opts.png'});
  // phone: untick GS for the tablet only -> still on the phone
  await p.click('#optsTiles [data-tile="gs"][data-m="tab"]'); await p.click('#optsTiles [data-tile="cls"][data-m="tab"]');
  r=await p.evaluate(()=>({ph:ls.get('tilesOff'), tb:ls.get('tilesOffTab')}));
  ok(JSON.stringify(r.ph)==='["cls"]'&&r.tb.includes('gs')&&!r.tb.includes('cls'),'saved separately: phone '+JSON.stringify(r.ph)+', tablet '+JSON.stringify(r.tb));
  await p.evaluate(()=>$('optsClose').click()); ok(await shown(p,'sGsBox')&&!(await shown(p,'sClsBox')),'phone: GS shown, CLASS hidden (phone ticks)');
  const keep=await p.evaluate(()=>({a:ls.get('tilesOff'),b:ls.get('tilesOffTab')})); await ctx.close();
  // tablet with the same settings: GS hidden, CLASS shown
  ({ctx,p}=await open(TAB,[{name:'rc_tilesOff',value:JSON.stringify(keep.a)},{name:'rc_tilesOffTab',value:JSON.stringify(keep.b)}]));
  ok(!(await shown(p,'sGsBox'))&&await shown(p,'sClsBox'),'tablet: GS hidden, CLASS shown (tablet ticks)');
  await p.evaluate(()=>$('bOpts').click()); await p.waitForTimeout(200); ok(await p.evaluate(()=>document.querySelector('#optsTiles .tl-h.now').textContent==='Tablet'),'tablet: the Tablet column is marked as in use');
  await ctx.close();
  console.log(fail.length? fail.length+' FAILED':'all passed'); console.log(errs); await b.close(); process.exit(fail.length?1:0); })();
