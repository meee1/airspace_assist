// Help pages (25 Nov 2026, Michael: "create a documentation suite for all features"): More → Help opens app/docs/index.html; every
// link and #anchor in the docs resolves; the pages fit a phone; they load offline from the service worker's precache.
// node play/help.js (app on :8811)
const {chromium}=require('playwright'); const {PX9}=require('./px9.js'); const fs=require('fs'), path=require('path');
(async()=>{ const b=await chromium.launch(), errs=[], fail=[]; const ok=(c,m)=>{ console.log((c?'ok   ':'FAIL ')+m); if(!c) fail.push(m); };
  const ctx=await b.newContext({...PX9}); const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'&&st.pos);
  const [pop]=await Promise.all([ctx.waitForEvent('page'), p.evaluate(()=>$('bHelp').click())]); await pop.waitForLoadState();
  ok(/\/docs\/index\.html$/.test(pop.url())&&/Help|Radio Calls/i.test(await pop.title()),'More → Help opens '+pop.url().replace(/^.*\/app\b|^http:\/\/localhost:8811/,'')+' · '+await pop.title());
  // every page: links and anchors resolve, no sideways scroll on the phone
  const dir=path.join(__dirname,'..','app','docs'), pages=fs.readdirSync(dir).filter(f=>f.endsWith('.html')); let bad=[], wide=[], n=0;
  const ids={}; for(const f of pages){ await pop.goto('http://localhost:8811/docs/'+f); ids[f]=await pop.evaluate(()=>[...document.querySelectorAll('[id]')].map(e=>e.id));
    if(await pop.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)) wide.push(f);
    const L=await pop.evaluate(()=>[...document.querySelectorAll('a[href]')].map(a=>a.getAttribute('href'))); n+=L.length;
    for(const h of L){ if(/^https?:/.test(h)) continue; const [file,anc]=h.split('#'), tgt=file||f;
      if(tgt==='../index.html') continue; if(!pages.includes(tgt)){ bad.push(f+' → '+h); continue; } ids[tgt]=ids[tgt]||null; if(anc) (ids.__chk=ids.__chk||[]).push([f,h,tgt,anc]); } }
  for(const [f,h,tgt,anc] of ids.__chk||[]){ if(!ids[tgt]){ await pop.goto('http://localhost:8811/docs/'+tgt); ids[tgt]=await pop.evaluate(()=>[...document.querySelectorAll('[id]')].map(e=>e.id)); } if(!ids[tgt].includes(anc)) bad.push(f+' → '+h); }
  ok(pages.length>=18&&!bad.length,`${pages.length} pages, ${n} links: all resolve${bad.length?' · broken: '+bad.slice(0,6).join(', '):''}`);
  ok(!wide.length,'no sideways scroll on the Pixel'+(wide.length?': '+wide.join(', '):''));
  await pop.goto('http://localhost:8811/docs/index.html'); await pop.screenshot({path:__dirname+'/help_index.png'});
  await pop.emulateMedia({colorScheme:'dark'}); await pop.goto('http://localhost:8811/docs/flight-computer.html'); await pop.screenshot({path:__dirname+'/help_e6b_dark.png'});
  // fuzzy search (25 Nov 2026, Michael: "Make sure the doc is fuzzy searchable"): typos, run-together words, synonyms, the box on every page
  const Q=[['squak','radio-calls.html#squawk'],['hover perfomance','preflight.html#hover'],['crosswnd','flight-computer.html#ex-xw'],['w&b','fuel-wb.html#wb'],
    ['emergancy','radio-calls.html#sos'],['atis listen','transcription.html#atis'],['read back','transcription.html#readback'],['terain','map.html#terrain'],
    ['how do i share a plan','flight-plan.html#share'],['moorabbin east west','aerodrome.html#split'],['bose a30','transcription.html#input'],['Go to','flight-plan.html#goto']];
  await pop.goto('http://localhost:8811/docs/map.html'); const got=[];
  for(const [q,want] of Q){ const r=await pop.evaluate(q=>helpSearch(q),q); got.push([q,want,r.slice(0,2)]); }
  const miss=got.filter(([q,w,r])=>!r.includes(w)); ok(!miss.length,`search: ${got.length} queries with typos/synonyms find their section in the top 2`+(miss.length?' · missed: '+miss.map(m=>m[0]+' → '+m[2].join(',')).join('; '):''));
  await pop.fill('.topbar input[type=search]','hovr ige'); await pop.waitForSelector('.dsres:not([hidden]) li a'); await pop.screenshot({path:__dirname+'/help_search.png'});
  const first=await pop.evaluate(()=>document.querySelector('.dsres li a').getAttribute('href')); await pop.keyboard.press('Enter'); await pop.waitForURL(/#/);
  ok(/hover/.test(first)&&pop.url().endsWith(first),'the box on a page: "hovr ige" lists '+first+' first; Enter opens it ('+pop.url().replace(/^.*\/docs\//,'')+')');
  await pop.goto('http://localhost:8811/docs/index.html'); await pop.fill('#dsBig input','squawk'); await pop.waitForSelector('#dsBig .dsres li a');
  await pop.keyboard.press('ArrowDown'); const sel=await pop.evaluate(()=>[...document.querySelectorAll('#dsBig .dsres li')].findIndex(l=>l.classList.contains('on')));
  await pop.fill('#dsBig input','zzqqxx'); await pop.waitForTimeout(300); const none=await pop.evaluate(()=>document.querySelector('#dsBig .dsres').innerText);
  ok(sel===1&&/Nothing found/.test(none),'contents page box: arrow keys move the selection; nonsense says "Nothing found"');
  // offline: the service worker's precache has them
  await p.evaluate(()=>navigator.serviceWorker.ready); await p.reload(); await p.waitForFunction(()=>navigator.serviceWorker.controller,null,{timeout:20000});
  const cached=await p.evaluate(async()=>{ const k=await caches.keys(), c=k.find(x=>/^radio-au-[0-9a-f]+$/.test(x)); const ks=c? (await (await caches.open(c)).keys()).map(r=>r.url).filter(u=>/\/docs\//.test(u)) : []; return ks.length; });
  await ctx.setOffline(true); const q=await ctx.newPage(); let off=false; try{ await q.goto('http://localhost:8811/docs/transcription.html'); off=await q.evaluate(()=>!!document.getElementById('atis')&&getComputedStyle(document.body).backgroundColor!==''); off=off&&(await q.evaluate(()=>helpSearch('squak'))).includes('radio-calls.html#squawk'); }catch(e){}
  await ctx.setOffline(false);
  ok(cached>=21&&off,`offline: ${cached} help files in the service worker's cache; transcription.html opens and search works without signal`);
  console.log(fail.length? fail.length+' FAILED':'all passed'); console.log(errs); await b.close(); process.exit(fail.length?1:0); })();
