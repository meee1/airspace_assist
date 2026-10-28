const {chromium}=require('playwright'); const fs=require('fs');
// Replay a recorded track (e.g. from Flightradar24) through the app and print what the top tiles show whenever it changes.
// usage: node tools/fr24replay.js <track.txt> <startEpochSec> [rows.json] [base url]
//   track.txt: whitespace-separated points "lat,lon,altFt,gsKt,secondsFromStart" (thin to ~10 s)
// Needs the app served over http (python3 -m http.server 8811 in app/) and Playwright. Category is set to helicopter.
// Getting a track: open https://www.flightradar24.com/data/aircraft/<reg> in the built-in browser, navigate it to
// https://api.flightradar24.com/common/v1/flight-playback.json?flightId=<id>, and read result.response.data.flight.track
// in the page (curl/WebFetch are blocked). Altitudes there are pressure altitudes.
const [,,TRK,START,OUT,BASE='http://localhost:8811/index.html']=process.argv, T0=+START*1e3;
const pts=fs.readFileSync(TRK,'utf8').trim().split(/\s+/).map(s=>s.split(',').map(Number));
(async()=>{
 const PX9={viewport:{width:427,height:880},screen:{width:427,height:952},deviceScaleFactor:3,isMobile:true,hasTouch:true,
   userAgent:'Mozilla/5.0 (Linux; Android 15; Pixel 9 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'};
 const b=await chromium.launch(); const p=await (await b.newContext(PX9)).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.clock.setFixedTime(T0);
 await p.goto(`${BASE}?sim=${pts[0][0]},${pts[0][1]}&alt=0&trk=&gs=0`); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(500);
 await p.evaluate(()=>{ localStorage.clear(); FP=null; GO=null; const c=$('cCat'); c.value='H'; c.dispatchEvent(new Event('change')); });
 const rows=[]; let prev=null;
 for(const [la,lo,alt,gs,t] of pts){
   await p.clock.setFixedTime(T0+t*1e3);
   const r=await p.evaluate(([la,lo,alt,gs,prev])=>{ if(prev&&gs>15){ const [d,b]=distBrg(prev[0],prev[1],la,lo); if(d>0.02) st.trk=b; } st.pos=[la,lo]; st.alt=alt; st.gs=gs; simStatus(); render();
     const T=id=>(document.getElementById(id)?.innerText||'').replace(/\s+/g,' ').trim();
     return {ad:T('adId'),cls:T('sCls')+' '+T('sCap'),ctaf:T('sCtafLbl')+' '+T('sCtaf')+' '+T('sCtafAd'),ctafNx:T('sCtafNx'),area:T('sAreaLbl')+' '+T('sArea')+' '+T('sAreaWho'),areaNx:T('sAreaNx'),ctl:$('sCtl').hidden?'':T('sCtl'),nx:$('sNxCls').hidden?'':T('sNxCls')}; },[la,lo,alt,gs,prev]);
   rows.push({t,la,lo,alt,gs,loc:new Date(T0+t*1e3+11*3600e3).toISOString().slice(11,19),...r}); prev=[la,lo];
 }
 if(OUT) fs.writeFileSync(OUT,JSON.stringify(rows));
 const keys=['ad','cls','ctaf','area','ctl','nx'], last={};
 for(const r of rows){ const ch=keys.filter(k=>r[k]!==last[k]); if(!ch.length) continue; for(const k of ch) last[k]=r[k];
   console.log(`${r.loc} ${String(r.alt).padStart(5)}ft ${String(r.gs).padStart(3)}kt ${r.la.toFixed(4)},${r.lo.toFixed(4)} | `+ch.map(k=>`${k}: ${r[k]||'—'}`).join(' | ')); }
 console.log(rows.length,'points',errs); await b.close(); })();
