// Default Bell 206B3 checklists (18 Nov 2026). node play/cldefault.js  (app on :8811)
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(), errs=[], fail=[]; const ok=(c,m)=>{ console.log((c?'ok   ':'FAIL ')+m); if(!c) fail.push(m); };
  const open=async(ls)=>{ const ctx=await b.newContext({...PX9,storageState:{cookies:[],origins:[{origin:'http://localhost:8811',localStorage:[{name:'rc_fsMap',value:'false'},...(ls||[])]}]}}); const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
    await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=100&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'); return {ctx,p}; };
  // a fresh install
  let {ctx,p}=await open(); let r=await p.evaluate(()=>CL.map(c=>({id:c.id,n:c.name,k:clItems(c).filter(x=>x.h==null).length,h:clItems(c).filter(x=>x.h!=null).length,ph:c.ph||''})));
  ok(r.length===4&&r.map(x=>x.n).join('|')==='Bell 206B3 Pre start|Bell 206B3 Start|Bell 206B3 Pre lift off checks|Bell 206B3 Shutdown','fresh install: '+r.map(x=>`${x.n} (${x.k} items, ${x.h} headings${x.ph?', '+x.ph:''})`).join('; '));
  ok(r[0].k===24&&r[1].k===24&&r[2].k===10&&r[3].k===18&&r[3].ph==='land','item counts 24 / 24 (incl. Hydraulics On) / 10 / 18, Shutdown offered after landing');
  const it=await p.evaluate(()=>{ const c=CL.find(x=>x.id==='b206b3-prestart'), I=clItems(c); return [I[3],I[21]]; });
  ok(it[0].c==='4. Flight Controls'&&it[0].r==='Pedals Adjusted; Frictions Off; All Controls Full and Free; Frictions On','item 4: '+JSON.stringify(it[0]));
  await p.click('#fpCl'); await p.click('#clBody li[data-id="b206b3-start"] [data-a="run"]'); await p.waitForTimeout(200);
  await p.locator('#clDlg').screenshot({path:__dirname+'/cldefault_start.png'});
  ok(await p.evaluate(()=>/WARNING - If TOT is likely/.test($('clBody').textContent)&&document.querySelectorAll('#clBody li.i').length===24),'Start opens: 24 items with the TOT warning as a heading');
  await p.click('#clBody [data-a="back"]'); await p.click('#clBody li[data-id="b206b3-prelift"] [data-a="ed"]'); await p.click('#clBody [data-a="del"]'); await p.click('#clClose');
  await p.reload(); await p.waitForFunction(()=>typeof render==='function');
  ok(await p.evaluate(()=>CL.length===3&&!CL.some(c=>c.id==='b206b3-prelift')),'deleted Pre lift off stays deleted after a reload'); await ctx.close();
  // an existing install with its own checklist: the defaults are added once, after it
  ({ctx,p}=await open([{name:'rc_cl',value:JSON.stringify([{id:'mine',name:'My list',ac:'',items:['A .... B'],t:5}])}]));
  r=await p.evaluate(()=>CL.map(c=>c.id)); ok(r[0]==='mine'&&r.length===5,'existing install: own list first, then the 4 defaults: '+r.join(','));
  await p.reload(); await p.waitForFunction(()=>typeof render==='function'); ok((await p.evaluate(()=>CL.length))===5,'not added twice'); await ctx.close();
  console.log(fail.length? fail.length+' FAILED':'all passed'); console.log(errs); await b.close(); process.exit(fail.length?1:0); })();
