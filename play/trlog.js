// Traffic in the flight log: recorded each poll while flying with Traffic on (not on the ground, not in the simulator),
// kept in IndexedDB "tr", exported as one GPX track per aircraft; an existing v1 log database is upgraded without losing fixes
const {chromium}=require('playwright'); const {PX9}=require('./px9.js'); const fs=require('fs');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({...PX9,acceptDownloads:true}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 // an old (v1) database with one fix, as an existing install has
 await p.goto('http://localhost:8811/icon-192.png');
 await p.evaluate(()=>new Promise(ok=>{ const r=indexedDB.open('radio-au',1); r.onupgradeneeded=()=>r.result.createObjectStore('log',{autoIncrement:true}).createIndex('t','t');
   r.onsuccess=()=>{ const tx=r.result.transaction('log','readwrite'); tx.objectStore('log').add({t:Date.now()-3600e3,r:[Date.now()-3600e3,-37.6,144.0,1500,90,0,5,null]}); tx.oncomplete=()=>{ r.result.close(); ok(); }; }; }));
 await p.goto('http://localhost:8811/index.html?sim=YBRS&alt=1500&trk=000&gs=90'); await p.waitForFunction(()=>typeof render==='function'&&LOGDB.db); await p.waitForTimeout(500);
 console.log('upgrade:', await p.evaluate(()=>new Promise(ok=>{ const db=LOGDB.db; const q=db.transaction('log').objectStore('log').count(); q.onsuccess=()=>ok(`v${db.version} stores ${[...db.objectStoreNames].join(',')} · old fixes kept ${q.result}`); })));
 await p.evaluate(()=>{ ls.set('notamUrl','http://localhost:8812'); $('cSign').value='ALPHA BRAVO CHARLIE'; MAP.traffic=true; });
 const poll=(sim,gs)=>p.evaluate(async([sim,gs])=>{ st.sim=sim; st.gs=gs; TR.busy=false; await trPoll(); return TRLOG.length; },[sim,gs]);
 console.log('simulator, flying :', await poll(true,90), 'rows');
 await p.evaluate(()=>{ trFlyT=0; });
 console.log('real, on the ground:', await poll(false,0), 'rows');
 console.log('real, flying       :', await poll(false,90), 'rows');
 console.log('real, hover 0 kt   :', await poll(false,0), 'rows (within 5 min of flying)');
 const db=await p.evaluate(()=>new Promise(ok=>{ const q=LOGDB.db.transaction('tr').objectStore('tr').count(); q.onsuccess=()=>ok(q.result); }));
 console.log('stored in IndexedDB "tr":', db, '· sample', await p.evaluate(()=>JSON.stringify(TRLOG[0])));
 // a few real fixes, then the Flight log button download
 await p.evaluate(()=>{ for(let k=0;k<4;k++){ TLOG.last=0; st.pos=[st.pos[0]+0.002,st.pos[1]]; fpLogFix(); } });
 const [d]=await Promise.all([p.waitForEvent('download'),p.evaluate(()=>$('fpLog').click())]); await d.saveAs('trlog.gpx');
 const g=fs.readFileSync('trlog.gpx','utf8'), trk=[...g.matchAll(/<trk><name>([^<]*)<\/name>(?:<desc>([^<]*)<\/desc>)?/g)].map(m=>m[1]+(m[2]?' — '+m[2]:''));
 console.log('GPX tracks:', trk.length); trk.forEach(t=>console.log('  ', t)); console.log('  first traffic point:', (g.match(/<type>traffic<\/type><trkseg>\n(<trkpt[^\n]*)/)||[])[1]);
 console.log('valid XML:', await p.evaluate(x=>{ const d=new DOMParser().parseFromString(x,'application/xml'); return !d.querySelector('parsererror'); },g));
 console.log(errs); await b.close(); })();
