// Share a plan: the link carries the plan (points, leg altitudes, land / overfly), a QR code of it is drawn, opening the
// link on another phone asks and then loads the same plan with AIP labels rebuilt; a damaged or hostile link changes nothing;
// saved plans have Share too; the GPX from the dialog is the shared plan's. The QR picture is saved as play/share_qr.png
// (decoded once with OpenCV when this was written: it reads back as the link).
const {chromium}=require('playwright'); const {PX9}=require('./px9.js'); const fs=require('fs');
(async()=>{ const b=await chromium.launch(); require('./classic.js')(b); const ctx=await b.newContext({...PX9,acceptDownloads:true}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YBRS&alt=1500&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(500);
 await p.evaluate(()=>{ WPTS=[{id:'w1',n:'FUEL DRUM',note:'Behind the shed',la:-38.2,lo:144.5,t:1}]; wpStore();
   fpSet({name:'Home <b>run</b>',kind:'map',pts:[fpPt(findPoint('YBRS')),fpPt(wpPt(WPTS[0])),fpPt(findPoint('CARR')),{n:'38°05.00\'S 145°00.00\'E',la:-38.0833,lo:145,desc:'x'},fpPt(findPoint('YMMB'))],i:1});
   FP.pts[2].alt=2500; FP.pts[4].land=false; ls.set('fp',FP); });
 await p.click('#fpShare'); await p.waitForFunction(()=>!$('shQr').hidden,undefined,{timeout:10000});
 const link=await p.inputValue('#shLink'); console.log('link', link.length, 'chars ·', link.slice(0,60)+'…', '·', await p.textContent('#shSum'));
 const qr=await p.evaluate(()=>{ const c=$('shQr'), d=c.getContext('2d').getImageData(0,0,c.width,c.height).data; let dark=0; for(let i=0;i<d.length;i+=4) if(d[i]<128) dark++; return {px:c.width, dark:+(dark/(d.length/4)).toFixed(2), url:c.toDataURL()}; });
 fs.writeFileSync('play/share_qr.png',Buffer.from(qr.url.split(',')[1],'base64'));
 console.log('qr', qr.px+'px', 'dark share', qr.dark); if(!(qr.dark>0.25&&qr.dark<0.6)) errs.push('QR looks wrong');
 await p.screenshot({path:'play/share_dlg.png'});
 const dl=p.waitForEvent('download'); await p.click('#shGpx'); const d=await dl; const gpx=fs.readFileSync(await d.path(),'utf8'); console.log('gpx', d.suggestedFilename(), (gpx.match(/<rtept/g)||[]).length, 'points');
 // another phone (fresh storage, no waypoints of its own) opens the link
 const c2=await b.newContext(PX9), q=await c2.newPage(); q.on('pageerror',e=>errs.push(e.message)); let asked='';
 q.on('dialog',dg=>{ asked=dg.message(); dg.accept(); });
 await q.goto(link.replace(/^https?:\/\/[^/]+\/[^#]*/,'http://localhost:8811/index.html?sim=YBRS&alt=1500&trk=000&gs=0')); await q.waitForFunction(()=>typeof render==='function'); await q.waitForFunction(()=>FP&&FP.kind==='shared',undefined,{timeout:8000});
 console.log('asked:', asked.replace(/\n+/g,' / '));
 const got=await q.evaluate(()=>JSON.stringify({name:FP.name, hash:location.hash, pts:FP.pts.map(x=>[x.c||'-',x.n,x.la.toFixed(4),x.lo.toFixed(4),x.alt??'',x.land??'',x.desc])}));
 console.log('loaded:', got);
 const G=JSON.parse(got); if(G.pts.length!==5||G.pts[2][4]!==2500||G.pts[4][5]!==false||G.pts[0][0]!=='YBRS'||G.hash) errs.push('plan did not arrive intact');
 console.log('name shown safely:', await q.evaluate(()=>$('fpSum').innerHTML.includes('<b>')? 'HTML RAN' : $('fpSum').textContent.slice(0,40)));
 // declined: nothing changes; damaged and hostile links: refused
 q.removeAllListeners('dialog'); q.once('dialog',dg=>dg.dismiss());
 await q.evaluate(l=>{ FP.name='mine'; location.hash=l.split('#')[1]; },link); await q.waitForTimeout(400); console.log('declined:', await q.evaluate(()=>FP.name+' '+location.hash));
 for(const [nm,h] of [['damaged','plan=abc123'],['too many points','plan='+Buffer.from(JSON.stringify([1,'x',Array(300).fill(['A',1,1])])).toString('base64url')],['bad lat','plan='+Buffer.from(JSON.stringify([1,'x',[['A',99e5,1],['B',1,1]]])).toString('base64url')],['wrong shape','plan='+Buffer.from(JSON.stringify({a:1})).toString('base64url')]]){
   await q.evaluate(h=>{ location.hash=h; },h); await q.waitForTimeout(300); console.log(nm+':', await q.evaluate(()=>FP.name+' · '+($('fpErr').hidden?'':$('fpErr').textContent))); }
 // saved plans have Share
 await p.click('#shClose'); await p.evaluate(()=>{ fplSaveCur('Home run'); fplOpen(); }); await p.click('#plList [data-a="share"]'); await p.waitForFunction(()=>!$('shQr').hidden);
 console.log('from saved plans:', (await p.inputValue('#shLink')).length, 'chars'); await p.screenshot({path:'play/share_plans.png'});
 console.log(errs); await b.close(); })();
