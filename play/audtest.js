// Options → Audio input test (20 Nov 2026, Michael: transcribe radio through the Bose A30; first see what the tablet hears).
// Chrome's fake microphone (a beeping tone) stands in for the headset. node play/audtest.js   (app on :8811)
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch({args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']}), errs=[], fail=[];
  const ok=(c,m)=>{ console.log((c?'ok   ':'FAIL ')+m); if(!c) fail.push(m); };
  const ctx=await b.newContext({...PX9,permissions:['microphone'],storageState:{cookies:[],origins:[{origin:'http://localhost:8811',localStorage:[{name:'rc_fsMap',value:'false'}]}]}});
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'&&st.pos);
  await p.evaluate(()=>$('optsDlg').showModal());
  await p.click('#audList'); await p.waitForFunction(()=>!$('audDev').disabled);
  const n=await p.evaluate(()=>$('audDev').options.length); ok(n>=1,`inputs listed: ${n} (${await p.evaluate(()=>$('audSt').textContent)})`);
  await p.click('#audGo'); await p.waitForFunction(()=>AUD.an&&AUD.hist.length>120,null,{timeout:10000});
  const m=await p.evaluate(()=>({max:Math.max(...AUD.hist), info:$('audInfo').textContent, btn:$('audGo').textContent}));
  ok(m.max>-40&&m.btn==='Stop'&&/noise suppression off/.test(m.info),`meter moves on the fake tone (RMS max ${m.max.toFixed(1)} dBFS) · ${m.info}`);
  await p.locator('#audBox').screenshot({path:__dirname+'/audtest.png'});
  // record (stop after 2 s instead of 30), play back
  await p.click('#audRec'); await p.waitForTimeout(2200); await p.click('#audRec');
  await p.waitForFunction(()=>!$('audPlay').disabled,null,{timeout:5000});
  const r=await p.evaluate(()=>({size:AUD.blob.size, type:AUD.blob.type, st:$('audSt').textContent}));
  ok(r.size>1000,`recorded ${r.size} bytes (${r.type}): ${r.st}`);
  // raw off: the constraints change
  await p.evaluate(()=>{ $('audRaw').checked=false; $('audRaw').dispatchEvent(new Event('change')); }); await p.waitForFunction(()=>AUD.an);
  await p.waitForTimeout(300);
  // closing Options stops the microphone
  await p.evaluate(()=>$('optsDlg').close()); await p.waitForTimeout(200);
  ok(await p.evaluate(()=>!AUD.st&&$('audGo').textContent==='Listen'),'closing Options stops listening');
  console.log(fail.length? fail.length+' FAILED':'all passed'); console.log(errs); await b.close(); process.exit(fail.length?1:0); })();
