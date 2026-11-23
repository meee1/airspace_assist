// Loading screen with the offline content (24 Nov 2026, Michael: "Update the loading screen to include the other static
// content like coast line etc"). Fresh profile on localhost (service worker on), the wait turned on (ls bootTest; an automated
// browser skips it otherwise): rows for terrain, coastline, charts, power lines with counts and Start now; Start now hides it;
// left alone it closes once everything is stored; the next launch (all stored) closes straight away. node play/bootoff.js (app on :8811)
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(), errs=[], fail=[]; const ok=(c,m)=>{ console.log((c?'ok   ':'FAIL ')+m); if(!c) fail.push(m); };
  const mk=async()=>{ const ctx=await b.newContext({...PX9}); await ctx.addInitScript(()=>{ try{ localStorage.setItem('rc_bootTest','true'); localStorage.setItem('rc_fsMap','false'); }catch(e){} });
    const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); return {ctx,p}; };
  const rows=p=>p.evaluate(()=>{ const B=document.getElementById('boot'); if(!B) return null; return {li:[...B.querySelectorAll('li')].map(l=>l.innerText.replace(/\s+/g,' ').trim()), go:!!document.getElementById('bootGo'), msg:document.getElementById('bootMsg').innerText}; });
  // 1. first visit: the offline rows and Start now
  let {ctx,p}=await mk(); await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=000&gs=0');
  await p.waitForFunction(()=>document.getElementById('bootGo')||!document.getElementById('boot'),null,{timeout:30000});
  let r=await rows(p); console.log('     first visit: '+(r? r.li.join(' | ') : '(closed straight away)'));
  ok(r&&r.go&&r.li.some(t=>/^… Terrain \d+ \/ \d+ tiles/.test(t)||/^✓ Terrain/.test(t))&&r.li.some(t=>/Coastline/.test(t)),'first visit: terrain and coastline rows with counts, Start now');
  const rate=await p.waitForFunction(()=>{ const e=document.getElementById('bootRate'); return e&&/\/s · .* to go/.test(e.textContent)? e.textContent : (!document.getElementById('boot')? 'closed' : false); },null,{timeout:8000,polling:250}).then(h=>h.jsonValue(),()=>null);
  ok(rate&&(rate==='closed'||/^about [\d.]+ (MB|kB)\/s · [\d.]+ (MB|kB) to go( · about \d+ (s|min))?$/.test(rate)),'download speed shown: '+rate);
  await p.screenshot({path:__dirname+'/bootoff_first.png'});
  await p.click('#bootGo'); await p.waitForFunction(()=>!document.getElementById('boot'),null,{timeout:5000}).catch(()=>{});
  ok(await p.evaluate(()=>!document.getElementById('boot')&&typeof render==='function'),'Start now: the app shows, downloads carry on');
  await ctx.close();
  // 2. left alone: it closes by itself once everything is stored
  ({ctx,p}=await mk()); await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=000&gs=0'); const t0=Date.now();
  await p.waitForFunction(()=>!!document.getElementById('bootGo')||!document.getElementById('boot'),null,{timeout:30000});
  const closed=await p.waitForFunction(()=>!document.getElementById('boot'),null,{timeout:240000,polling:500}).then(()=>true,()=>false);
  const st=await p.evaluate(async()=>{ const n=(await (await caches.open('radio-au-terrain')).keys()).filter(k=>/\.bin\.z$/.test(k.url)).length; return {ter:n+'/'+TER.have.size, coast:(await coastStored()).have.size+'/'+COAST.c.size, ch:CH.have+'/'+CH.need, wires:!!(await (await caches.open('radio-au-wires')).match('powerlines.json'))}; });
  ok(closed,`left alone: closed after ${((Date.now()-t0)/1000).toFixed(0)} s with terrain ${st.ter}, coastline ${st.coast}, charts ${st.ch}, power lines ${st.wires}`);
  // 3. next launch, everything stored: no wait
  const t1=Date.now(); await p.reload(); await p.waitForFunction(()=>typeof render==='function');
  let sawGo=false; for(let i=0;i<30;i++){ const x=await rows(p); if(!x) break; if(x.go) sawGo=true; await p.waitForTimeout(200); }
  ok(!sawGo&&await p.evaluate(()=>!document.getElementById('boot')),`next launch: closes by itself in ${((Date.now()-t1)/1000).toFixed(1)} s, no Start now`);
  // 4. offline with something missing: starts after a moment
  await p.evaluate(async()=>{ const c=await caches.open('radio-au-terrain'), k=(await c.keys()).filter(q=>/\.bin\.z$/.test(q.url)); for(const q of k.slice(0,3)) await c.delete(q); });
  await ctx.setOffline(true); await p.reload(); await p.waitForFunction(()=>typeof render==='function',null,{timeout:30000});
  const off=await p.waitForFunction(()=>!document.getElementById('boot'),null,{timeout:10000}).then(()=>true,()=>false);
  ok(off,'offline with 3 terrain tiles missing: starts by itself');
  await ctx.setOffline(false); await ctx.close();
  console.log(fail.length? fail.length+' FAILED':'all passed'); console.log(errs.filter(e=>!/Failed to fetch|NetworkError|net::/.test(e))); await b.close(); process.exit(fail.length?1:0); })();
