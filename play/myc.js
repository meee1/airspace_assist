// Your own wording: edit the Moorabbin tower inbound call to "inbound for the southern approach", check the card, the 10 NM row,
// tokens following the position, scope (this aerodrome / every aerodrome), reset
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({...PX9}); await ctx.addInitScript(()=>{ const D=Date, off=D.parse('2026-11-02T01:30:00Z')-D.now(); window.Date=class extends D{ constructor(...a){ super(...(a.length?a:[D.now()+off])); } static now(){ return D.now()+off; } }; });
 const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); await p.goto('http://localhost:8811/index.html?sim=YBRS&alt=1500&trk=315&gs=100'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(800);
 await p.evaluate(()=>{ $('cType').value='Bell 206'; $('cSign').value='ABC'; $('cCat').value='H'; localStorage.removeItem('myCalls'); MYC.t={}; });
 const at=(dla,dlo)=>p.evaluate(([dla,dlo])=>{ const a=DATA.ap.find(x=>x.i==='YMMB'); setGo({k:'AD',c:'YMMB',n:a.n,la:a.la,lo:a.lo}); $('simPos').value=(a.la+dla)+','+(a.lo+dlo); simApply(); render(); $('calls').open=true; },[dla,dlo]);
 const card=()=>p.evaluate(()=>[...document.querySelectorAll('#callsList .call')].map(e=>e.innerText.replace(/\n/g,' | ')).find(t=>/^INBOUND/i.test(t))||'-');
 await at(-0.11,0.14);
 console.log('before  ', await card());
 // open the editor on the Inbound call
 const n=await p.evaluate(()=>MYC.cur.calls.findIndex(c=>/^Inbound/.test(c[0]))); await p.click(`#callsList button.ed[data-n="${n}"]`);
 console.log('template', JSON.stringify(await p.inputValue('#mycTa')));
 await p.evaluate(()=>{ const ta=$('mycTa'); ta.value=ta.value.replace(/inbound for .*$/,'inbound for the southern approach.'); ta.dispatchEvent(new Event('input')); });
 console.log('preview ', await p.evaluate(()=>$('mycPv').innerText));
 await p.screenshot({path:'myc_edit.png'});
 await p.click('#mycSave');
 console.log('stored  ', await p.evaluate(()=>localStorage.getItem('myCalls')));
 console.log('after   ', await card());
 await at(-0.06,0.08); console.log('closer  ', await card());
 // 10 NM inbound row
 const row=await p.evaluate(()=>{ const a=DATA.ap.find(x=>x.i==='YMMB'); INB.on=null; INB.armed={}; INB.lastD={}; let r=''; for(const f of [1.3,1.1,0.95,0.9]){ $('simPos').value=(a.la-0.11*f)+','+(a.lo+0.14*f); simApply(); render(); if(!$('sInbound').hidden) r=$('sInbound').innerText.replace(/\n/g,' '); } return r; });
 console.log('row     ', row);
 // another tower aerodrome: unchanged; then save for every aerodrome
 await p.evaluate(()=>{ const a=DATA.ap.find(x=>x.i==='YMEN'); setGo({k:'AD',c:'YMEN',n:a.n,la:a.la,lo:a.lo}); $('simPos').value=(a.la+0.1)+','+(a.lo+0.1); simApply(); render(); });
 console.log('YMEN    ', await card());
 // CTAF aerodrome inbound untouched
 await p.evaluate(()=>{ const a=DATA.ap.find(x=>x.i==='YLIL'); setGo({k:'AD',c:'YLIL',n:a.n,la:a.la,lo:a.lo}); $('simPos').value=(a.la-0.1)+','+(a.lo); simApply(); render(); });
 console.log('YLIL    ', await card());
 // reset at YMMB
 await at(-0.11,0.14); await p.click(`#callsList button.ed[data-n="${n}"]`); await p.click('#mycReset'); console.log('reset   ', await card(), await p.evaluate(()=>localStorage.getItem('myCalls')));
 await at(-0.11,0.14); await p.evaluate(()=>{ const i=MYC.cur.calls.findIndex(c=>/^Inbound/.test(c[0])); mycOpen(i); $('mycTa').value='{station}, {callsign}, {position}, inbound.'; document.querySelector('input[name=mycSc][value=all]').checked=true; $('mycSave').click(); });
 await p.evaluate(()=>{ const a=DATA.ap.find(x=>x.i==='YMEN'); setGo({k:'AD',c:'YMEN',n:a.n,la:a.la,lo:a.lo}); $('simPos').value=(a.la+0.1)+','+(a.lo+0.1); simApply(); render(); });
 console.log('all→YMEN', await card());
 await p.evaluate(()=>{ const i=MYC.cur.calls.findIndex(c=>/^Inbound/.test(c[0])); mycOpen(i); }); await p.waitForTimeout(200); await p.screenshot({path:'myc_card.png'});
 console.log(errs); await b.close(); })();
