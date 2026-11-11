// Your aircraft symbol and traffic symbol size (Options): each symbol (arrow, 2-blade helicopter, fixed wing) at Normal
// and Larger drawn side by side (play/ownicon_icons.png); the settings are saved and used by the map; a map with the
// helicopter at Larger and traffic at Larger (play/ownicon_map.png); a tap on a traffic symbol still selects it.
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({...PX9}); await ctx.addInitScript(()=>{ try{ if(!localStorage.getItem('rc_x')){ localStorage.setItem('rc_x','1'); localStorage.setItem('rc_notamUrl','"http://proxy.test"'); localStorage.setItem('rc_mapTraffic','true'); localStorage.setItem('rc_fsMap','true'); localStorage.setItem('rc_mapUp','"trk"'); } }catch(e){} });
 await ctx.route(/proxy\.test/,r=>r.fulfill({status:503,body:'{}',headers:{'Access-Control-Allow-Origin':'*','content-type':'application/json'}}));
 const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=1500&trk=045&gs=80'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(800);
 // the symbols side by side
 const png=await p.evaluate(()=>{ const c=document.createElement('canvas'), W=110, H=90; c.width=W*3*2; c.height=H*2*2; const g=c.getContext('2d'); g.scale(2,2); g.fillStyle='#f3efe0'; g.fillRect(0,0,W*3,H*2);
   const fr=cssv('--freq'), bg=cssv('--panel'); g.font='600 10px sans-serif'; g.textAlign='center';
   ['arrow','heli','fw'].forEach((ic,i)=>[1,1.5].forEach((k,j)=>{ g.save(); g.translate(W*i+W/2,H*j+H/2-6); g.rotate(30*Math.PI/180); ownIcon(g,fr,bg,ic,k); g.restore(); g.fillStyle='#333'; g.fillText(`${ic} ×${k}`,W*i+W/2,H*j+H-6); }));
   return c.toDataURL(); });
 require('fs').writeFileSync('play/ownicon_icons.png',Buffer.from(png.split(',')[1],'base64'));
 // settings
 await p.evaluate(()=>{ $('optsDlg').showModal(); }); await p.selectOption('#optOwnIcon','heli'); await p.selectOption('#optOwnSize','1.5'); await p.selectOption('#optTrSize','1.5'); await p.evaluate(()=>$('optsDlg').close());
 const st_=await p.evaluate(()=>({own:OWN, tr:TRS.k, ls:[ls.get('ownIcon'),ls.get('ownSize'),ls.get('trSize')]})); console.log('settings:', JSON.stringify(st_));
 if(st_.own.icon!=='heli'||st_.own.size!==1.5||st_.tr!==1.5) errs.push('settings '+JSON.stringify(st_));
 // traffic around you
 const t=await p.evaluate(()=>{ const [la,lo]=st.pos, ac=[[0.02,0.03,1700,90,'7C1234','VH-AAA'],[-0.04,0.05,2400,300,'7C2222','VH-BBB'],[0.06,-0.05,5500,180,'7C3333','QFA1']].map(([a,o,alt,trk,hex,reg])=>({hex,reg,flt:'',type:'C172',la:la+a,lo:lo+o,ab:alt,ag:null,gs:100,trk,vs:0,seen:0}));
   TR.ac=ac; TR.t=Date.now(); MAP.range=5; render(); return trTargets().map(x=>x.a.hex+':'+x.lvl).join(' '); }); console.log('traffic:', t);
 await p.waitForTimeout(300); await (await p.$('#mapSec')).screenshot({path:'play/ownicon_map.png'});
 // tap the first target: still selects it at the larger size (tap 12 px off its centre)
 const hit=await p.evaluate(()=>MAP.trHits[MAP.trHits.length-1]); const r=await (await p.$('#map')).boundingBox();
 await p.evaluate(()=>{ TZ.on=false; }); await p.mouse.click(r.x+hit.x+12*1.5*0.9,r.y+hit.y); await p.waitForTimeout(200);
 const sel=await p.evaluate(()=>TR.sel); console.log('tap near', hit.hex, '-> selected', sel); if(sel!==hit.hex) errs.push('tap did not select '+hit.hex);
 await p.reload(); await p.waitForFunction(()=>typeof render==='function'); const kept=await p.evaluate(()=>[OWN.icon,OWN.size,TRS.k,$('optOwnIcon').value,$('optTrSize').value]); console.log('after reload:', JSON.stringify(kept)); if(kept.join()!=='heli,1.5,1.5,heli,1.5') errs.push('not kept '+kept);
 console.log(errs); await b.close(); })();
