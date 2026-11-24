// ATIS capture, read-back check, hover performance (25 Nov 2026, Michael chose suggestions 2, 3, 4). Fake SpeechRecognition (the
// browser engine) + Chrome's fake microphone; the hover tables are made-up test numbers, not an aircraft's. node play/atisrb.js (app on :8811)
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch({args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']}), errs=[], fail=[];
  const ok=(c,m)=>{ console.log((c?'ok   ':'FAIL ')+m); if(!c) fail.push(m); };
  const ctx=await b.newContext({...PX9,permissions:['microphone'],storageState:{cookies:[],origins:[{origin:'http://localhost:8811',localStorage:[{name:'rc_fsMap',value:'false'},{name:'rc_sttEng',value:'"web"'}]}]}});
  await ctx.addInitScript(()=>{ window.__SR={inst:[]};
    class FakeSR{ constructor(){ __SR.inst.push(this); } start(t){ if(arguments.length&&!(t instanceof MediaStreamTrack)) throw new TypeError('x'); this.track=t; this.started=true; } abort(){ this.aborted=true; } stop(){}
      static async available(){ return 'available'; } }
    window.SpeechRecognition=FakeSR; window.webkitSpeechRecognition=FakeSR; window.SpeechRecognitionPhrase=class{ constructor(p){ this.phrase=p; } };
    window.__say=text=>{ const r=__SR.inst.filter(x=>x.started&&!x.aborted).pop(); if(!r) return false; const R=[{transcript:text}]; R.isFinal=true; r.onresult({resultIndex:0, results:[R]}); return true; }; });
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'&&st.pos);
  // ---- ATIS capture
  await p.evaluate(()=>{ $('cSign').value='ABC'; clrOpen(DATA.ap.find(a=>a.i==='YMMB')); });
  await p.click('#atisLis'); await p.waitForFunction(()=>__SR.inst.some(x=>x.started&&x.track),null,{timeout:8000}).catch(()=>{});
  const n0=await p.evaluate(()=>STT.log.length);
  await p.evaluate(()=>{ __say('Moorabbin terminal information Bravo. Runway one seven left and one seven right.'); __say('Wind three four zero degrees one five knots, maximum crosswind one two knots. Visibility greater than ten kilometres.');
    __say('Cloud few two thousand five hundred. Temperature one eight. QNH one zero one three. On first contact with Moorabbin ground or tower notify receipt of Bravo.'); });
  let r=await p.evaluate(()=>({on:ATC.on, f:ATC.f, cap:$('atisCap').innerText}));
  ok(r.on&&r.f.info==='B'&&r.f.rwy==='17L and 17R'&&/^340°\/15 kt/.test(r.f.wind)&&r.f.qnh===1013&&r.f.temp==='18°C'&&/2500/.test(r.f.cloud)&&/greater than (10|ten)/.test(r.f.vis)&&/first contact/.test(r.f.other||''),`fields while listening: ${JSON.stringify(r.f).slice(0,260)}`);
  await p.evaluate(()=>{ ATC.t0-=30e3; __say('Moorabbin terminal information Bravo, runway one seven left'); });
  r=await p.evaluate(()=>({on:ATC.on, why:ATC.why, srw:SRW.on, cap:$('atisCap').innerText, log:STT.log.length}));
  ok(!r.on&&r.why==='done'&&!r.srw&&/Heard the whole broadcast/.test(r.cap)&&r.log===n0,'stops by itself when the letter comes round again; recognition closed; nothing in the radio log');
  await p.locator('#clrDlg').screenshot({path:__dirname+'/atisrb_atis.png'});
  await p.click('#atisCap [data-ac="use"]');
  r=await p.evaluate(()=>{ const A=ATIS.YMMB; render(); return {l:A&&A.l, q:A&&A.q, rwy:A&&A.f.rwy, lbl:$('clrAtisLbl').textContent, on:[...$('clrAtis').children].filter(x=>x.classList.contains('on')).map(x=>x.dataset.l), wx:!$('adWx').hidden&&$('adWx').innerHTML.replace(/<[^>]+>/g,' '), word:atisWord('YMMB')}; });
  ok(r.l==="B"&&r.q===1013&&r.on.join()==='B'&&/QNH 1013/.test(r.lbl)&&/ATIS B\s+heard/.test(r.wx)&&/Runway\s+17L and 17R/.test(r.wx)&&r.word==='Bravo',`Use: ATIS B, QNH 1013 saved; letter button on; the calls say "${r.word}"; aerodrome card: ${String(r.wx).replace(/\s+/g,' ').slice(0,110)}`);
  await p.evaluate(()=>$('clrDlg').close());
  // ---- read-back check
  await p.evaluate(()=>sttSet(true)); await p.waitForFunction(()=>SRW.on&&__SR.inst.some(x=>x.started&&!x.aborted),null,{timeout:8000});
  const me0=await p.evaluate(()=>STT.meT);
  await p.evaluate(()=>{ __say('Alpha Bravo Charlie, Moorabbin Tower, cleared to enter the control zone via Carrum, not above one thousand five hundred, squawk three four zero one'); __say('Not above one thousand five hundred, squawk three four one zero, Alpha Bravo Charlie'); });
  r=await p.evaluate(()=>{ const L=STT.log, x=L[L.length-1]; return {rb:x.rb, me:STT.meT, log:$('sttLog').innerText.split('\n')[0], row:$('sStt').innerText}; });
  ok(r.rb&&!r.rb.ok&&/squawk 3410 \(cleared 3401\)/.test(r.rb.txt)&&/Read-back: squawk 3410/.test(r.log)&&/Read-back/.test(r.row),`wrong squawk read back: "${r.rb&&r.rb.txt}" on the log line and the RADIO row`);
  await p.evaluate(()=>{ __say('Alpha Bravo Charlie, turn right heading two seven zero, climb to two thousand five hundred'); __say('Right heading two seven zero, climb two thousand five hundred, Alpha Bravo Charlie'); });
  r=await p.evaluate(()=>STT.log[STT.log.length-1].rb); ok(r&&r.ok&&r.txt==='Read-back ✓','correct read-back: '+(r&&r.txt));
  await p.evaluate(()=>{ __say('Alpha Bravo Charlie, contact Melbourne Centre one three five decimal seven, QNH one zero one one'); __say('One three five decimal seven, Alpha Bravo Charlie'); });
  r=await p.evaluate(()=>STT.log[STT.log.length-1].rb); ok(r&&!r.ok&&/missed QNH 1011/.test(r.txt)&&!/frequency/.test(r.txt),'missed item: '+(r&&r.txt));
  r=await p.evaluate(()=>{ const n=STT.log.length; __say('Alpha Bravo Charlie, squawk four five two one'); STT.rb.t-=31e3; __say('Squawk four five two one, Alpha Bravo Charlie'); return STT.log[STT.log.length-1].rb; });
  ok(!r,'after 30 s it is not taken as a read-back');
  await p.evaluate(()=>{ $('sttRb').checked=false; $('sttRb').onchange(); __say('Alpha Bravo Charlie, squawk four five two two'); __say('Squawk four five two three, Alpha Bravo Charlie'); });
  r=await p.evaluate(()=>({rb:STT.log[STT.log.length-1].rb, v:ls.get('sttRb')})); ok(!r.rb&&r.v===false,'Check my read-back off: no check');
  await p.evaluate(()=>sttSet(false));
  // ---- hover performance: YBRS plan, Bell 206B (weighed) profile, a made-up hover table, OAT 30 °C, no briefing
  await p.setInputFiles('#fpFile',__dirname+'/fixtures/ybrs.gpx'); await p.waitForFunction(()=>FP&&FP.pts.length>5);
  await p.evaluate(()=>{ WB.profiles=[]; const P=wbFromTpl('b206bw'); P.hige='0,1451\n4000,1420\n8000,1300'; P.hoge='0,1350\n4000,1250\n8000,1100'; WB.profiles.push(P); WB.cur=P.id;
    WB.load[P.id]=P.st.map(s=>/pilot/i.test(s.n)?85:s.k==='fuel'?300:0); wbSave(); ls.set('pcOat',30); ls.set('pcBurn',90); ls.set('pcGs',100); ls.set('pcWsrc','none'); });
  await p.evaluate(()=>$('fpCheck').onclick()); await p.waitForTimeout(800);
  r=await p.evaluate(()=>{ const S=wbSummary(), sec=[...$('pcOut').querySelectorAll('.pc-sec')].find(e=>/Hover performance/.test(e.textContent)), tb=sec&&sec.nextElementSibling;
    const rows=tb? [...tb.querySelectorAll('tr')].map(t=>({c:t.className, t:t.innerText.replace(/\s+/g,' ')})) : []; const H=hpRows(pcDepMs(ls.get('pcDep',{}).v||''),100,null);
    return {sec:!!sec, rows, w0:S&&S.r.to.w, H:H.rows.map(x=>({n:x.name,da:x.da,pa:x.pa,w:x.w,ige:x.ige,oge:x.oge,T:x.W.T,Ts:x.W.Ts,Qs:x.W.Qs,elev:x.elev,t:x.t})), txt:/Hover performance/.test(PC.text)}; });
  const d0=r.H[0], last=r.H[r.H.length-1], da=e=>{ const pa=e+(1013.25-1013)*30; return Math.round((pa+118.8*(30-(15-1.98*pa/1000)))/10)*10; };
  ok(r.sec&&r.H.length>=2&&d0.n==='YBRS'&&d0.da===da(d0.elev)&&d0.Ts==='OAT entered'&&d0.Qs==='assumed 1013'&&Math.abs(d0.w-r.w0)<0.01&&r.txt,`departure ${d0.n}: elev ${d0.elev}, OAT 30 °C, QNH assumed 1013 → DA ${d0.da} ft, weight ${d0.w.toFixed(1)} kg = take-off`);
  const burnt=90*0.815*(last.t-d0.t)/3600e3, ige=t=>{ const T=[[0,1451],[4000,1420],[8000,1300]]; for(let i=1;i<T.length;i++) if(t<=T[i][0]) return T[i-1][1]+(T[i][1]-T[i-1][1])*(t-T[i-1][0])/(T[i][0]-T[i-1][0]); };
  ok(Math.abs(last.w-(r.w0-burnt))<0.5&&Math.abs(d0.ige-ige(d0.da))<0.01&&r.rows.length===r.H.length,`landing ${last.n} after ${((last.t-d0.t)/60e3).toFixed(0)} min: weight ${last.w.toFixed(1)} (−${burnt.toFixed(1)} kg fuel); IGE max at DA ${d0.da} = ${d0.ige.toFixed(1)} · rows: ${r.rows.map(x=>x.c||'ok').join(',')}`);
  await p.evaluate(()=>{ const sec=[...$('pcOut').querySelectorAll('.pc-sec')].find(e=>/Hover performance/.test(e.textContent)); sec.scrollIntoView(); });
  await p.locator('#pcDlg').screenshot({path:__dirname+'/atisrb_hover.png'});
  // over the limit: heavy load, hot -> red row; DA outside the table -> red "outside your table"
  await p.evaluate(()=>{ const P=wbCur(); P.hoge='0,1100\n4000,1000'; wbSave(); ls.set('pcOat',45); $('pcOat').value=45; pcRun(); });
  r=await p.evaluate(()=>{ const sec=[...$('pcOut').querySelectorAll('.pc-sec')].find(e=>/Hover performance/.test(e.textContent)); return [...sec.nextElementSibling.querySelectorAll('tr')].map(t=>({c:t.className, t:t.innerText.replace(/\s+/g,' ')})); });
  ok(r[0].c==='w'&&/OGE max [\d,]+ · over by/.test(r[0].t),'OGE limit under the weight: row red, "over by": '+r[0].t.slice(0,150));
  await p.evaluate(()=>{ ls.set('pcOat',null); $('pcOat').value=''; pcRun(); });
  r=await p.evaluate(()=>{ const sec=[...$('pcOut').querySelectorAll('.pc-sec')].find(e=>/Hover performance/.test(e.textContent)); return sec.nextElementSibling.querySelector('tr').innerText; });
  ok(/no temperature: enter the OAT/.test(r),'no TAF, METAR or OAT: says to enter the OAT');
  await p.evaluate(()=>{ $('pcDlg').close(); $('bWb')&&0; });
  console.log(fail.length? fail.length+' FAILED':'all passed'); console.log(errs); await b.close(); process.exit(fail.length?1:0); })();
