// Heading display (18 Nov 2026, Michael: A, C and D as options, A the default): A = tape under the tiles (top bar on the classic
// page and the tablet), C = arc round your aircraft, D = tape in the nav tiles; A+C, C+D, off. node play/hdgtape.js  (app on :8811)
const {chromium}=require('playwright'); const {PX9,TAB}=require('./px9.js');
(async()=>{ const b=await chromium.launch(), errs=[], fail=[]; const ok=(c,m)=>{ console.log((c?'ok   ':'FAIL ')+m); if(!c) fail.push(m); };
  const mk=async(prof,fs,extra=[])=>{ const ctx=await b.newContext({...prof,storageState:{cookies:[],origins:[{origin:'http://localhost:8811',localStorage:[{name:'rc_fsMap',value:String(fs)},{name:'rc_mapCharts',value:'false'},...extra]}]}});
    await ctx.addInitScript(()=>{ const D=Date, off=D.parse('2026-11-01T01:30:00Z')-D.now(); window.Date=class extends D{ constructor(...a){ super(...(a.length?a:[D.now()+off])); } static now(){ return D.now()+off; } }; });
    const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
    await p.goto('http://localhost:8811/index.html?sim=-38.16,144.98&alt=1500&trk=040&gs=95'); await p.waitForFunction(()=>typeof render==='function'&&st.pos);
    await p.setInputFiles('#fpFile',__dirname+'/fixtures/ybrs.gpx'); await p.waitForFunction(()=>FP&&FP.pts.length>5);
    await p.evaluate(()=>{ fpPick(FP.pts.findIndex(q=>q.c==='CARR')); ls.set('pcWsrc','set'); ls.set('pcWind',{dir:300,kt:18}); ls.set('pcGs',95); render(); }); await p.waitForTimeout(900); return {ctx,p}; };
  const state=p=>p.evaluate(()=>({A:!$('sTapeA').hidden, Apar:$('sTapeA').parentElement.id||$('sTapeA').parentElement.className, D:!$('nTape').hidden, hdg:getComputedStyle($('nHdg')).display,
    aS:$('tapeAS').textContent, toV:$('nToV').textContent, mode:HDGO.mode}));
  const mag=p=>p.evaluate(()=>{ const c=$('map'), k=c.width/c.clientWidth, o=MAP.P(st.pos[0],st.pos[1]), R_=Math.round(130*k), x0=Math.max(0,Math.round(o[0]*k)-R_), y0=Math.max(0,Math.round(o[1]*k)-R_), w=Math.min(c.width-x0,2*R_), h=Math.min(c.height-y0,2*R_);
    const d=c.getContext('2d').getImageData(x0,y0,w,h).data; let n=0; for(let i=0;i<d.length;i+=4) if(d[i]>150&&d[i+1]<100&&d[i+2]>180) n++; return n; });
  const setMode=async(p,m)=>{ await p.evaluate(m=>{ $('optHdgMode').value=m; $('optHdgMode').dispatchEvent(new Event('change')); },m); await p.waitForTimeout(300); };
  // classic phone: A by default, in the top bar
  let {ctx,p}=await mk(PX9,false); let r=await state(p);
  ok((await p.evaluate(()=>{ const t=$('sTapeA').getBoundingClientRect(), g=$('gpsTile').getBoundingClientRect(); return t.bottom<=g.top+1; })),'classic: A is the first row of the top bar');
  ok(r.mode==='A'&&r.A&&!r.D&&r.hdg==='none'&&/^STEER 030 · turn left 10°  →  CARR 8\.4 NM$/.test(r.aS),'classic: A by default, in place of the HDG/→HDG tiles: '+r.aS);
  ok((await mag(p))===0,'A only: no arc on the map');
  await p.locator('.wrap>.status').screenshot({path:__dirname+'/hdgtape_classic_A.png'});
  for(const [m,a,c,d] of [['C',false,true,false],['D',false,false,true],['AC',true,true,false],['CD',false,true,true],['off',false,false,false]]){ await setMode(p,m); r=await state(p); const n=await mag(p);
    ok(r.A===a&&r.D===d&&(n>40)===c&&(r.hdg==='none')===(d||a)&&(await p.evaluate(()=>ls.get('hdgMode')))===m,`mode ${m}: tape A ${r.A}, tape D ${r.D}, arc ${n} px`); }
  await setMode(p,'A'); await ctx.close();
  // full-screen phone: A under the tiles (its own row over the map), C, D
  ({ctx,p}=await mk(PX9,true));
  r=await state(p); const geo=await p.evaluate(()=>{ const t=$('sTapeA').getBoundingClientRect(), L=$('hudL').getBoundingClientRect(), R=$('hudR').getBoundingClientRect(); return {top:t.top,bot:t.bottom,w:t.width,tiles:Math.min(L.top,R.top), iw:innerWidth, sw:document.documentElement.scrollWidth}; });
  ok(r.A&&r.Apar==='hudT'&&geo.top<=12&&geo.bot<=geo.tiles&&geo.w>380&&geo.sw<=geo.iw,`full-screen phone: A full width (${Math.round(geo.w)} px) at the top (${Math.round(geo.top)}–${Math.round(geo.bot)}), tiles from ${Math.round(geo.tiles)}`);
  await p.screenshot({path:__dirname+'/hdgtape_phone_A.png'});
  // the bugs stay visible when they're at your track (they were under the black box)
  const bugTop=await p.evaluate(()=>{ const C=hdgCog(); NAVB={brg:C.deg, steer:C.deg, c:'X', d:5, w:true}; hdgTape1($('tapeACv'),$('tapeAS'),variation(st.pos[0],st.pos[1]),true);
    const c=$('tapeACv'), k=c.width/c.clientWidth, d=c.getContext('2d').getImageData(Math.round(c.width/2-12*k),0,Math.round(24*k),Math.round(12*k)).data; let n=0; for(let i=0;i<d.length;i+=4) if(d[i]>150&&d[i+1]<100&&d[i+2]>180) n++; return n; });
  ok(bugTop>20,'steer = track: the magenta bug shows above the track box ('+bugTop+' px)'); await p.evaluate(()=>render());
  // off the end of the tape: an arrow at the edge on the side to turn to (steer 90 deg right -> right edge; 100 deg left -> left edge)
  const edgeAt=async off=>p.evaluate(off=>{ const C=hdgCog(); NAVB={brg:C.deg+off, steer:C.deg+off, c:'X', d:5, w:true}; hdgTape1($('tapeACv'),$('tapeAS'),variation(st.pos[0],st.pos[1]),true);
    const c=$('tapeACv'), k=c.width/c.clientWidth, h=Math.round(13*k), d=c.getContext('2d').getImageData(0,0,c.width,h).data, W=c.width; let l=0,r=0,m=0;
    for(let i=0;i<d.length;i+=4){ if(!(d[i]>150&&d[i+1]<100&&d[i+2]>180)) continue; const x=(i/4)%W; if(x<W*0.12) l++; else if(x>W*0.88) r++; else m++; } return {l,r,m}; },off);
  const eR=await edgeAt(90), eL=await edgeAt(-100); await p.evaluate(()=>render());
  ok(eR.r>30&&eR.l===0&&eL.l>30&&eL.r===0,`off the tape: arrow at the right edge for a right turn (${eR.r} px), left edge for a left turn (${eL.l} px)`);
  await setMode(p,'C'); await p.screenshot({path:__dirname+'/hdgtape_phone_C.png'}); await setMode(p,'D'); await p.screenshot({path:__dirname+'/hdgtape_phone_D.png'}); await ctx.close();
  // tablet: A in the left column, C, D
  ({ctx,p}=await mk(TAB,true)); r=await state(p);
  const tw=await p.evaluate(()=>({w:$('sTapeA').getBoundingClientRect().width, sw:document.documentElement.scrollWidth<=innerWidth}));
  ok(r.A&&tw.w>250&&tw.sw,`tablet: A in the tile column (${Math.round(tw.w)} px)`);
  ok(await p.evaluate(()=>{ const t=$('sTapeA').getBoundingClientRect(); return [...document.querySelectorAll('.wrap>.status>.st')].filter(e=>e!==$('sTapeA')&&e.getBoundingClientRect().height>0).every(e=>e.getBoundingClientRect().top>=t.bottom-1); }),'tablet: A at the top of the column');
  for(const m of ['A','C','D']){ await setMode(p,m); await p.waitForTimeout(300); await p.screenshot({path:__dirname+`/hdgtape_tab_${m}.png`}); }
  await ctx.close();
  console.log(fail.length? fail.length+' FAILED':'all passed'); console.log(errs); await b.close(); process.exit(fail.length?1:0); })();
