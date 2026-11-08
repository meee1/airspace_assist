// Google Drive from two phones: one shared "Radio Calls AU" folder (found by name, not remembered per phone); duplicate
// folders from older versions are merged into the oldest (logbook rows taken in, newer settings backup kept, flights moved,
// duplicates and the empty folder to the bin); a second phone's Logbook.csv keeps the first phone's legs and vice versa.
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
const H={'Access-Control-Allow-Origin':'*'}, files={}, log=[]; let nid=0;
const HDR='Date (local),Aircraft,Type,From,To,Off UTC,On UTC,Off local,On local,Airborne h:mm,Airborne hrs,Day hrs,Night hrs,Landings,Distance NM,Max alt ft\n';
// two folders from the old one-folder-per-phone behaviour
files.A={name:'Radio Calls AU',dir:true,parent:'root'}; files.B={name:'Radio Calls AU',dir:true,parent:'root'};
files.a1={name:'Logbook.csv',parent:'A',body:HDR+'2026-10-01,VH-ABC,,YBRS,YMMB,00:00,01:00,10:00,11:00,1:00,1.0,1.0,0.0,1,40.0,2500\n'};
files.a2={name:'Settings backup.json',parent:'A',body:'{"app":"Radio Calls AU","t":"2026-10-01T00:00:00Z","keys":{"rc_x":"\\"old\\""}}',mt:'2026-10-01T00:00:00Z'};
files.a3={name:'Flight 2026-10-01 1000.gpx',parent:'A',body:'<gpx/>'}; files.a4={name:'Flight 2026-10-05 0900.gpx',parent:'A',body:'<gpx/>'};
files.b1={name:'Logbook.csv',parent:'B',body:HDR+'2026-10-05,VH-ABC,,YMMB,YLIL,23:00,23:30,09:00,09:30,0:30,0.5,0.5,0.0,2,20.0,1500\n'};
files.b2={name:'Settings backup.json',parent:'B',body:'{"app":"Radio Calls AU","t":"2026-10-06T00:00:00Z","keys":{"rc_x":"\\"new\\""}}',mt:'2026-10-06T00:00:00Z'};
files.b3={name:'Flight 2026-10-05 0900.gpx',parent:'B',body:'<gpx/>'}; files.b4={name:'Flight 2026-10-06 1400.gpx',parent:'B',body:'<gpx/>'};
async function phone(b,name,legs){ const ctx=await b.newContext({...PX9}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await ctx.route('https://accounts.google.com/gsi/client',r=>r.fulfill({contentType:'text/javascript',body:`window.google={accounts:{oauth2:{initCodeClient(o){ return {requestCode(){ setTimeout(()=>o.callback({code:'C'}),30); }}; }}}};`}));
 await ctx.route('https://test.mission.workers.dev/gauth',r=>r.request().method()==='GET'? r.fulfill({headers:H,json:{client_id:'CID'}}) : r.fulfill({headers:H,json:{access_token:'AT',expires_in:3600,refresh_token:'RT'}}));
 await ctx.route('https://www.googleapis.com/**',async r=>{ const q=r.request(), u=new URL(q.url());
   if(u.pathname==='/drive/v3/about') return r.fulfill({headers:H,json:{user:{emailAddress:'pilot@example.com'}}});
   if(u.pathname==='/drive/v3/files'&&q.method()==='POST'){ const id='D'+(++nid); files[id]={name:JSON.parse(q.postData()).name,dir:true,parent:'root'}; log.push(name+' mkdir'); return r.fulfill({headers:H,json:{id}}); }
   if(u.pathname==='/drive/v3/files'&&q.method()==='GET'){ const Q=u.searchParams.get('q')||'', nm=/name='([^']+)'/.exec(Q), mt=/mimeType='([^']+)'/.exec(Q), par=/'([^']+)' in parents/.exec(Q);
     const f=Object.entries(files).filter(([,v])=>!v.trashed&&(!nm||v.name===nm[1])&&(!mt||!!v.dir)&&(!par||v.parent===par[1]));
     return r.fulfill({headers:H,json:{files:f.map(([id,v])=>({id,name:v.name,modifiedTime:v.mt||'2026-01-01T00:00:00Z',createdTime:'x'}))}}); }
   let m=u.pathname.match(/^\/drive\/v3\/files\/([^/]+)$/);
   if(m&&q.method()==='PATCH'){ const F=files[m[1]], b_=JSON.parse(q.postData()||'{}'); if(b_.trashed){ F.trashed=true; log.push(name+' trash '+F.name+' ('+m[1]+')'); }
     if(u.searchParams.get('addParents')){ F.parent=u.searchParams.get('addParents'); log.push(name+' move '+F.name); } return r.fulfill({headers:H,json:{id:m[1]}}); }
   if(m&&u.searchParams.get('alt')==='media') return r.fulfill({headers:H,body:files[m[1]].body});
   if(m) return r.fulfill({headers:H,json:{id:m[1],trashed:!!(files[m[1]]||{}).trashed}});
   if(u.pathname==='/upload/drive/v3/files'&&q.method()==='POST'){ const body=q.postData(), meta=JSON.parse(body.split('\r\n\r\n')[1].split('\r\n')[0]); const id='F'+(++nid); files[id]={name:meta.name,parent:meta.parents[0],body:body.split('\r\n\r\n')[2].replace(/\r\n--\w+--$/,'')}; log.push(name+' create '+meta.name); return r.fulfill({headers:H,json:{id}}); }
   m=u.pathname.match(/^\/upload\/drive\/v3\/files\/([^/]+)$/); if(m){ files[m[1]].body=q.postData(); files[m[1]].mt=new Date().toISOString(); log.push(name+' update '+files[m[1]].name); return r.fulfill({headers:H,json:{id:m[1]}}); }
   r.fulfill({status:400,headers:H,json:{error:{message:'unexpected'}}}); });
 await p.goto('http://localhost:8811/index.html'); await p.waitForFunction(()=>typeof render==='function'&&LOGDB.db); await p.waitForTimeout(300);
 await p.evaluate(legs=>{ ls.set('gdAuto',false); GD.auto=false; $('cSign').value='VH-ABC'; for(const [k,v] of Object.entries(legs)) LOGBK[k]=v; ls.set('logbook',LOGBK); },legs);
 await p.evaluate(()=>$('bOpts').click()); await p.waitForTimeout(500); await p.click('#gdConnect'); await p.waitForTimeout(2000);
 return {p, errs, stat:await p.evaluate(()=>(GD.err||GD.msg))}; }
const live=()=>Object.entries(files).filter(([,v])=>!v.trashed);
const show=()=>{ const dirs=live().filter(([,v])=>v.dir); return dirs.map(([id])=>`${id}: `+live().filter(([,v])=>v.parent===id).map(([,v])=>v.name).sort().join(', ')).join(' || '); };
(async()=>{ const b=await chromium.launch(); const t1=Date.parse('2026-11-02T00:00:00Z'), t2=Date.parse('2026-11-03T02:00:00Z');
 const A=await phone(b,'phone1',{[t1]:{off:t1,on:t1+3600e3,from:'YBRS',to:'YTQY',ldg:1,night:0,nm:15,hi:1500,ac:'VH-ABC'}});
 console.log('phone 1:', A.stat); console.log('  folders:', show());
 console.log('  log:', log.join('; ')); log.length=0;
 const L=live().find(([,v])=>v.name==='Logbook.csv')[1].body.trim().split('\n').slice(1).map(r=>r.split(',').slice(0,5).join(' ')); console.log('  Logbook.csv:', L.join(' | '));
 console.log('  backup kept:', JSON.parse(live().find(([,v])=>v.name==='Settings backup.json')[1].body).t.slice(0,10), '(phone 1 then rewrote it)');
 const B=await phone(b,'phone2',{[t2]:{off:t2,on:t2+1800e3,from:'YMMB',to:'YLIL',ldg:1,night:0,nm:20,hi:1500,ac:'VH-ABC'}});
 console.log('phone 2:', B.stat, '· folders now:', live().filter(([,v])=>v.dir).length, '· log:', log.join('; ')); log.length=0;
 console.log('  Logbook.csv rows:', live().find(([,v])=>v.name==='Logbook.csv')[1].body.trim().split('\n').length-1);
 await A.p.evaluate(()=>{ const t=Date.parse('2026-11-04T00:00:00Z'); LOGBK[t]={off:t,on:t+1200e3,from:'YBRS',to:'YBRS',ldg:3,night:0,nm:5,hi:1000,ac:'VH-ABC'}; ls.set('logbook',LOGBK); }); await A.p.click('#gdNow'); await A.p.waitForTimeout(1200);
 const rows=live().find(([,v])=>v.name==='Logbook.csv')[1].body.trim().split('\n').slice(1).map(r=>r.split(',')[0]+' '+r.split(',')[3]+'-'+r.split(',')[4]);
 console.log('phone 1 saves again: rows', rows.length, '·', rows.join(' | '), '· has phone 2 leg', rows.some(r=>/YMMB-YLIL/.test(r)&&/2026-11-03/.test(r)));
 console.log([...A.errs,...B.errs]); await b.close(); })();
