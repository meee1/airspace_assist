// Settings backup and saved plans across phones: a new phone's first connect offers the backup already in Drive BEFORE
// writing anything; declined, the Drive copy is kept until Save now on that phone; saved plans are combined across phones
// (a deletion on one phone removes the plan on the others).
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
const H={'Access-Control-Allow-Origin':'*'}, files={}, log=[]; let nid=0;
async function phone(b,name,setup,answer){ const ctx=await b.newContext({...PX9}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); const asked=[];
 p.on('dialog',d=>{ asked.push(d.message().split('\n')[0].slice(0,90)); /^Google Drive has settings/.test(d.message())? (answer? d.accept() : d.dismiss()) : d.accept(); });
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
 await p.evaluate(setup);
 await p.evaluate(()=>$('bOpts').click()); await p.waitForTimeout(500); await p.click('#gdConnect'); await p.waitForTimeout(2500);
 await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(800);
 return {p, errs, asked}; }
const live=()=>Object.entries(files).filter(([,v])=>!v.trashed);
const backup=()=>{ const f=live().find(([,v])=>v.name==='Settings backup.json'); if(!f) return null; const o=JSON.parse(f[1].body); const J=k=>o.keys[k]?JSON.parse(o.keys[k]):null; return {ac:J('rc_aircraftTest'), plans:(J('rc_plans')||[]).map(p=>p.name).sort().join(','), del:(J('rc_plansDel')||[]).length}; };
const plan=(id,name,t)=>({id,name,t,pts:[{n:'A',c:'YBRS',la:-38.258,lo:144.425},{n:'B',c:'YMMB',la:-37.976,lo:145.102}]});
(async()=>{ const b=await chromium.launch(); const T=Date.now();
 const P1=await phone(b,'phone1',`ls.set('gdAuto',false); GD.auto=false; ls.set('aircraftTest','VH-ONE'); PLANS=${JSON.stringify([plan('p1','Home',T-5e6),plan('p2','Coast',T-4e6)])}; ls.set('plans',PLANS);`,true);
 console.log('phone 1 connects (no backup yet): asked', JSON.stringify(P1.asked), '· Drive backup', JSON.stringify(backup()));
 const P2=await phone(b,'phone2',`ls.set('gdAuto',false); GD.auto=false; ls.set('aircraftTest','VH-TWO');`,false);
 console.log('phone 2 connects, says Cancel: asked', JSON.stringify(P2.asked), '· Drive backup still', JSON.stringify(backup()), '· phone 2 plans', await P2.p.evaluate(()=>PLANS.map(p=>p.name).join(',')||'none'));
 console.log('  status:', await P2.p.evaluate(()=>$('gdStat').innerText.split('\n')[0].slice(0,190)));
 await P2.p.evaluate(T=>{ PLANS.unshift({id:'p3',name:'Tyabb',t:T,pts:[{n:'A',c:'YTYA',la:-38.27,lo:145.18},{n:'B',c:'YMMB',la:-37.976,lo:145.102}]}); ls.set('plans',PLANS); },T);
 await P2.p.evaluate(T=>{ WPTS=[{id:'w1',n:'FUEL DRUM',note:'',la:-38.2,lo:144.5,t:T},{id:'w2',n:'PAD',note:'',la:-38.1,lo:144.6,t:T}]; wpStore(); CL=[{id:'c1',name:'Before start',ac:'',items:['Belts .... on'],t:T}]; clStore(); },T);   // waypoints and a checklist, to follow the plans across
 await P2.p.click('#gdNow'); await P2.p.waitForTimeout(1200);
 console.log('phone 2 Save now: Drive backup', JSON.stringify(backup()), '· phone 2 plans', await P2.p.evaluate(()=>PLANS.map(p=>p.name).sort().join(',')));
 await P1.p.evaluate(()=>{ $('bOpts').click(); }); await P1.p.evaluate(()=>{ fplOpen(); }); await P1.p.click('#plList li[data-id="p2"] [data-a="del"]'); await P1.p.evaluate(()=>$('plDlg').close());
 await P1.p.click('#gdNow'); await P1.p.waitForTimeout(1200);
 const own1=await P1.p.evaluate(()=>WPTS.map(w=>w.n).sort().join(',')+' | '+CL.map(c=>c.name).join(','));
 console.log('  phone 1 now also has phone 2\'s waypoints and checklist:', own1); if(own1!=='FUEL DRUM,PAD | Before start') P1.errs.push('waypoints / checklists did not merge');
 await P1.p.evaluate(()=>{ wpDelete('w2'); }); await P1.p.click('#gdNow'); await P1.p.waitForTimeout(1200);
 console.log('phone 1 deletes Coast, Save now: phone 1 plans', await P1.p.evaluate(()=>PLANS.map(p=>p.name).sort().join(',')), '· Drive backup', JSON.stringify(backup()));
 await P2.p.click('#gdNow'); await P2.p.waitForTimeout(1200);
 console.log('phone 2 Save now: phone 2 plans', await P2.p.evaluate(()=>PLANS.map(p=>p.name).sort().join(',')));
 const own2=await P2.p.evaluate(()=>WPTS.map(w=>w.n).join(',')); console.log('  phone 2 waypoints after phone 1 deleted PAD:', own2); if(own2!=='FUEL DRUM') P2.errs.push('waypoint deletion did not carry over');
 const P3=await phone(b,'phone3',`ls.set('gdAuto',false); GD.auto=false;`,true);
 console.log('phone 3 connects, says OK: asked', JSON.stringify(P3.asked), '· aircraft', await P3.p.evaluate(()=>ls.get('aircraftTest')), '· plans', await P3.p.evaluate(()=>PLANS.map(p=>p.name).sort().join(',')), '· still connected', await P3.p.evaluate(()=>gdOn()));
 console.log([...P1.errs,...P2.errs,...P3.errs]); await b.close(); })();
