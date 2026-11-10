// Map benchmark (render timing panel -> Benchmark): runs to the end without errors, the report has every layer set and range
// and the WebGL probe, and the layers, range and view are back as they were. Satellite tiles from a stand-in proxy.
//   node play/bench.js [px9|tab] [cpu rate]    the report is printed and saved to play/bench_<dev>.txt
const {chromium}=require('playwright'); const {PX9,TAB}=require('./px9.js'); const fs=require('fs'), path=require('path');
const DEV=process.argv[2]||'px9', RATE=+(process.argv[3]||1);
const JPG=[]; (function walk(d){ for(const f of fs.readdirSync(d)){ const q=path.join(d,f); if(fs.statSync(q).isDirectory()) walk(q); else if(f.endsWith('.jpg')&&JPG.length<64) JPG.push(fs.readFileSync(q)); } })(path.join(__dirname,'../dist/charts/ML-VNC-26NOV2026/1'));
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({...(DEV==='tab'?TAB:PX9), storageState:undefined}); let n=0;
 await ctx.route(/^http:\/\/satproxy\.test\/tile\//,r=>r.fulfill({status:200,contentType:'image/jpeg',headers:{'Access-Control-Allow-Origin':'*'},body:JPG[(n++)%JPG.length]}));
 await ctx.addInitScript(()=>{ try{ for(const [k,v] of [['rc_fsMap','true'],['rc_notamUrl','"http://satproxy.test"'],['rc_mapTraffic','false'],['rc_perfOn','true'],['rc_mapRange','25'],['rc_mapSat','true'],['rc_satOp','0.25'],['rc_mapTer','false']]) localStorage.setItem(k,v); }catch(e){} });
 const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=-37.85,145.1&alt=1500&trk=045&gs=0'); await p.waitForFunction(()=>typeof render==='function'&&CH.site.length>0,{timeout:30000});
 await p.evaluate(()=>{ ls.set('chartSel',CH.site.filter(s=>/ML-V|WAC-34|WAC-35/.test(s.sheet)).map(s=>s.sheet)); chartMerge(); MAP.ctaf=true; render(); }); await p.waitForTimeout(800);
 const before=await p.evaluate(()=>JSON.stringify([MAP.range,MAP.pan,MAP.ter,MAP.ctaf,CH.on,SAT.on,SAT.op]));
 if(RATE>1){ const cdp=await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate',{rate:RATE}); }
 await p.click('#perfBox [data-pf="bench"]'); await p.waitForTimeout(500);
 console.log('running:', await p.evaluate(()=>BN.on), '·', await p.textContent('#perfBox .bn'));
 await p.waitForFunction(()=>!BN.on,undefined,{timeout:900e3,polling:1000});
 const res=await p.evaluate(()=>BN.res); console.log(res); fs.writeFileSync(path.join(__dirname,`bench_${DEV}.txt`),res);
 const after=await p.evaluate(()=>JSON.stringify([MAP.range,MAP.pan,MAP.ter,MAP.ctaf,CH.on,SAT.on,SAT.op]));
 console.log('state put back:', before===after, before, after, '· in Copy text:', await p.evaluate(()=>pfText().includes('WebGL probe')));
 if(before!==after) errs.push('state not restored'); if(!/WebGL/.test(res)||/stopped:/.test(res)) errs.push('report incomplete');
 await (await p.$('#perfBox')).screenshot({path:'play/bench_panel.png'});
 console.log(errs); await b.close(); })();
