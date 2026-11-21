// Transcription extras (21 Nov 2026, Michael: "Do 3, 4, 9, 1, 2"): callsign alert, ATIS / clearance suggestions, transcripts
// in the flight log (GPX and replay), hands-free checklist, passenger briefing card. Chrome's fake microphone plays a
// Windows text-to-speech fixture. Needs internet the first time (the speech model, ~41 MB, kept in a profile folder under
// the system temp dir between runs). node play/sttplus.js   (app on :8811)
const {chromium}=require('playwright'); const {PX9}=require('./px9.js'); const os=require('os'), path=require('path');
const DIR=path.join(os.tmpdir(),'rc-sttplus-profile');
(async()=>{ const errs=[], fail=[]; const ok=(c,m)=>{ console.log((c?'ok   ':'FAIL ')+m); if(!c) fail.push(m); };
  const open=async wav=>{ const ctx=await chromium.launchPersistentContext(DIR,{...PX9,permissions:['microphone'],
      args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--use-file-for-fake-audio-capture='+path.join(__dirname,'fixtures',wav)]});
    await ctx.addInitScript(()=>{ localStorage.setItem('rc_fsMap','false'); window.__vib=[]; navigator.vibrate=p=>{ window.__vib.push(p); return true; }; });
    const p=ctx.pages()[0]||await ctx.newPage(); p.on('pageerror',e=>errs.push(wav+': '+e.message));
    await p.goto('http://localhost:8811/index.html?sim=-38.00,145.05&alt=1500&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'&&st.pos);
    await p.evaluate(()=>{ $('cSign').value='ABC'; $('cType').value='Robinson 44'; });
    await p.click('#bOpts'); await p.waitForTimeout(400);
    if(!(await p.evaluate(()=>sttHave(STT.model)))){ console.log('     downloading the speech model…'); await p.click('#sttDl'); await p.waitForFunction(()=>STT.ready,null,{timeout:300000,polling:1000}); }
    await p.click('#audList'); await p.waitForFunction(()=>!$('audDev').disabled); return {ctx,p}; };
  // 1 + 2 + 3: the inbound call ("Moorabbin Tower, Robinson 44, Alpha Bravo Charlie, … received information Charlie, inbound")
  let {ctx,p}=await open('radio_call.wav');
  await p.evaluate(()=>{ st.sim=false; STT.log=[]; for(const k of Object.keys(ATIS)) delete ATIS[k]; for(const k of Object.keys(CLR)) delete CLR[k]; clrSave(); });   // transcripts are logged only outside the simulator
  await p.check('#sttOn'); await p.waitForFunction(()=>STT.log.length>=1,null,{timeout:120000,polling:500});
  let r=await p.evaluate(()=>{ const x=STT.log[0]; return {text:x.text, me:x.me, sug:x.sug&&x.sug.lab, vib:__vib.length, meT:STT.meT>0, tx:TXLOG.length, row:$('sStt').className, btn:!!$('sttLog').querySelector('[data-sug]')}; });
  ok(r.me&&r.vib>=1&&r.meT&&/\bme\b/.test(r.row),`callsign heard: "${r.text.slice(0,50)}…" -> vibrate, RADIO row marked`);
  ok(r.sug==='ATIS YMMB C'&&r.btn,`suggestion offered: ${r.sug}`);
  await p.click('#sttLog [data-sug]'); r=await p.evaluate(()=>({l:atisOf('YMMB'), used:STT.log[0].sug.used}));
  ok(r.l==='C'&&r.used,'Use -> ATIS YMMB letter C stored');
  const tx=await p.evaluate(()=>({n:TXLOG.length, row:TXLOG[0]}));
  ok(tx.n>=1&&tx.row[1]!=null&&/Moorabbin/.test(tx.row[4])&&tx.row[5]===1,`logged with position: ${JSON.stringify(tx.row).slice(0,90)}…`);
  const g=await p.evaluate(()=>{ const t0=TXLOG[0][0]; const rows=[[t0-60e3,-38.0,145.05,1500,90,0,5,1],[t0+60e3,-38.02,145.05,1500,90,180,5,1]]; return fpLogGpx(rows,'test',[],TXLOG); });
  ok(/<wpt lat="-38\.?\d*" lon="145\.?\d*">.*<name>Radio \d{4}Z<\/name><desc>Moorabbin Tower[^<]*<\/desc><type>radio callsign<\/type><\/wpt>/s.test(g),'flight-log GPX has the transcript as a radio waypoint');
  const rp=await p.evaluate(g=>{ const pts=rpParseGpx(g); rpLoad(pts,'test'); RP.t=TXLOG[0][0]+5e3; rpShow(); return {tx:RP.tx.length, row:$('sStt').hidden?'':$('sStt').textContent}; },g);
  ok(rp.tx===1&&/RADIO \(replay\).*Moorabbin/.test(rp.row),'replay of that GPX shows the transcript at its time: '+rp.row.slice(0,60));
  await ctx.close();
  // 2: a clearance with your callsign
  ({ctx,p}=await open('radio_clr.wav'));
  await p.check('#sttOn'); await p.waitForFunction(()=>STT.log.length>=1,null,{timeout:120000,polling:500});
  r=await p.evaluate(()=>({text:STT.log[0].text, sug:STT.log[0].sug}));
  console.log('     > '+r.text);
  ok(r.sug&&r.sug.sq==='3401'&&/not above 1500/.test(r.sug.lvl||'')&&/^cleared/i.test(r.sug.rt||''),`clearance suggestion: ${r.sug&&r.sug.lab}`);
  await p.evaluate(()=>$('optsDlg').close()); await p.waitForTimeout(300);
  ok(await p.evaluate(()=>!!$('sStt').querySelector('[data-sug]')),'Use button on the RADIO row too');
  await p.click('#sStt [data-sug]'); r=await p.evaluate(()=>({sq:CLR.sq, lvl:CLR.lvl, rt:CLR.rt, opts:$('optsDlg').open}));
  ok(r.sq==='3401'&&/1500/.test(r.lvl)&&/control zone via Carrum$/i.test(r.rt)&&!r.opts,`RADIO row Use -> clearance notes squawk ${r.sq}, ${r.lvl}, "${r.rt}"`);
  await p.locator('.wrap>.status').screenshot({path:__dirname+'/sttplus_row.png'});
  await p.evaluate(()=>sttSet(false)); await ctx.close();
  // 4: hands-free checklist ("Check." every 3.7 s)
  ({ctx,p}=await open('say_check.wav'));
  await p.evaluate(()=>{ $('optsDlg').close(); CL=CL.filter(c=>c.id!=='hf-test'); delete CLT['hf-test']; ls.set('clTick',CLT); CL.push({id:'hf-test',name:'Hands free test',ac:'',items:['# Cabin','Doors .... Closed','Belts .... Fastened','Battery .... On'],t:Date.now()}); clStore(); clOpen(); CLV.v='run'; CLV.id='hf-test'; clRender(); });
  await p.click('#clBody [data-a="hf"]');
  const t0=Date.now(); await p.waitForFunction(()=>clCount(CL.find(c=>c.id==='hf-test')).join('/')==='3/3',null,{timeout:150000,polling:500}).catch(()=>{});
  r=await p.evaluate(()=>({c:clCount(CL.find(c=>c.id==='hf-test')), on:HF.on, msg:HF.msg}));
  ok(r.c[0]===3,`hands-free: ${r.c[0]}/${r.c[1]} ticked by saying "check" in ${((Date.now()-t0)/1000).toFixed(0)} s (${r.msg})`);
  await p.waitForFunction(()=>!HF.on,null,{timeout:15000}).catch(()=>{}); r=await p.evaluate(()=>({on:HF.on, msg:HF.msg}));
  ok(!r.on&&/complete/.test(r.msg),'stops when complete: '+r.msg);
  // the tablet's own reading isn't taken as an answer: a list read while the mic hears nothing new stays unticked
  ok(await p.evaluate(()=>typeof HF.quietT==='number'),'quiet window kept');
  await ctx.close();
  // 9: passenger briefing card (no audio)
  ({ctx,p}=await open('say_check.wav'));
  await p.evaluate(()=>{ $('optsDlg').close(); CL=CL.filter(c=>c.ph!=='brief'); delete CLT['pb-test']; ls.set('clTick',CLT); CL.push({id:'pb-test',name:'Passenger briefing',ac:'',ph:'brief',items:['# Before boarding','Approach the helicopter .... From the front, in view of the pilot','Seat belts .... Fasten, tighten; release by lifting the buckle','Doors .... The pilot opens and closes them'],t:Date.now()}); clStore(); });
  await p.click('#bMore').catch(()=>{}); await p.evaluate(()=>$('bBrief').click()); await p.waitForTimeout(300);
  r=await p.evaluate(()=>({vis:!$('briefBox').hidden, txt:$('briefBox').innerText}));
  ok(r.vis&&/1 \/ 3/.test(r.txt)&&/Approach the helicopter/.test(r.txt)&&/BEFORE BOARDING|Before boarding/i.test(r.txt),'More → Passenger brief: full screen, item 1 of 3 with its heading');
  await p.screenshot({path:__dirname+'/sttplus_brief.png'});
  await p.click('#briefBox [data-b="next"].btn'); await p.click('#briefBox [data-b="next"].btn');
  await p.click('#briefBox [data-b="done"]');
  r=await p.evaluate(()=>({hid:$('briefBox').hidden, c:clCount(CL.find(c=>c.id==='pb-test')), pb:ls.get('paxBrief')}));
  ok(r.hid&&r.c[0]===3&&r.pb&&r.pb.id==='pb-test','Done: all ticked, briefing time recorded');
  await ctx.close();
  console.log(fail.length? fail.length+' FAILED':'all passed'); console.log(errs); process.exit(fail.length?1:0); })();
