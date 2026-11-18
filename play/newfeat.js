// SARTIME, spoken alerts, checklists by phase, weather rings, side view (16 Nov 2026).
// node play/newfeat.js   (app served on :8811)
const {chromium}=require('playwright'); const {PX9}=require('./px9.js'); const fs=require('fs');
const U='http://localhost:8811/index.html';
const say=()=>{ window.__said=[]; const S={speak:u=>window.__said.push(u.text),cancel(){},getVoices:()=>[]}; Object.defineProperty(window,'speechSynthesis',{value:S,configurable:true}); window.SpeechSynthesisUtterance=function(t){ this.text=t; }; };
(async()=>{ const b=await chromium.launch(), errs=[], fail=[]; const ok=(c,m)=>{ console.log((c?'ok   ':'FAIL ')+m); if(!c) fail.push(m); };
  const page=async(q,t0)=>{ const ctx=await b.newContext(PX9); await ctx.addInitScript(say); const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
    if(t0) await p.clock.install({time:new Date(t0)});
    await p.goto(U+q); await p.waitForFunction(()=>typeof render==='function'&&st.pos); await p.waitForTimeout(500); return p; };

  // 1. SARTIME: set, countdown row, landing, passed, cancelled
  { const p=await page('?sim=YMMB&alt=1000&trk=090&gs=0');
    await p.click('#bSar'); const z=await p.evaluate(()=>sarZ(Date.now()+20*60e3)); await p.fill('#sarZ',z); await p.click('#sarSet');
    let r=await p.evaluate(()=>({t:SAR.t, row:!$('sSar').hidden, cls:$('sSar').className, txt:$('sSar').textContent}));
    ok(r.row&&/amber/.test(r.cls)&&/SARTIME/.test(r.txt)&&/in 0:(19|20)/.test(r.txt),'SARTIME row amber, counting down: '+r.txt);
    await p.click('#sarClose');
    // fly, then stop for 30 s -> landed
    await p.evaluate(()=>{ st.gs=90; phTick(); st.gs=0; phTick(); PH.stop0-=31e3; phTick(); });
    r=await p.evaluate(()=>({land:SAR.land, txt:$('sSar').textContent, said:__said.slice()}));
    ok(r.land&&/landed: cancel with ATS/.test(r.txt),'landed shown: '+r.txt);
    ok(r.said.some(s=>/Landed\. Remember to cancel your SARTIME/.test(s)),'landing spoken: '+JSON.stringify(r.said));
    // passed
    await p.evaluate(()=>{ SAR.t=Date.now()-5*60e3; sarTick(); });
    r=await p.evaluate(()=>({cls:$('sSar').className, txt:$('sSar').textContent, said:__said.slice()}));
    ok(/warn/.test(r.cls)&&/passed 0:05 ago/.test(r.txt),'passed: '+r.txt);
    ok(r.said.some(s=>/SARTIME passed\. Cancel your SARTIME now/.test(s)),'passed spoken');
    await p.click('#sSar'); await p.click('#sarCnx'); await p.click('#sarClose');
    r=await p.evaluate(()=>({row:$('sSar').hidden, cnx:SAR.cnx}));
    ok(r.row&&r.cnx,'cancelled: row gone');
    await p.reload(); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(300);
    ok(await p.evaluate(()=>SAR.cnx>0&&SAR.t>0),'kept after reload');
    // flight note with a name
    await p.click('#bSar'); await p.selectOption('#sarWith','fn'); await p.fill('#sarZ',await p.evaluate(()=>sarZ(Date.now()+90*60e3))); await p.fill('#sarWho','Sam 0400 000 000'); await p.click('#sarSet'); await p.click('#sarClose');
    r=await p.evaluate(()=>$('sSar').textContent); ok(/FLIGHT NOTE/.test(r)&&/Sam/.test(r)&&/in 1:(29|30)/.test(r),'flight note row: '+r);
    // +1 h button and parse
    ok(await p.evaluate(()=>{ const t=Date.UTC(2026,10,16,23,50); return sarParse('0010',t)===Date.UTC(2026,10,17,0,10)&&sarParse('2330',t)===Date.UTC(2026,10,16,23,30)&&sarParse('2460',t)===null; }),'sarParse rolls to tomorrow, an hour back counts as today');
    await p.close(); }

  // 2. spoken alerts: NEXT CLASS ahead (Moorabbin from the west), new CTAF frequency
  { const p=await page('?sim=-37.97,144.93&alt=1000&trk=090&gs=90','2026-10-28T03:00:00Z');
    await p.evaluate(()=>{ SAY.fq=true; render(); }); await p.waitForTimeout(400);
    let r=await p.evaluate(()=>({nx:$('sNxCls').hidden?'':$('sNxCls').textContent, said:__said.slice()}));
    ok(r.nx&&r.said.some(s=>/^Class D ahead, \d+ miles?, Moorabbin Tower/.test(s)&&/one two three decimal zero/.test(s)),'NEXT CLASS spoken: '+JSON.stringify(r.said)+' | '+r.nx);
    const n=r.said.length; await p.evaluate(()=>render()); await p.waitForTimeout(200);
    ok((await p.evaluate(()=>__said.length))===n,'not repeated on the next update');
    // CTAF tile change: move the sim near Lilydale, hold 3 s
    const before=await p.evaluate(()=>$('sCtaf').textContent);
    await p.evaluate(()=>{ $('simPos').value='YLIL'; simApply(); }); await p.waitForTimeout(4500);
    r=await p.evaluate(()=>({f:$('sCtaf').textContent, said:__said.slice()}));
    ok(r.f!==before&&r.said.some(s=>/Lilydale traffic, one one niner decimal one/i.test(s)),'new CTAF spoken ('+before+' -> '+r.f+'): '+JSON.stringify(r.said.slice(-3)));
    // options: turning one off stops it
    await p.evaluate(()=>{ SAY.cls=false; SAYT.clear(); __said.length=0; NX.key=''; render(); });
    ok(!(await p.evaluate(()=>__said.some(s=>/ahead/.test(s)))),'off in Options: silent');
    await p.close(); }

  // 3. checklists by phase
  { const p=await page('?sim=YMMB&alt=200&trk=090&gs=0');
    await p.evaluate(()=>{ CL=[{id:'a1',name:'After landing',ac:'',items:['Collective .... down','Throttle .... idle'],t:1,ph:'land'},{id:'b1',name:'Pre-landing',ac:'',items:['Fuel .... check'],t:1,ph:'inb'},{id:'c1',name:'Start',ac:'',items:['Battery .... on'],t:1}]; clStore(); CLT={a1:'11'}; });
    await p.evaluate(()=>{ st.gs=60; phTick(); st.gs=0; phTick(); PH.stop0-=31e3; phTick(); });
    let r=await p.evaluate(()=>({row:!$('sChk').hidden, txt:$('sChk').textContent, tick:CLT.a1, said:__said.slice()}));
    ok(r.row&&/After landing/.test(r.txt)&&!r.tick,'after-landing offered, ticks cleared: '+r.txt);
    ok(r.said.includes('After landing checklist'),'offer spoken');
    await p.click('#sChk'); r=await p.evaluate(()=>({open:$('clDlg').open, v:CLV.v, id:CLV.id, n:document.querySelectorAll('#clBody li.i').length}));
    ok(r.open&&r.v==='run'&&r.id==='a1'&&r.n===2,'tap opens it to run');
    for(const k of [0,1]) await p.click(`#clBody li.i[data-k="${k}"]`);
    await p.evaluate(()=>chkUI()); ok(await p.evaluate(()=>$('sChk').hidden),'row goes once complete');
    // the editor keeps the phase
    await p.evaluate(()=>{ CLV.v='edit'; CLV.id='c1'; clRender(); }); await p.selectOption('#clPh','move'); await p.click('#clBody [data-a="save"]');
    ok(await p.evaluate(()=>CL.find(c=>c.id==='c1').ph==='move'&&/before take-off/.test($('clBody').textContent)),'phase saved and listed');
    await p.click('#clClose');
    // start moving after a stop -> before take-off
    await p.evaluate(()=>{ PH.fly=false; PH.stop0=Date.now()-70e3; st.gs=12; phTick(); });
    ok(await p.evaluate(()=>!$('sChk').hidden&&/Before take-off/.test($('sChk').textContent)),'before take-off offered on moving off');
    // inbound to a landing aerodrome -> pre-landing
    await p.evaluate(()=>{ phEvent('inb',{i:'YMMB'}); });
    ok(await p.evaluate(()=>/Pre-landing/.test($('sChk').textContent)),'pre-landing offered at the inbound call');
    await p.close(); }

  // 4. weather rings: briefing METAR / TAF at Moorabbin and Avalon
  { const p=await page('?sim=-37.95,145.0&alt=1500&trk=270&gs=90','2026-10-31T01:30:00Z');
    const txt=fs.readFileSync(__dirname+'/fixtures/naips_met.txt','utf8');
    await p.evaluate(t=>{ nbLoad(t); MAP.range=40; render(); },txt); await p.waitForTimeout(400);
    let r=await p.evaluate(()=>({mb:wxCatAt('YMMB',Date.now()), av:wxCatAt('YMAV',Date.now()), later:wxCatAt('YMMB',Date.UTC(2026,9,31,5)), n:MAP.wxN, leg:!$('wxLeg').hidden}));
    ok(r.mb&&r.mb.c==='VFR'&&r.mb.src==='METAR','YMMB now from METAR: '+JSON.stringify(r.mb));
    ok(r.av&&r.av.c==='MVFR','YMAV SPECI BKN025 -> MVFR: '+JSON.stringify(r.av));
    ok(r.later&&r.later.src==='TAF'&&r.later.c==='VFR'&&r.later.tmp==='IFR','YMMB 0500Z from the TAF, TEMPO 4000 SHRA BKN012 worse: '+JSON.stringify(r.later));
    ok(r.n>=2&&r.leg,'rings drawn ('+r.n+'), legend shown');
    await p.screenshot({path:__dirname+'/newfeat_wx.png'});
    await p.click('#mapWx'); ok(await p.evaluate(()=>!MAP.wx&&$('wxLeg').hidden),'Wx button turns them off');
    await p.close(); }

  // 5. side view
  { const p=await page('?sim=-37.97,144.93&alt=1000&trk=090&gs=90','2026-10-28T03:00:00Z');
    await p.click('#mapSide'); await p.waitForTimeout(1300);
    let r=await p.evaluate(()=>({show:!$('sideBox').hidden, n:SIDE.n, txt:$('sideTxt').textContent, S:SIDE.S&&SIDE.S.S.length, h:$('sideCv').height}));
    ok(r.show&&r.n>0&&r.S>=40&&r.h>0,'side view drawn: '+r.S+' samples');
    ok(/track 0\d\d°M/.test(r.txt)&&/class D in \d/.test(r.txt),'caption: '+r.txt);
    await p.screenshot({path:__dirname+'/newfeat_side.png'});
    const n0=r.n; await p.evaluate(()=>render()); await p.waitForTimeout(1200); ok((await p.evaluate(()=>SIDE.n))===n0,'not redrawn when nothing changed');
    await p.evaluate(()=>{ st.alt=3000; render(); }); await p.waitForTimeout(1300); ok((await p.evaluate(()=>SIDE.n))>n0,'redrawn on a climb');
    await p.evaluate(()=>measSet(true)); ok(await p.evaluate(()=>$('sideBox').hidden),'hidden while measuring'); await p.evaluate(()=>measSet(false));
    await p.click('#sideX'); ok(await p.evaluate(()=>$('sideBox').hidden&&!ls.get('mapSide',true)),'✕ closes it');
    await p.close(); }

  // 6. full screen: new layer buttons in the grid, new rows in the HUD
  { const ctx=await b.newContext({...PX9,storageState:{cookies:[],origins:[{origin:'http://localhost:8811',localStorage:[{name:'rc_fsMap',value:'true'}]}]}}); await ctx.addInitScript(say);
    const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
    await p.goto(U+'?sim=-37.97,144.93&alt=1000&trk=090&gs=90'); await p.waitForFunction(()=>typeof render==='function'&&st.pos); await p.waitForTimeout(600);
    await p.click('#mapLayers'); const r=await p.evaluate(()=>({wx:$('mapWx').parentElement.id, side:$('mapSide').parentElement.id, w:document.documentElement.scrollWidth}));
    ok(r.wx==='layPop'&&r.side==='layPop'&&r.w<=427,'full screen: Wx and Side in the Layers grid, no sideways scroll');
    await p.click('#mapSide'); await p.evaluate(()=>layPopShow(false));   // close the Layers grid (a tap on the map did this; the HUD now covers most of the top of the map) await p.waitForTimeout(1300);
    await p.evaluate(()=>{ SAR.t=Date.now()+10*60e3; SAR.cnx=0; sarTick(); });
    ok(await p.evaluate(()=>$('sSar').parentElement.id==='hudA'&&!$('sideBox').hidden),'SARTIME row in the HUD, side view over the map');
    await p.screenshot({path:__dirname+'/newfeat_fs.png'}); await ctx.close(); }

  console.log(fail.length? fail.length+' FAILED' : 'all passed'); console.log(errs); await b.close(); process.exit(fail.length?1:0); })();
