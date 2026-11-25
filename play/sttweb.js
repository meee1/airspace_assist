// Browser speech recognition as a second transcription engine (24 Nov 2026, Michael: "Check SpeechRecognition for translation,
// the current model is slow, so add a second option"). Headless Chrome's real recognition doesn't work, so a fake
// SpeechRecognition class (with available/install, phrases, start(track) checking its argument like Chrome) stands in;
// Chrome's fake microphone gives the input track. node play/sttweb.js (app on :8811)
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch({args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']}), errs=[], fail=[];
  const ok=(c,m)=>{ console.log((c?'ok   ':'FAIL ')+m); if(!c) fail.push(m); };
  const ctx=await b.newContext({...PX9,permissions:['microphone'],storageState:{cookies:[],origins:[{origin:'http://localhost:8811',localStorage:[{name:'rc_fsMap',value:'false'}]}]}});
  await ctx.addInitScript(()=>{ window.__SR={inst:[], local:'available'};
    class FakeSR extends EventTarget{ constructor(){ super(); this.lang=''; this.continuous=false; this.interimResults=false; this.processLocally=false; this.phrases=[]; __SR.inst.push(this); }
      start(t){ if(arguments.length&&!(t instanceof MediaStreamTrack)) throw new TypeError("Failed to execute 'start': parameter 1 is not of type 'MediaStreamTrack'."); this.track=t||null; this.started=true; this.dispatchEvent(new Event('start')); }
      abort(){ this.aborted=true; } stop(){ this.stopped=true; }
      static async available(o){ return (__SR.map&&__SR.map[o.langs[0]])||__SR.local; } static async install(o){ __SR.installed=o.langs[0]; if(__SR.map) __SR.map[o.langs[0]]='available'; __SR.local='available'; return true; } }
    window.SpeechRecognition=FakeSR; window.webkitSpeechRecognition=FakeSR; window.SpeechRecognitionPhrase=class{ constructor(p,b){ this.phrase=p; this.boost=b; } };
    window.__emit=(text,fin)=>{ const r=__SR.inst.filter(x=>x.started&&!x.aborted).pop(); const R=[{transcript:text, confidence:0.9}]; R.isFinal=fin; r.onresult({resultIndex:0, results:[R]}); return true; }; });
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'&&st.pos);
  await p.evaluate(()=>{ $('cSign').value='ABC'; $('bOpts').click(); }); await p.waitForTimeout(300);
  // pick the engine
  await p.selectOption('#sttEng','web'); await p.waitForTimeout(300);
  let r=await p.evaluate(()=>({st:$('sttEngSt').textContent, wh:getComputedStyle($('sttWhRow')).display, sens:getComputedStyle($('sttSensRow')).display, saved:ls.get('sttEng')}));
  ok(/on this tablet/.test(r.st)&&r.wh==='none'&&r.sens==='none'&&r.saved==='web',`engine Browser speech recognition: "${r.st.slice(0,70)}…", model and sensitivity rows hidden, saved`);
  await p.click('#audList'); await p.waitForFunction(()=>!$('audDev').disabled);
  await p.evaluate(()=>sttSet(true)); await p.waitForFunction(()=>__SR.inst.some(x=>x.started&&x.track),null,{timeout:8000}).catch(()=>{});
  r=await p.evaluate(()=>{ const x=__SR.inst.filter(i=>i.started).pop(); return x&&{track:x.track instanceof MediaStreamTrack, same:x.track===AUD.st.getAudioTracks()[0], local:x.processLocally, cont:x.continuous, interim:x.interimResults, lang:x.lang, ph:(x.phrases||[]).map(q=>q.phrase), st:$('sttSt').textContent, node:!!STT.node}; });
  ok(r&&r.track&&r.same&&r.local&&r.cont&&r.interim&&r.ph.includes('Moorabbin Tower')&&!r.node,`started on the picked input's track, on the device, continuous, ${r&&r.ph.length} phrases incl. Moorabbin Tower, no Whisper tap · ${r&&r.st}`);
  // a call: interim then final -> log, callsign alert, suggestions, RADIO row
  await p.evaluate(()=>__emit('Alpha Bravo Charlie Moorabbin',false)); r=await p.evaluate(()=>$('sttSt').textContent); ok(/^Hearing: Alpha Bravo Charlie Moorabbin/.test(r),'interim result shown: '+r);
  await p.waitForTimeout(600);
  await p.evaluate(()=>__emit('Alpha Bravo Charlie, Moorabbin Tower, cleared to enter the control zone via Carrum, not above one thousand five hundred, squawk three four zero one',true));
  r=await p.evaluate(()=>{ const x=STT.log[STT.log.length-1]; return {t:x&&x.text, me:x&&x.me, sq:x&&x.sug&&x.sug.sq, lvl:x&&x.sug&&x.sug.lvl, dur:x&&x.dur, row:!$('sStt').hidden&&$('sStt').innerText, tx:TXLOG.length}; });
  ok(r.t&&r.me&&r.sq==='3401'&&r.lvl==='not above 1500'&&r.dur>=0.5&&r.row&&/Moorabbin Tower/.test(r.row),`final result logged: callsign heard, squawk ${r.sq} and ${r.lvl} offered, ${r.dur.toFixed(1)} s, RADIO row "${String(r.row).replace(/\s+/g,' ').slice(0,60)}"`);
  // recognition ends (Chrome stops after a while): started again
  const n0=await p.evaluate(()=>__SR.inst.length); await p.evaluate(()=>{ const x=__SR.inst.filter(i=>i.started).pop(); x.onend(); }); await p.waitForTimeout(600);
  r=await p.evaluate(n0=>({n:__SR.inst.length-n0, ok:__SR.inst[__SR.inst.length-1].started}),n0); ok(r.n>=1&&r.ok,'ended recognition restarts by itself');
  // online only (no offline pack): no processLocally, no phrases, said in the UI; install
  await p.evaluate(async()=>{ __SR.local='downloadable'; await srwUI(); srwStop(); await srwStart(); }); await p.waitForTimeout(200);
  r=await p.evaluate(()=>{ const x=__SR.inst.filter(i=>i.started).pop(); return {local:x.processLocally, ph:(x.phrases||[]).length, st:$('sttEngSt').textContent, inst:!$('sttWebInst').hidden}; });
  ok(!r.local&&r.ph===0&&/Google/.test(r.st)&&r.inst,`no offline pack: online service, no phrases, "Install offline pack" shown · ${r.st.slice(0,80)}…`);
  await p.click('#sttWebInst'); await p.waitForTimeout(400);
  r=await p.evaluate(()=>{ const x=__SR.inst.filter(i=>i.started&&!i.aborted).pop(); return {local:x.processLocally, inst:$('sttWebInst').hidden, st:$('sttEngSt').textContent}; });
  ok(r.local&&r.inst&&/on this tablet/.test(r.st),'Install offline pack: back on the device');
  // hands-free checklist: commands go to the sink, not the log; nothing while the tablet speaks
  r=await p.evaluate(()=>{ const got=[], n=STT.log.length; STT.sink=t=>got.push(t); HF.quietT=Infinity; __emit('check',true); const a=got.length; HF.quietT=Date.now()-1000; SRW.t0=0; __emit('check',true); STT.sink=null; HF.quietT=0; return {a, b:got.length, log:STT.log.length-n}; });
  ok(r.a===0&&r.b===1&&r.log===0,`hands-free: ignored while the tablet speaks, then "check" goes to the checklist (${r.a}/${r.b}), not the radio log`);
  // back to Whisper: recognition stopped
  await p.selectOption('#sttEng','whisper'); await p.waitForTimeout(300);
  r=await p.evaluate(()=>({on:SRW.on, ab:__SR.inst.filter(i=>i.started).pop().aborted, wh:getComputedStyle($('sttWhRow')).display}));
  ok(!r.on&&r.ab&&r.wh!=='none','back to Whisper: browser recognition stopped, model row shown');
  await p.evaluate(()=>{ $('sttEng').value='web'; $('sttEng').onchange(); }); await p.waitForTimeout(300); await p.evaluate(()=>sttSet(false));
  r=await p.evaluate(()=>({on:SRW.on})); ok(!r.on,'transcription off: browser recognition stopped');
  // a browser whose start() takes no track: default microphone, said in the status
  await p.evaluate(async()=>{ SRW.track=null; window.SpeechRecognition.prototype.start=function(){ this.track=null; this.started=true; }; await sttSet(true); });
  await p.waitForTimeout(400); r=await p.evaluate(()=>({tr:SRW.track, st:$('sttSt').textContent, aud:!!AUD.st, diag:$('sttWebDiag').textContent}));
  const rr=await p.evaluate(()=>{ __emit('Alpha Bravo Charlie, Tyabb traffic, test call',true); sttRow(); return {row:!$('sStt').hidden&&$('sStt').innerText}; });
  await p.evaluate(()=>sttSet(false));
  ok(r.tr===false&&/default microphone/.test(r.st),'no track support: uses the default microphone and says so · '+r.st);
  ok(!r.aud&&/takes the chosen input: no/.test(r.diag)&&/closed the input test/.test(r.diag)&&/Tyabb traffic/.test(rr.row||''),'no track support: the app\'s own input is closed so the browser can have the microphone; a call still reaches the RADIO row · '+r.diag.slice(0,160));
  const dg=await p.evaluate(()=>$('sttWebDiag').textContent); ok(/Browser recognition: yes · offline pack en-AU available, en-US available, en-GB available/.test(dg)&&/events: .*start/.test(dg),'diagnostics line: '+dg.slice(0,200));
  // on-device (26 Nov 2026): every English asked and shown; a downloadable en-US is picked and installed; "Try on the device anyway"
  r=await p.evaluate(async()=>{ __SR.map={'en-AU':'unavailable','en-US':'downloadable','en-GB':'unavailable'}; const A=await srwAvail(); await srwUI(); return {lang:A.lang, local:A.local, diag:$('sttWebDiag').textContent, inst:!$('sttWebInst').hidden}; });
  ok(r.lang==='en-US'&&r.local==='downloadable'&&r.inst&&/en-AU unavailable, en-US downloadable, en-GB unavailable/.test(r.diag),'each English asked: '+r.diag.slice(0,110));
  r=await p.evaluate(async()=>{ await srwInstall(); return {inst:__SR.installed, diag:$('sttWebDiag').textContent}; }); ok(r.inst==='en-US'&&/en-US available/.test(r.diag),'Install offline pack installs en-US: '+r.diag.slice(0,90));
  r=await p.evaluate(async()=>{ __SR.map={'en-AU':'unavailable','en-US':'unavailable','en-GB':'unavailable'}; __SR.local='unavailable'; $('sttForceLocal').checked=true; $('sttForceLocal').onchange(); await sttSet(true); await new Promise(r=>setTimeout(r,300));
    const x=__SR.inst.filter(i=>i.started&&!i.aborted).pop(), forced=x&&x.processLocally; x.onerror({error:'language-not-supported'}); /* no end event, as on a Pixel */ await new Promise(r=>setTimeout(r,600));
    const y=__SR.inst.filter(i=>i.started&&!i.aborted).pop(); const out={forced, after:y&&y.processLocally, restarted:y!==x, diag:$('sttWebDiag').textContent, st:$('sttSt').textContent, saved:ls.get('sttForceLocal')}; await sttSet(false); $('sttForceLocal').checked=false; $('sttForceLocal').onchange(); return out; });
  ok(r.forced===true&&r.after===false&&r.restarted&&/on-device refused: online/.test(r.diag)&&/listening online/.test(r.diag)&&r.saved===true&&/(won't recognise|Listening)/.test(r.st),`Try on the device anyway: processLocally set though Chrome says unavailable; refused -> online (${r.st.slice(0,80)})`);
  await p.locator('#optsDlg').screenshot({path:__dirname+'/sttweb.png'}).catch(()=>{});
  console.log(fail.length? fail.length+' FAILED':'all passed'); console.log(errs); await b.close(); process.exit(fail.length?1:0); })();
