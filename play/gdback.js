// Drive: flights logged before Drive was connected (and while it was disconnected) are uploaded when it's connected
// (21 Nov 2026, Michael: "Upload flights to Drive even if not connected later"). Google, the proxy and Drive mocked as in
// gdrive.js. node play/gdback.js   (app on :8811)
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({...PX9}); const p=await ctx.newPage(); const errs=[], fail=[]; const ok=(c,m)=>{ console.log((c?'ok   ':'FAIL ')+m); if(!c) fail.push(m); }; p.on('pageerror',e=>errs.push(e.message));
 const log=[], files={}; let nid=0, tokN=0;
 await ctx.route('https://accounts.google.com/gsi/client',r=>r.fulfill({contentType:'text/javascript',body:`window.google={accounts:{oauth2:{initCodeClient(o){ window.__gis=o; return {requestCode(){ setTimeout(()=>o.callback({code:'CODE1'}),30); }}; }}}};`}));
 await ctx.route('https://test.mission.workers.dev/gauth',async r=>{ const q=r.request(); const h={'Access-Control-Allow-Origin':'*'};
   if(q.method()==='GET'){ log.push('proxy GET'); return r.fulfill({headers:h,json:{client_id:'CID.apps.googleusercontent.com'}}); }
   const j=q.postDataJSON(); log.push('proxy '+(j.code?'code':j.revoke?'revoke':'refresh'));
   if(j.revoke) return r.fulfill({headers:h,json:{ok:true}});
   if(j.code) return r.fulfill({headers:h,json:{access_token:'AT'+(++tokN),expires_in:3600,refresh_token:'RT-secret'}});
   if(j.refresh_token!=='RT-secret') return r.fulfill({status:400,headers:h,json:{error:'bad',reauth:true}});
   return r.fulfill({headers:h,json:{access_token:'AT'+(++tokN),expires_in:3600}}); });
 await ctx.route('https://oauth2.googleapis.com/revoke**',r=>{ log.push('revoke'); r.fulfill({status:200,body:''}); });
 await ctx.route('https://www.googleapis.com/**',async r=>{ const q=r.request(), u=new URL(q.url()), auth=q.headers()['authorization']||'', h={'Access-Control-Allow-Origin':'*'};
   if(!/^Bearer AT\d+$/.test(auth)) return r.fulfill({status:401,headers:h,json:{error:{message:'no token'}}});
   const tag=auth.slice(7); if(globalThis.__deny&&tag===globalThis.__deny){ log.push('401 '+tag); return r.fulfill({status:401,headers:h,json:{error:{message:'Invalid Credentials'}}}); }
   if(u.pathname==='/drive/v3/about') return r.fulfill({headers:h,json:{user:{emailAddress:'pilot@example.com'}}});
   if(u.pathname==='/drive/v3/files'&&q.method()==='POST'){ const id='dir'+(++nid); files[id]={name:JSON.parse(q.postData()).name,dir:true,parent:'root'}; log.push('mkdir '+files[id].name); return r.fulfill({headers:h,json:{id}}); }
   if(u.pathname==='/drive/v3/files'&&q.method()==='GET'){ const Q=u.searchParams.get('q')||'', nm=/name='([^']+)'/.exec(Q), mt=/mimeType='([^']+)'/.exec(Q), par=/'([^']+)' in parents/.exec(Q);
     const f=Object.entries(files).filter(([,v])=>!v.trashed&&(!nm||v.name===nm[1])&&(!mt||(mt[1].endsWith('folder')?!!v.dir:!v.dir))&&(!par||v.parent===par[1])); return r.fulfill({headers:h,json:{files:f.map(([id,v])=>({id,name:v.name,modifiedTime:v.mt||'2026-01-01T00:00:00Z'}))}}); }
   let m=u.pathname.match(/^\/drive\/v3\/files\/([^/]+)$/);
   if(m&&u.searchParams.get('alt')==='media'){ const f=files[m[1]]; return f? r.fulfill({headers:h,body:f.body,contentType:'application/json'}) : r.fulfill({status:404,headers:h,json:{error:{message:'nf'}}}); }
   if(m&&q.method()==='PATCH'){ const F=files[m[1]]; if(!F) return r.fulfill({status:404,headers:h,json:{error:{message:'nf'}}}); const b=JSON.parse(q.postData()||'{}'); if(b.trashed){ F.trashed=true; log.push('trash '+F.name); }
     if(u.searchParams.get('addParents')){ F.parent=u.searchParams.get('addParents'); log.push('move '+F.name); } return r.fulfill({headers:h,json:{id:m[1]}}); }
   if(m){ return files[m[1]]? r.fulfill({headers:h,json:{id:m[1],trashed:!!files[m[1]].trashed}}) : r.fulfill({status:404,headers:h,json:{error:{message:'nf'}}}); }
   if(u.pathname==='/upload/drive/v3/files'&&q.method()==='POST'){ const body=q.postData(); const meta=JSON.parse(body.split('\r\n\r\n')[1].split('\r\n')[0]); const content=body.split('\r\n\r\n')[2].replace(/\r\n--\w+--$/,'');
     const id='f'+(++nid); files[id]={name:meta.name,parent:meta.parents[0],body:content,mime:meta.mimeType}; log.push(`create ${meta.name} (${tag})`); return r.fulfill({headers:h,json:{id}}); }
   m=u.pathname.match(/^\/upload\/drive\/v3\/files\/([^/]+)$/);
   if(m&&q.method()==='PATCH'){ if(!files[m[1]]) return r.fulfill({status:404,headers:h,json:{error:{message:'nf'}}}); files[m[1]].body=q.postData(); log.push(`update ${files[m[1]].name} (${tag})`); return r.fulfill({headers:h,json:{id:m[1]}}); }
   r.fulfill({status:400,headers:h,json:{error:{message:'unexpected '+q.method()+' '+u.pathname}}}); });
 await p.goto('http://localhost:8811/index.html'); await p.waitForFunction(()=>typeof render==='function'&&LOGDB.db); await p.waitForTimeout(500);
 // flights made before Drive was ever connected: 60 days and 3 days ago (YBRS -> YMMB, 30 min each)
 await p.goto('http://localhost:8811/index.html'); await p.waitForFunction(()=>typeof render==='function'&&LOGDB.db); await p.waitForTimeout(500);
 const fly=(daysAgo)=>p.evaluate(d=>{ ls.set('gdAuto',false); GD.auto=false; const A=DATA.ap.find(x=>x.i==='YBRS'), B=DATA.ap.find(x=>x.i==='YMMB'), rows=[]; let t=Date.now()-d*86400e3; const step=5e3;
   const seg=(a,b,n,gs,alt)=>{ for(let k=0;k<n;k++){ const f=k/n; rows.push([t,a.la+(b.la-a.la)*f,a.lo+(b.lo-a.lo)*f,alt(f),gs,30,5,null]); t+=step; } };
   seg(A,A,24,2,()=>50); seg(A,B,360,95,f=>200+2300*Math.sin(Math.PI*f)); seg(B,B,60,0,()=>40); logDbAdd(rows); },daysAgo);
 await fly(60); await fly(3); await p.waitForTimeout(400);
 await p.evaluate(()=>$('bOpts').click()); await p.waitForTimeout(800);
 await p.click('#gdConnect'); await p.waitForFunction(()=>!GD.busy&&gdOn(),null,{timeout:20000}); await p.waitForTimeout(1500);
 const gpx=()=>Object.values(files).filter(f=>/\.gpx$/.test(f.name)&&!f.trashed).map(f=>f.name).sort();
 let g=gpx(); ok(g.length===2,'connected: both earlier flights uploaded ('+g.join(', ')+')');
 // disconnect, fly again, connect again later
 await p.evaluate(()=>{ window.confirm=()=>true; }); await p.click('#gdOff'); await p.waitForTimeout(600); ok(await p.evaluate(()=>!gdOn()),'disconnected');
 await fly(1); await p.waitForTimeout(400); log.length=0;
 // reconnecting finds this phone's settings backup in Drive and asks to use it: OK applies it and reloads the page
 await p.evaluate(()=>{ window.confirm=()=>true; }); await p.click('#gdConnect');
 await p.waitForFunction(()=>typeof render==='function'&&window.GD&&gdOn()&&!ls.get('gdAfter',false),null,{timeout:30000}).catch(()=>{}); await p.waitForTimeout(500);
 await p.waitForFunction(()=>!GD.busy&&GD.done.size>=3,null,{timeout:20000}).catch(()=>{}); await p.waitForTimeout(500);
 g=gpx(); const creates=log.filter(x=>/^create .*\.gpx/.test(x));
 console.log('     log:',log.join('; ')); console.log('     stat:',await p.evaluate(()=>$('gdStat').innerText.replace(/\n/g,' | ')+' · hw '+ls.get('gdHw',0)+' · done '+GD.done.size)); ok(g.length===3&&creates.length===1,'reconnected later (settings taken from Drive, page reloaded): the flight made while disconnected uploaded, the others not again ('+creates.join('; ')+')');
 console.log(fail.length? fail.length+' FAILED':'all passed'); console.log(errs); await b.close(); process.exit(fail.length?1:0); })();
