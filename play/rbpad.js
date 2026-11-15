// Read-back pad (16 Nov 2026): finger writing in the ATIS / clearance dialog, shown on the CLEARANCE row, cleared after
// leaving controlled airspace. node play/rbpad.js   (app served on :8811)
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(), errs=[], fail=[]; const ok=(c,m)=>{ console.log((c?'ok   ':'FAIL ')+m); if(!c) fail.push(m); };
  const ctx=await b.newContext(PX9), p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8811/index.html?sim=-37.97,144.93&alt=1000&trk=090&gs=90'); await p.waitForFunction(()=>typeof render==='function'&&st.pos); await p.waitForTimeout(500);
  await p.click('#bPad'); await p.waitForTimeout(200);
  const r0=await p.evaluate(()=>{ const r=$('clrPad').getBoundingClientRect(); return {open:$('clrDlg').open,x:r.left,y:r.top,w:r.width,h:r.height,cw:$('clrPad').width}; });
  ok(r0.open&&r0.w>300&&r0.h>200&&r0.cw>0,'pad open and sized '+Math.round(r0.w)+'x'+Math.round(r0.h));
  // write "3000" roughly: a few strokes
  const stroke=async pts=>{ await p.mouse.move(r0.x+pts[0][0],r0.y+pts[0][1]); await p.mouse.down(); for(const q of pts.slice(1)) await p.mouse.move(r0.x+q[0],r0.y+q[1],{steps:4}); await p.mouse.up(); };
  await stroke([[30,40],[60,30],[70,55],[45,70],[75,85],[50,110],[25,100]]);
  for(const x of [100,160,220]) await stroke([[x+20,30],[x,60],[x+10,105],[x+35,100],[x+40,60],[x+20,30]]);
  let r=await p.evaluate(()=>({n:CLR.ink.length, pts:CLR.ink[0].length, row:!$('sClr').hidden, img:!!$('sClr').querySelector('img.ink'), undo:$('clrUndo').disabled}));
  ok(r.n===4&&r.pts>10,'4 strokes kept ('+r.pts/2+' points in the first)');
  ok(r.row&&r.img&&!r.undo,'CLEARANCE row shows the pad');
  await p.fill('#clrSq','4123');
  await p.screenshot({path:__dirname+'/rbpad_dlg.png'});
  await p.click('#clrUndo'); ok(await p.evaluate(()=>CLR.ink.length===3),'Undo removes the last stroke');
  await p.click('#clrOk'); await p.screenshot({path:__dirname+'/rbpad_row.png'});
  await p.reload(); await p.waitForFunction(()=>typeof render==='function'&&st.pos); await p.waitForTimeout(400);
  ok(await p.evaluate(()=>CLR.ink&&CLR.ink.length===3&&!!$('sClr').querySelector('img.ink')),'kept after reload');
  // pad redraws at another size (strokes are fractions of the width)
  await p.click('#sClr'); await p.waitForTimeout(150); await p.setViewportSize({width:375,height:700}); await p.waitForTimeout(300);
  ok(await p.evaluate(()=>{ const c=$('clrPad'); const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data; let n=0; for(let i=3;i<d.length;i+=4) if(d[i]>200) n++; return n>500; }),'redrawn after a resize');
  await p.click('#clrOk');
  // in controlled airspace, then out of it for 2 min -> cleared
  await p.evaluate(()=>{ clrUI({k:'D'}); clrUI({k:'G'}); CLR.leftT=Date.now()-121e3; clrUI({k:'G'}); });
  ok(await p.evaluate(()=>!CLR.ink&&!CLR.sq&&$('sClr').hidden),'cleared 2 min after leaving controlled airspace');
  // Wipe pad
  await p.click('#bPad'); await stroke([[30,40],[90,90]]); await p.click('#clrWipe'); ok(await p.evaluate(()=>CLR.ink.length===0&&$('sClr').hidden),'Wipe pad empties it');
  console.log(fail.length? fail.length+' FAILED':'all passed'); console.log(errs); await b.close(); process.exit(fail.length?1:0); })();
