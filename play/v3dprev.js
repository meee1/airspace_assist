// 3D route preview: flies the plan (YBRS-YMMB-YLIL), progresses, ends at circuit height and stops; Go to fallback; More -> Logbook opens the logbook
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch({args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']}); const ctx=await b.newContext({...PX9,deviceScaleFactor:2}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{ try{ localStorage.setItem('rc_fsMap','false'); }catch(e){} });
 await p.goto('http://localhost:8811/index.html?sim=YBRS&alt=1500&trk=060&gs=0'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(1500);
 console.log('no plan:', await p.evaluate(()=>{ GO=null; v3dShow(true); v3dPreview(true); return $('v3dMsg').textContent; }));
 await p.evaluate(()=>{ const ap=i=>{ const x=DATA.ap.find(y=>y.i===i); return {n:i,c:i,la:x.la,lo:x.lo}; }; fpSet({name:'T',pts:['YBRS','YMMB','YLIL'].map(ap),i:1}); MAP.range=10; render(); });
 await p.waitForTimeout(800);
 console.log('path', await p.evaluate(()=>{ const q=v3dPath(); return q.pts.map(x=>`${x.n||'·'} ${Math.round(x.ft)}ft @${x.c.toFixed(1)}`).join(' | ')+' total '+q.L.toFixed(1); }));
 await p.selectOption('#v3dSpd','40'); await p.click('#v3dPlay'); const win=await p.$('#v3dWin');
 for(const [t,f] of [[2500,'a'],[5000,'b']]){ await p.waitForTimeout(t); const s=await p.evaluate(()=>{ const q=v3dPose(); return `${q.s.toFixed(1)} NM ${Math.round(q.ft)} ft hdg ${Math.round(q.hdg)} next ${q.next}`; }); console.log(f, s); await win.screenshot({path:`/tmp/claude-0/prev_${f}.png`}); }
 await p.selectOption('#v3dCam','chase'); await p.waitForTimeout(1500); await win.screenshot({path:'/tmp/claude-0/prev_c.png'});
 await p.evaluate(()=>{ V3.pv.s0=V3.pv.L-0.5; V3.pv.t0=performance.now(); }); await p.waitForTimeout(5500);
 console.log('dbg', await p.evaluate(()=>JSON.stringify({end:V3.pv&&V3.pv.end, now:performance.now(), s0:V3.pv&&V3.pv.s0, L:V3.pv&&V3.pv.L, msg:$('v3dMsg').textContent, raf:V3.raf, on:V3.on}))); console.log('after the end: preview', await p.evaluate(()=>!!V3.pv), 'button', await p.textContent('#v3dPlay'));
 console.log('go to only:', await p.evaluate(()=>{ FP=null; const x=DATA.ap.find(y=>y.i==='YMAV'); GO={la:x.la,lo:x.lo,c:'YMAV',n:'Avalon'}; const q=v3dPath(); return q? q.pts.map(x=>`${x.n||'·'} ${Math.round(x.ft)}`).join(' | ') : 'none'; }));
 await p.evaluate(()=>v3dShow(false));
 await p.evaluate(()=>{ $('moreCtl').scrollIntoView(); }); await p.click('#bLog'); await p.waitForTimeout(800);
 console.log('logbook: dialog open', await p.evaluate(()=>$('optsDlg').open), 'label in view', await p.evaluate(()=>{ const r=$('optsLogsLbl').getBoundingClientRect(); return r.top>=0&&r.top<innerHeight; }), 'text', await p.evaluate(()=>$('optsLogs').innerText.slice(0,60)));
 console.log(errs); await b.close(); })();
