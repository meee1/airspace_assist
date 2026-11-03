// NAIPS download with the pilot's login: encrypted storage, download via the proxy (mockserver + fake NAIPS), errors, auto, forget
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({...PX9}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YBRS'); await p.waitForFunction(()=>typeof nbDownload==='function'); await p.waitForTimeout(400);
 await p.evaluate(()=>{ ls.set('notamUrl','http://localhost:8812'); ls.set('nbAreas','9300'); $('nbAreas').value='9300'; NTN=null; ls.set('naips',null); nbCredForget(); $('ntSet').open=true; });
 const acct=()=>p.evaluate(()=>$('nbAcct').innerText.replace(/\n/g,' | '));
 console.log('start:', await acct(), '| download disabled', await p.evaluate(()=>$('nbDl').disabled));
 await p.fill('#nbUser','pilot1'); await p.fill('#nbPass','secret99'); await p.click('#nbSave'); await p.waitForTimeout(300);
 console.log('saved:', await acct(), '| fields cleared', await p.evaluate(()=>$('nbUser').value===''&&$('nbPass').value===''));
 console.log('localStorage has plaintext?', await p.evaluate(()=>{ const all=JSON.stringify(localStorage); return /secret99|pilot1/.test(all); }), '| stored:', await p.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem('rc_naipsCred'))).join(',')));
 console.log('key extractable?', await p.evaluate(async()=>{ const k=await nbKey(false); try{ await crypto.subtle.exportKey('raw',k); return 'yes!'; }catch(e){ return 'no ('+k.extractable+')'; } }));
 await p.evaluate(()=>{ $('nbDl').click(); }); await p.waitForTimeout(50); await p.waitForFunction(()=>!NBD.busy,null,{timeout:20000}); 
 console.log('download:', await acct()); console.log('  briefing:', await p.evaluate(()=>NTN? NTN.title+' · '+Object.keys(NTN.met||{}).length+' met stations' : 'none'));
 // wrong password
 await p.evaluate(()=>nbCredSave('pilot1','wrongpw1')); await p.evaluate(()=>nbDownload(false)); await p.waitForFunction(()=>!NBD.busy);
 console.log('wrong password:', await acct());
 // auto download when the briefing is old
 await p.evaluate(()=>nbCredSave('pilot1','secret99')); await p.evaluate(()=>{ NTN=null; NBD.lastTry=0; NBD.fail=0; ls.set('nbAuto',3); nbAutoCheck(); }); await p.waitForTimeout(300); await p.waitForFunction(()=>!NBD.busy);
 console.log('auto:', await acct());
 await p.evaluate(()=>{ NTN.issued=Date.now(); NBD.lastTry=0; nbAutoCheck(); }); await p.waitForTimeout(300); console.log('auto again with a fresh briefing (should not run):', await p.evaluate(()=>NBD.lastTry===0?'not run':'ran'));
 await p.click('#nbForget'); await p.waitForTimeout(300); console.log('forget:', await acct(), '| key gone', await p.evaluate(async()=>!(await nbKey(false))), '| cred', await p.evaluate(()=>localStorage.getItem('rc_naipsCred')));
 await p.evaluate(()=>{ $('ntSet').scrollIntoView(); }); await (await p.$('.nbacct')).screenshot({path:'play/nbdl.png'});
 console.log(errs); await b.close(); })();
