// Offline speech-to-text (20 Nov 2026, Michael: "Add the offline speech decoder"). Chrome's fake microphone plays
// play/fixtures/radio_call.wav (a text-to-speech radio call with 1.5 s of silence each side, looped). Downloads the
// standard model from Hugging Face the first time (needs internet; ~41 MB), transcribes live, then reloads offline
// and transcribes from the stored model. node play/stt.js   (app on :8811)
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch({args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--use-file-for-fake-audio-capture='+__dirname+'/fixtures/radio_call.wav']}), errs=[], fail=[];
  const ok=(c,m)=>{ console.log((c?'ok   ':'FAIL ')+m); if(!c) fail.push(m); };
  const ctx=await b.newContext({...PX9,permissions:['microphone'],storageState:{cookies:[],origins:[{origin:'http://localhost:8811',localStorage:[{name:'rc_fsMap',value:'false'},{name:'rc_cSign',value:'"ABC"'}]}]}});
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); });
  await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'&&st.pos);
  await p.evaluate(()=>{ $('cSign').value='ABC'; });
  await p.waitForFunction(()=>navigator.serviceWorker&&navigator.serviceWorker.controller,null,{timeout:20000}).catch(()=>{});
  await p.click('#bOpts'); await p.waitForTimeout(500);
  const m0=await p.evaluate(()=>$('sttMSt').textContent); console.log('     model: '+m0);
  if(!/stored/.test(m0)){ await p.click('#sttDl');
    const t0=Date.now(); await p.waitForFunction(()=>STT.ready||/Couldn't|failed/.test($('sttMSt').textContent),null,{timeout:300000,polling:1000});
    console.log(`     download + load: ${((Date.now()-t0)/1000).toFixed(0)} s · ${await p.evaluate(()=>$('sttMSt').textContent)}`); }
  ok(await p.evaluate(()=>/stored/.test($('sttModel').selectedOptions[0].textContent)),'model stored on the device');
  // live: list inputs, transcribe
  await p.click('#audList'); await p.waitForFunction(()=>!$('audDev').disabled);
  await p.check('#sttOn'); const t1=Date.now();
  await p.waitForFunction(()=>STT.log.length>=2,null,{timeout:120000,polling:500});
  const L=await p.evaluate(()=>({log:STT.log.map(x=>x.text), html:$('sttLog').innerHTML, st:$('sttSt').textContent, warm:STT.warm}));
  console.log(`     ${((Date.now()-t1)/1000).toFixed(0)} s for 2 lines · warm-up ${L.warm|0} ms · ${L.st}`); L.log.forEach(x=>console.log('     > '+x));
  const good=L.log.filter(x=>/Moorabbin Tower/.test(x)&&/Carrum/.test(x)&&/inbound/i.test(x));
  ok(good.length>=1,'transcribed with local names: Moorabbin Tower … Carrum … inbound');
  ok(/<mark>/.test(L.html),'own callsign (ABC / Alpha Bravo Charlie) highlighted');
  ok(L.log.every(x=>!/thank you/i.test(x)),'no stock "thank you" lines from the silence');
  await p.evaluate(()=>$('sttLog').scrollIntoView({block:'center'})); await p.screenshot({path:__dirname+'/stt_opts.png'});
  // RADIO row stays after closing Options, listening continues
  await p.evaluate(()=>$('optsDlg').close()); await p.waitForTimeout(300);
  ok(await p.evaluate(()=>!!AUD.st&&!$('sStt').hidden&&/RADIO/.test($('sStt').textContent)),'Options closed: still listening, RADIO row shown');
  await p.locator('.wrap>.status').screenshot({path:__dirname+'/stt_row.png'});
  await p.evaluate(()=>sttSet(false)); ok(await p.evaluate(()=>$('sStt').hidden),'off: row hidden');
  // offline: reload with no network; the model and the library come from the device
  await ctx.setOffline(true); await p.reload(); await p.waitForFunction(()=>typeof render==='function',null,{timeout:30000});
  await p.evaluate(()=>{ $('cSign').value='ABC'; STT.log=[]; }); await p.click('#bOpts'); await p.waitForTimeout(500);
  ok(await p.evaluate(()=>/without signal/.test($('sttMSt').textContent)),'offline: '+await p.evaluate(()=>$('sttMSt').textContent));
  await p.click('#audList'); await p.waitForFunction(()=>!$('audDev').disabled); await p.check('#sttOn');
  const ok2=await p.waitForFunction(()=>STT.log.some(x=>/moorabbin/i.test(x.text)),null,{timeout:120000,polling:500}).then(()=>true,()=>false);
  ok(ok2,'offline: transcribed from the stored model ('+(await p.evaluate(()=>(STT.log[0]||{}).text||$('sttMSt').textContent+' / '+$('sttSt').textContent+' / ready '+STT.ready+' loading '+!!STT.loading))+')');
  await ctx.setOffline(false);
  console.log(fail.length? fail.length+' FAILED':'all passed'); console.log(errs.filter(e=>!/ERR_INTERNET_DISCONNECTED|net::/.test(e))); await b.close(); process.exit(fail.length?1:0); })();
