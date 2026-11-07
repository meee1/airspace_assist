// Settings file: Export downloads the backup JSON (no secrets), Import from that file restores after a confirm; a wrong file
// or a declined confirm changes nothing.
const {chromium}=require('playwright'); const {PX9}=require('./px9.js'); const fs=require('fs'), os=require('os'), path=require('path');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({...PX9,acceptDownloads:true}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YBRS&alt=1500&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(400);
 await p.evaluate(()=>{ ls.set('aircraftTest','VH-ABC'); ls.set('naipsCred','SECRET'); ls.set('satKey','KEY'); $('bOpts').click(); }); await p.waitForTimeout(300);
 const dl=p.waitForEvent('download'); await p.click('#cfgExport'); const d=await dl; const f=path.join(os.tmpdir(),d.suggestedFilename()); await d.saveAs(f);
 const o=JSON.parse(fs.readFileSync(f,'utf8')); console.log('export:', d.suggestedFilename(), '· app', o.app, '· keys', Object.keys(o.keys).length, '· aircraftTest', o.keys.rc_aircraftTest,
   '· secrets', ['rc_naipsCred','rc_satKey','rc_gdCred'].filter(k=>k in o.keys).join(',')||'none', '·', await p.textContent('#cfgStat'));
 const bad=path.join(os.tmpdir(),'not-settings.json'); fs.writeFileSync(bad,'{"hello":1}');
 await p.setInputFiles('#cfgFile',bad); await p.waitForTimeout(300); console.log('wrong file:', await p.textContent('#cfgStat'));
 await p.evaluate(()=>{ ls.set('aircraftTest','CHANGED'); }); p.once('dialog',dg=>dg.dismiss()); await p.setInputFiles('#cfgFile',f); await p.waitForTimeout(400);
 console.log('declined:', await p.evaluate(()=>ls.get('aircraftTest')), '·', await p.textContent('#cfgStat'));
 // a hostile file can't set the secrets or non-app keys
 const o2={...o,keys:{...o.keys,rc_naipsCred:'"EVIL"',other:'x'}}; fs.writeFileSync(f,JSON.stringify(o2));
 p.once('dialog',dg=>dg.accept()); const nav=p.waitForNavigation(); await p.setInputFiles('#cfgFile',f); await nav; await p.waitForFunction(()=>typeof render==='function');
 console.log('imported:', await p.evaluate(()=>ls.get('aircraftTest')), '· naipsCred kept', await p.evaluate(()=>ls.get('naipsCred')), '· other key', await p.evaluate(()=>localStorage.getItem('other')));
 console.log(errs); await b.close(); })();
