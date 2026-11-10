// Own waypoints: saved from the map's press-and-hold menu, shown on the map (tap = Go to), found by search and by name,
// added to a plan, edited, deleted (with a tombstone), entered by position, and merged with another phone's list.
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); require('./classic.js')(b); const ctx=await b.newContext(PX9); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 p.on('dialog',d=>d.accept());
 await p.goto('http://localhost:8811/index.html?sim=YBRS&alt=1500&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(500);
 await p.evaluate(()=>{ MAP.range=10; MAP.up='north'; render(); }); await p.waitForTimeout(300);
 // press-and-hold menu at a spot 3 NM north-east of YBRS -> Save as waypoint
 const at=await p.evaluate(()=>{ const [x,y]=MAP.P(st.pos[0]+0.04,st.pos[1]+0.04); mapMenu(x,y); return [...$('mmBtns').children].map(b=>b.textContent); });
 console.log('menu:', at.join(' | '));
 await p.evaluate(()=>[...$('mmBtns').children].find(b=>/Save as waypoint/.test(b.textContent)).click()); await p.waitForTimeout(200);
 console.log('form open', await p.evaluate(()=>$('wpDlg').open&&!$('wpForm').hidden), 'pos', await p.inputValue('#wpLL'));
 await p.fill('#wpName','fuel drum'); await p.fill('#wpNote','Behind the shed, call Bob first'); await p.click('#wpSave'); await p.waitForTimeout(200);
 console.log('saved:', await p.textContent('#wpStat'), '· list', await p.evaluate(()=>WPTS.map(w=>w.n+' '+w.la.toFixed(3)+','+w.lo.toFixed(3)).join('; ')));
 await p.screenshot({path:'play/wpts_list.png'});
 await p.click('#wpClose'); await p.waitForTimeout(300);
 // on the map: a hit there; tapping it sets Go to
 const hit=await p.evaluate(()=>{ const h=MAP.hits.find(h=>h.p.uw); return h&&{x:Math.round(h.x),y:Math.round(h.y),c:h.p.c}; }); console.log('map hit', JSON.stringify(hit));
 await (await p.$('#map')).scrollIntoViewIfNeeded(); await (await p.$('.mapwrap')).screenshot({path:'play/wpts_map.png'});
 await p.evaluate(()=>setGo(MAP.hits.find(h=>h.p.uw).p)); console.log('go to:', await p.evaluate(()=>GO.c+' · '+GO.n));
 // the menu on top of it offers edit / delete, and the plan uses its name
 console.log('menu on it:', (await p.evaluate(()=>{ const w=WPTS[0], [x,y]=MAP.P(w.la,w.lo); mapMenu(x,y); return $('mmName').textContent+' / '+[...$('mmBtns').children].map(b=>b.textContent).join(' | '); })));
 await p.evaluate(()=>{ [...$('mmBtns').children].find(b=>/Start flight plan/.test(b.textContent)).click(); }); await p.waitForTimeout(200);
 console.log('plan point:', await p.evaluate(()=>JSON.stringify(FP.pts.map(q=>[q.n,q.desc]))));
 // search and exact name
 console.log('search "drum":', await p.evaluate(()=>searchPoints('drum',3).map(o=>o.p.k+':'+o.p.c).join(', ')), '· findPoint:', await p.evaluate(()=>{ const q=findPoint('FUEL DRUM'); return q&&q.uw? 'own' : 'no'; }));
 // by position, in degrees and minutes; a bad one is refused
 await p.evaluate(()=>wpOpen()); await p.click('#wpNew'); await p.fill('#wpName','PAD'); await p.fill('#wpLL','nonsense'); await p.click('#wpSave'); console.log('bad position:', await p.textContent('#wpStat'));
 await p.fill('#wpLL','S38 12.50 E144 30.25'); await p.click('#wpSave'); console.log('ddm:', await p.evaluate(()=>{ const w=WPTS.find(x=>x.n==='PAD'); return w.la.toFixed(4)+','+w.lo.toFixed(4); }));
 // edit (same id), delete (tombstone)
 await p.evaluate(()=>$('wpList').querySelector('li[data-id="'+WPTS.find(w=>w.n==='PAD').id+'"] [data-a="ed"]').click()); await p.fill('#wpNote','Hospital pad'); await p.click('#wpSave');
 console.log('edited:', await p.evaluate(()=>WPTS.filter(w=>w.n==='PAD').length+' '+WPTS.find(w=>w.n==='PAD').note));
 await p.evaluate(()=>$('wpList').querySelector('li[data-id="'+WPTS.find(w=>w.n==='PAD').id+'"] [data-a="del"]').click());
 console.log('deleted:', await p.evaluate(()=>WPTS.map(w=>w.n).join(',')+' · tombstones '+ls.get('wptsDel',[]).length));
 // merge: another phone has a newer copy of FUEL DRUM, a new one, and still has PAD (deleted here: stays deleted)
 const m=await p.evaluate(()=>{ const fd=WPTS[0], del=ls.get('wptsDel',[])[0];
   const theirs=[{...fd,note:'Moved to the hangar',t:fd.t+1000},{id:'zz1',n:'CREEK',note:'',la:-38.3,lo:144.4,t:5},{id:del.id,n:'PAD',note:'',la:-38.2,lo:144.5,t:del.t-10},{id:'bad',n:'X',la:'1',lo:2}].filter(wpValid);
   const r=listMerge(WPTS,'wptsDel',theirs,[]); if(r){ WPTS=r; wpStore(); } return WPTS.map(w=>w.n+(w.note?' ('+w.note+')':'')).join('; '); });
 console.log('merged:', m);
 console.log('survives reload:', await p.evaluate(()=>JSON.parse(localStorage.getItem('rc_wpts')).length));
 console.log(errs); await b.close(); })();
