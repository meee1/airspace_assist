// ATIS letter + clearance notes, altitude-coloured log, plan check fuel/NOTAMs by leg, logbook edits/totals, replay
const fs=require('fs'); const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({...PX9,acceptDownloads:true,storageState:{cookies:[],origins:[{origin:'http://localhost:8811',localStorage:[{name:'rc_fsMap',value:'true'}]}]}});
 await ctx.addInitScript(()=>{ const D=Date, off=D.parse('2026-11-01T01:30:00Z')-D.now(); window.Date=class extends D{ constructor(...a){ super(...(a.length?a:[D.now()+off])); } static now(){ return D.now()+off; } }; });
 const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message+' '+(e.stack||'').split('\n')[1]));
 await p.goto('http://localhost:8811/index.html?sim=YBRS&alt=1500&trk=000&gs=90'); await p.waitForFunction(()=>typeof render==='function'&&LOGDB.db); await p.waitForTimeout(1000);
 await p.evaluate(()=>{ $('cType').value='Bell 206'; $('cSign').value='ABC'; });
 // ---- 1+2: approaching Moorabbin from the west, Go to YMMB
 await p.evaluate(()=>{ const a=DATA.ap.find(x=>x.i==='YMMB'); setGo({k:'AD',c:'YMMB',n:a.n,la:a.la,lo:a.lo}); $('simPos').value='-38.02,145.20'; $('simTrk').value='290'; simApply(); render(); render(); });
 console.log('NEXT before', await p.evaluate(()=>$('sNxCls').innerText.replace(/\n/g,' ')));
 await p.click('#sNxCls'); await p.waitForTimeout(200); if(await p.evaluate(()=>$('sNxCls').hasAttribute('data-zb'))) await p.click('#sNxCls');   // the first tap enlarges the tile
 await p.waitForTimeout(300);
 console.log('dialog', await p.evaluate(()=>$('clrDlg').open+' '+$('clrAtisLbl').textContent+' letters '+$('clrAtis').children.length));
 await p.click('#clrAtis [data-l="C"]'); await p.fill('#clrSq','4123'); await p.fill('#clrLvl','A015'); await p.fill('#clrRt','via CARR, report BTO');
 await (await p.$('#clrDlg')).screenshot({path:'play/f6_dlg.png'}); await p.click('#clrOk');
 console.log('NEXT after', await p.evaluate(()=>{ render(); return $('sNxCls').innerText.replace(/\n/g,' '); }));
 console.log('CLR row', await p.evaluate(()=>$('sClr').hidden?'-':$('sClr').innerText.replace(/\n/g,' ')));
 console.log('clearance call', await p.evaluate(()=>{ const c=[...document.querySelectorAll('#callsList .call')].map(e=>e.innerText).find(t=>/CLEARANCE REQUEST/.test(t)); return c? c.replace(/\n/g,' ').slice(0,200) : 'none'; }));
 await (await p.$('#hudA')).screenshot({path:'play/f6_hud.png'});
 // into the zone and out again
 console.log('in zone', await p.evaluate(()=>{ $('simPos').value='-37.98,145.06'; $('simAlt').value='1000'; simApply(); render(); return (st.curBand&&st.curBand.k)+' clr '+!$('sClr').hidden; }));
 console.log('out 1 min', await p.evaluate(()=>{ $('simPos').value='-38.20,145.40'; simApply(); render(); return !$('sClr').hidden; }));
 console.log('out 3 min', await p.evaluate(()=>{ CLR.leftT=Date.now()-180e3; render(); return !$('sClr').hidden+' atis kept '+atisOf('YMMB'); }));
 console.log('controlled row', await p.evaluate(()=>{ $('simPos').value='-37.98,145.06'; simApply(); render(); return $('sCtl').innerText.replace(/\n/g,' '); }));
 // ---- 3: log colour by altitude (sim track)
 await p.evaluate(()=>{ SIMT.length=0; MAP.log=true; $('logLeg').hidden=false; GO=null; const t0=Date.now(); for(let i=0;i<60;i++){ SIMT.push([t0-60e3+i*1000,-38.20+i*0.002,144.40+i*0.002,300+i*90]); } $('simPos').value=(-38.20+0.12)+','+(144.40+0.12); $('simAlt').value='5700'; MAP.range=10; simApply(); render(); });
 await p.waitForTimeout(500); await p.screenshot({path:'play/f6_log.png'});
 // ---- 4: plan check with fuel and NOTAMs by leg
 const OBS=fs.readFileSync(__dirname+'/fixtures/naips_sua.txt','utf8');
 await p.evaluate(t=>{ nbLoad(t); fpSet({name:'YBRS-YMAV-YMMB-YLIL',kind:'map',i:0,pts:['YBRS','YMAV','YMMB','YLIL'].map(c=>{ const q=findPoint(c); return {la:q.la,lo:q.lo,c:q.c||c,n:q.n}; })}); },OBS);
 await p.evaluate(()=>{ $('fpCheck').click(); $('pcBurn').value='100'; $('pcFuel').value='120'; $('pcRun').click(); }); await p.waitForTimeout(2500);
 console.log('plan', await p.evaluate(()=>PC.text.split('\n').filter(l=>/ATIS|Time and fuel|L left|Leg \d|Other/.test(l)).slice(0,14).join('\n')));
 await p.evaluate(()=>$('pcClose').click());
 // ---- 5: logbook
 await p.evaluate(()=>{ const A=DATA.ap.find(x=>x.i==='YBRS'), B=DATA.ap.find(x=>x.i==='YMMB'); const rows=[]; let t=Date.parse('2026-10-30T07:30:00Z'); const step=5e3;
  const seg=(a,b,n,gs,alt)=>{ for(let k=0;k<n;k++){ const f=k/n; rows.push([t,a.la+(b.la-a.la)*f,a.lo+(b.lo-a.lo)*f,alt,gs,30,5,null]); t+=step; } };
  seg(A,A,24,2,50); seg(A,B,500,95,1500); seg(B,B,60,0,40); seg(B,A,400,100,1500); seg(A,A,40,0,50); logDbAdd(rows); });   // ~42 min + ~33 min, landing after last light
 await p.waitForTimeout(400); await p.evaluate(()=>$('bOpts').click()); await p.waitForTimeout(900);
 console.log('logbook', await p.evaluate(()=>$('optsLogs').innerText.replace(/\n+/g,' | ').slice(0,420)));
 await p.click('[data-ed="0:0"]'); await p.waitForTimeout(200); await p.fill('.lgedit [data-k="ldg"]','3'); await p.click('.lgedit [data-a="save"]'); await p.waitForTimeout(500);
 await p.click('[data-ed="0:0"]'); await p.waitForTimeout(200); await p.click('.lgedit [data-a="merge"]'); await p.waitForTimeout(500);
 console.log('after edit+merge', await p.evaluate(()=>$('optsLogs').innerText.replace(/\n+/g,' | ').slice(0,420)));
 await (await p.$('#optsLogs')).screenshot({path:'play/f6_logbook.png'});
 const [d]=await Promise.all([p.waitForEvent('download'),p.click('[data-csv="all"]')]); await d.saveAs('play/f6_logbook.csv'); console.log(fs.readFileSync('play/f6_logbook.csv','utf8'));
 // ---- 6: replay from the flight log
 const before=await p.evaluate(()=>TLOG.pts.length);
 await p.click('[data-rp="0"]'); await p.waitForTimeout(400);
 console.log('replay loaded', await p.evaluate(()=>$('rpStat').textContent+' | sim '+st.sim+' | '+$('rpTime').textContent));
 await p.evaluate(()=>{ $('rpSpd').value='10'; $('rpSpd').dispatchEvent(new Event('change')); $('rpPlay').click(); }); await p.waitForTimeout(3000);
 console.log('after 3 s at 10x', await p.evaluate(()=>$('rpTime').textContent+' | pos '+st.pos.map(x=>x.toFixed(4))+' gs '+Math.round(st.gs)+' trk '+Math.round(st.trk)+' | CTAF '+$('sCtaf').textContent));
 await p.evaluate(()=>{ $('rpPos').value=String(+$('rpPos').max*0.9); $('rpPos').dispatchEvent(new Event('input')); }); console.log('scrub 90%', await p.evaluate(()=>$('rpTime').textContent+' | '+$('sCtafLbl').textContent+' '+$('sCtaf').textContent+' '+$('sCtafAd').textContent));
 await p.evaluate(()=>$('rpPlay').click()); console.log('log untouched', before===await p.evaluate(()=>TLOG.pts.length));
 // file replay
 fs.writeFileSync('/tmp/claude-0/rp.gpx', await p.evaluate(()=>{ const rows=[]; let t=Date.parse('2026-10-30T02:00:00Z'); for(let i=0;i<200;i++){ rows.push([t,-38.25+i*0.001,144.43+i*0.0005,1500,90,20,5,null]); t+=5000; } return fpLogGpx(rows,'t'); }));
 await p.setInputFiles('#rpFile','/tmp/claude-0/rp.gpx'); await p.waitForTimeout(400); console.log('gpx file', await p.evaluate(()=>$('rpStat').textContent));
 console.log(errs); await b.close(); })();
