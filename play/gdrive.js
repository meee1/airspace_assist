// Google Drive saving with Google, the proxy and Drive mocked: connect (pop-up code -> proxy -> tokens, refresh token kept
// encrypted), first sync (folder, GPX per finished flight, Logbook.csv, Settings backup.json), no double upload, token refresh
// through the proxy, re-create a deleted file, restore, disconnect.
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({...PX9}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
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
 await p.evaluate(()=>{ ls.set('gdAuto',false); GD.auto=false; ls.set('aircraftTest','VH-ABC'); const A=DATA.ap.find(x=>x.i==='YBRS'), B=DATA.ap.find(x=>x.i==='YMMB'); const rows=[]; let t=Date.now()-86400e3; const step=5e3;
  const seg=(a,b,n,gs,alt)=>{ for(let k=0;k<n;k++){ const f=k/n; rows.push([t,a.la+(b.la-a.la)*f,a.lo+(b.lo-a.lo)*f,alt(f),gs,30,5,null]); t+=step; } };
  seg(A,A,24,2,()=>50); seg(A,B,360,95,f=>200+2300*Math.sin(Math.PI*f)); seg(B,B,60,0,()=>40);
  t=Date.now()-2*3600e3; seg(B,A,300,100,f=>100+1400*Math.sin(Math.PI*f)); seg(A,A,40,0,()=>50);    // a second flight, 2 h ago
  t=Date.now()-10*60e3; seg(A,A,120,60,()=>800);                                                      // one still going (last fix just now)
  logDbAdd(rows); });
 await p.waitForTimeout(500);
 await p.evaluate(()=>$('bOpts').click()); await p.waitForTimeout(800);
 console.log('before:', await p.evaluate(()=>$('gdStat').innerText.replace(/\n/g,' | ')), '· connect button', await p.evaluate(()=>!$('gdConnect').hidden));
 await p.click('#gdConnect'); await p.waitForTimeout(1500);
 console.log('after connect:', await p.evaluate(()=>$('gdStat').innerText.replace(/\n/g,' | ')));
 console.log('stored credential has the refresh token in clear?', await p.evaluate(()=>localStorage.getItem('rc_gdCred').includes('RT-secret')), '· decrypts', await p.evaluate(()=>gdRtGet()));
 console.log('drive:', Object.values(files).map(f=>f.name).join(', '));
 const gpx=Object.values(files).find(f=>/\.gpx$/.test(f.name)); console.log('gpx ok', /<gpx[\s\S]*<trkpt/.test(gpx&&gpx.body||''), '· csv rows', (Object.values(files).find(f=>f.name==='Logbook.csv').body.trim().split('\n').length-1));
 const bk=JSON.parse(Object.values(files).find(f=>f.name==='Settings backup.json').body); console.log('backup keys', Object.keys(bk.keys).length, '· has gdCred', 'rc_gdCred' in bk.keys, '· has aircraftTest', 'rc_aircraftTest' in bk.keys);
 log.length=0; await p.click('#gdNow'); await p.waitForTimeout(1000); console.log('save now again:', log.join('; '));
 log.length=0; await p.evaluate(()=>{ GD.tok=null; GD.exp=0; }); const lg=Object.entries(files).find(([,v])=>v.name==='Logbook.csv')[0]; delete files[lg];
 await p.click('#gdNow'); await p.waitForTimeout(1000); console.log('expired token + deleted Logbook.csv:', log.join('; '));
 log.length=0; globalThis.__deny=await p.evaluate(()=>GD.tok); await p.click('#gdNow'); await p.waitForTimeout(1000); globalThis.__deny=null; console.log('token refused early:', log.join('; '), '· error', await p.evaluate(()=>GD.err||'none'));
 console.log('high-water mark set', await p.evaluate(()=>ls.get('gdHw',0)>0));
 const froms=await p.evaluate(async()=>{ const f=[], o=logRead; window.logRead=(a,b)=>{ f.push(Math.round((Date.now()-a)/60e3)); return o(a,b); }; GD.last=Date.now(); await gdSync('auto'); window.logRead=o; return f; });
 console.log('auto check with nothing new reads back (min):', froms.join(','), '· drive calls', log.length);
 await p.evaluate(()=>{ ls.set('aircraftTest','CHANGED'); window.confirm=()=>true; }); const nav=p.waitForNavigation(); await p.click('#gdRestore'); await nav; await p.waitForFunction(()=>typeof render==='function');
 console.log('restored aircraftTest:', await p.evaluate(()=>ls.get('aircraftTest')), '· still connected', await p.evaluate(()=>gdOn()));
 await p.evaluate(()=>{ $('bOpts').click(); window.confirm=()=>true; }); await p.waitForTimeout(500); log.length=0; await p.click('#gdOff'); await p.waitForTimeout(500);
 console.log('disconnect:', log.join('; '), '· cred', await p.evaluate(()=>localStorage.getItem('rc_gdCred')), '·', await p.evaluate(()=>$('gdStat').innerText));
 console.log(errs); await b.close(); })();
