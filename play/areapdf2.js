const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
// part 2: YMML card (TAF with plain-English weather) and YMMB NOTAMs
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({...PX9}); await ctx.addInitScript(()=>{ const D=Date, off=D.parse('2026-11-01T21:30:00Z')-D.now(); window.Date=class extends D{ constructor(...a){ super(...(a.length?a:[D.now()+off])); } static now(){ return D.now()+off; } }; });
 const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(1000);
 await p.setInputFiles('#nbFile','play/fixtures/area_brief2.pdf'); await p.waitForTimeout(5000); console.log(await p.evaluate(()=>[typeof NTN, NTN&&NTN.title, $('nbStat').innerText])); 
 console.log(await p.evaluate(()=>{ const D=tafDecode(NTN.met.YMML.taf.raw,NTN.met.YMML.taf.t); return D.groups.map(g=>g.k+(g.prob?g.prob:'')+' '+g.toks.join(' ')+'  => wx:'+g.c.wx.join(',')).join('\n'); }));
 for(const ad of ['YMML','YMMB']){ await p.evaluate(a=>{ st.pin=a; render(); $('adWx').open=true; },ad); await p.waitForTimeout(500);
  console.log(ad, await p.evaluate(()=>({wx:$('adWx').querySelector('summary').innerText, wxrow:[...document.querySelectorAll('#adWx .taft tr')].slice(0,3).map(r=>[...r.children].slice(0,8).map(c=>c.innerText.replace(/\n/g,'/')).join(' | ')).join('\n'), notam:$('adNotam').hidden?'hidden':$('adNotam').querySelector('summary').innerText, n:$('adNotam').querySelectorAll('li,.nt').length})));
  await (await p.$('#adWx')).screenshot({path:`play/areapdf_${ad}_wx.png`}); if(ad==='YMMB') await (await p.$('#adNotam')).screenshot({path:'play/areapdf_YMMB_notam.png'}); }
 await (await p.$('#ntSet')).evaluate(e=>e.open=true); await (await p.$('#nbStat')).screenshot({path:'play/areapdf_stat.png'});
 console.log('p2',errs); await b.close(); })();
