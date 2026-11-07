// Logbook CSV has every leg ever logged: legs older than the 90-day fix log (the permanent summary) are in the Options CSV and
// in Drive's Logbook.csv; an existing Logbook.csv in Drive (another phone) is taken in once, without duplicating legs already here.
const {chromium}=require('playwright'); const {PX9}=require('./px9.js'); const os=require('os'), path=require('path'), fs=require('fs');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({...PX9,acceptDownloads:true}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 const files={}; let nid=0; const h={'Access-Control-Allow-Origin':'*'};
 await ctx.route('https://accounts.google.com/gsi/client',r=>r.fulfill({contentType:'text/javascript',body:`window.google={accounts:{oauth2:{initCodeClient(o){ return {requestCode(){ setTimeout(()=>o.callback({code:'C'}),30); }}; }}}};`}));
 await ctx.route('https://test.mission.workers.dev/gauth',r=>r.request().method()==='GET'? r.fulfill({headers:h,json:{client_id:'CID'}}) : r.fulfill({headers:h,json:{access_token:'AT1',expires_in:3600,refresh_token:'RT'}}));
 await ctx.route('https://www.googleapis.com/**',async r=>{ const q=r.request(), u=new URL(q.url());
   if(u.pathname==='/drive/v3/about') return r.fulfill({headers:h,json:{user:{emailAddress:'pilot@example.com'}}});
   if(u.pathname==='/drive/v3/files'&&q.method()==='POST'){ const id='dir'+(++nid); files[id]={name:'folder'}; return r.fulfill({headers:h,json:{id}}); }
   if(u.pathname==='/drive/v3/files'&&q.method()==='GET'){ const nm=/name='([^']+)'/.exec(u.searchParams.get('q')||''); return r.fulfill({headers:h,json:{files:Object.entries(files).filter(([,v])=>nm&&v.name===nm[1]).map(([id])=>({id}))}}); }
   let m=u.pathname.match(/^\/drive\/v3\/files\/([^/]+)$/);
   if(m&&u.searchParams.get('alt')!=='media') return files[m[1]]? r.fulfill({headers:h,json:{id:m[1],trashed:false}}) : r.fulfill({status:404,headers:h,json:{error:{message:'nf'}}});
   if(m) return files[m[1]]? r.fulfill({headers:h,body:files[m[1]].body||'',contentType:'text/plain'}) : r.fulfill({status:404,headers:h,json:{error:{message:'nf'}}});
   if(u.pathname==='/upload/drive/v3/files'&&q.method()==='POST'){ const body=q.postData(), meta=JSON.parse(body.split('\r\n\r\n')[1].split('\r\n')[0]); const id='f'+(++nid); files[id]={name:meta.name,body:body.split('\r\n\r\n')[2].replace(/\r\n--\w+--$/,'')}; return r.fulfill({headers:h,json:{id}}); }
   m=u.pathname.match(/^\/upload\/drive\/v3\/files\/([^/]+)$/); if(m&&files[m[1]]){ files[m[1]].body=q.postData(); return r.fulfill({headers:h,json:{id:m[1]}}); }
   r.fulfill({status:400,headers:h,json:{error:{message:'unexpected'}}}); });
 await p.goto('http://localhost:8811/index.html'); await p.waitForFunction(()=>typeof render==='function'&&LOGDB.db); await p.waitForTimeout(400);
 // a recent flight in the fix log; a leg from 200 days ago only in the permanent summary
 const recentOff=await p.evaluate(()=>{ ls.set('gdAuto',false); GD.auto=false; $('cSign').value='VH-ABC'; const A=DATA.ap.find(x=>x.i==='YBRS'), B=DATA.ap.find(x=>x.i==='YMMB'); const rows=[]; let t=Date.now()-86400e3;
  const seg=(a,b,n,gs,alt)=>{ for(let k=0;k<n;k++){ const f=k/n; rows.push([t,a.la+(b.la-a.la)*f,a.lo+(b.lo-a.lo)*f,alt(f),gs,30,5,null]); t+=5e3; } };
  seg(A,A,24,2,()=>50); seg(A,B,360,95,f=>200+2300*Math.sin(Math.PI*f)); seg(B,B,60,0,()=>40); logDbAdd(rows);
  const old=Date.now()-200*86400e3; LOGBK[String(old)]={off:old,on:old+3600e3,from:'YBRS',to:'YLIL',ldg:2,night:0,nm:80,hi:3000,ac:'VH-OLD',ty:'B06'}; ls.set('logbook',LOGBK); return 0; });
 await p.waitForTimeout(400); await p.evaluate(()=>$('bOpts').click()); await p.waitForTimeout(800);
 const legs=await p.evaluate(()=>logbookLegs().map(l=>new Date(l.off).toISOString().slice(0,10)+' '+l.from+'-'+l.to+' '+(l.ac||'')));
 console.log('summary:', legs.join(' | ')); console.log('label:', await p.evaluate(()=>$('optsLogs').querySelector('label small').textContent));
 const dl=p.waitForEvent('download'); await p.click('#optsLogs [data-csv="all"]'); const d=await dl, fp=path.join(os.tmpdir(),d.suggestedFilename()); await d.saveAs(fp);
 console.log('Options CSV:', d.suggestedFilename(), (fs.readFileSync(fp,'utf8').trim().split('\n').length-1)+' rows');
 // Drive already has a Logbook.csv from another phone: one row a year ago (quoted field), one duplicating the recent leg
 const rec=await p.evaluate(()=>{ const l=logbookLegs().slice(-1)[0], d=new Date(l.off), z=n=>String(n).padStart(2,'0'); return {date:`${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`,off:`${z(d.getHours())}:${z(d.getMinutes())}`,on:new Date(l.on).toTimeString().slice(0,5)}; });
 const yr=new Date(Date.now()-365*86400e3), yd=yr.toISOString().slice(0,10);
 files.dirX={name:'folder'}; files.lb={name:'Logbook.csv',body:'Date (local),Aircraft,Type,From,To,Off UTC,On UTC,Off local,On local,Airborne h:mm,Airborne hrs,Day hrs,Night hrs,Landings,Distance NM,Max alt ft\n'+
   `${yd},VH-XYZ,"Bell 206B, JetRanger",YMMB,YBRS,00:00,01:30,10:00,11:30,1:30,1.5,1.0,0.5,3,55.0,2500\n${rec.date},VH-ABC,,YBRS,YMMB,00:00,00:00,${rec.off},${rec.on},0:30,0.5,0.5,0.0,1,40.0,2500\n`};
 await p.click('#gdConnect'); await p.waitForTimeout(2500); console.log('stat', await p.evaluate(()=>GD.err+' / '+GD.msg));
 const lb=Object.values(files).filter(f=>f.name==='Logbook.csv'); console.log('Logbook.csv files in Drive:', lb.length);
 const rows=lb[0].body.trim().split('\n').slice(1); console.log('Drive Logbook.csv', rows.length, 'rows:'); rows.forEach(r=>console.log('  ', r.slice(0,110)));
 console.log('taken in:', await p.evaluate(()=>{ const v=Object.values(LOGBK).find(v=>v.ac==='VH-XYZ'); return v&&`${v.from}-${v.to} ${(v.on-v.off)/60e3} min night ${v.night} ldg ${v.ldg} ty "${v.ty}"`; }), '· flag', await p.evaluate(()=>ls.get('gdLbIn')));
 files.lb.body+='2020-01-01,VH-NEW,,YAAA,YBBB,00:00,01:00,10:00,11:00,1:00,1.0,1.0,0.0,1,10.0,1000\n';
 await p.click('#gdNow'); await p.waitForTimeout(1200); console.log('second save takes in again?', await p.evaluate(()=>Object.values(LOGBK).some(v=>v.ac==='VH-NEW'))? 'yes':'no (once only)', '· rows', lb[0].body.trim().split('\n').length-1);
 console.log(errs); await b.close(); })();
