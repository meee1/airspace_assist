// NAIPS briefing text with escaped line breaks (the proxy's JSON .text with literal \n / \r\n, or still JSON-quoted) loads the
// same as the plain text; plain text is unchanged.
const {chromium}=require('playwright'); const {PX9}=require('./px9.js'); const fs=require('fs');
const plain=fs.readFileSync(__dirname+'/fixtures/naips_sua.txt','utf8').replace(/\r\n?/g,'\n');
(async()=>{ const b=await chromium.launch(); const p=await (await b.newContext(PX9)).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YBRS&alt=1500&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(400);
 const load=t=>p.evaluate(t=>{ const ok=nbLoad(t); return ok? JSON.stringify(NTN.items.map(i=>[i.id||'',i.loc||'',(i.text||'').length])) : 'not loaded'; },t);
 const ref=await load(plain);
 const V={ 'literal \\n':plain.replace(/\n/g,'\\n'), 'literal \\r\\n':plain.replace(/\n/g,'\\r\\n'), 'JSON-quoted':JSON.stringify(plain), 'escaped + quotes':plain.replace(/\n/g,'\\n').replace(/"/g,'\\"') };
 console.log('plain:', ref==='not loaded'?ref:JSON.parse(ref).length+' items');
 for(const [k,t] of Object.entries(V)){ const r=await load(t); console.log(k.padEnd(18), r===ref?'same as plain':'DIFFERENT '+r.slice(0,120)); }
 console.log('unchanged plain', await p.evaluate(t=>nbUnescape(t)===t,plain), '· backslash kept', await p.evaluate(()=>nbUnescape('A\\B\nC\nD')==='A\\B\nC\nD'));
 console.log(errs); await b.close(); })();
