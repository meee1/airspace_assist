// Checklists: none shipped; make one (headings, "item .... response"), run it (tick, next item marked, complete, reset),
// ticks survive a reload, editing the items clears its ticks, per-aircraft lists, delete leaves a tombstone, merge.
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
(async()=>{ const b=await chromium.launch(); require('./classic.js')(b); const ctx=await b.newContext(PX9); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 p.on('dialog',d=>d.accept());
 await p.goto('http://localhost:8811/index.html?sim=YBRS&alt=1500&trk=000&gs=0'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(500);
 await p.click('#fpCl'); await p.waitForTimeout(200);
 console.log('empty:', (await p.textContent('#clBody')).replace(/\s+/g,' ').slice(0,90));
 await p.click('#clBody [data-a="new"]'); await p.click('#clBody [data-a="save"]'); console.log('no name:', await p.textContent('#clStat'));
 await p.fill('#clName','Before start (test)'); await p.fill('#clText','# Cabin\nSeat belts .... fastened\nDoors : closed\n\n# Electrical\nBattery ........ ON\nA plain item');
 await p.screenshot({path:'play/checklist_edit.png'});
 await p.click('#clBody [data-a="save"]'); await p.waitForTimeout(200);
 console.log('saved:', await p.evaluate(()=>JSON.stringify(CL.map(c=>[c.name,c.ac,c.items.length]))), '·', (await p.textContent('#clBody .pl-list')).replace(/\s+/g,' ').slice(0,80));
 await p.click('#clBody li [data-a="run"]'); await p.waitForTimeout(200);
 const st0=()=>p.evaluate(()=>({title:$('clTitle').textContent, count:$('clBody').querySelector('.cl-bar .mono').textContent, heads:[...$('clBody').querySelectorAll('li.h')].map(x=>x.textContent), items:[...$('clBody').querySelectorAll('li.i')].map(x=>(x.classList.contains('on')?'[x] ':x.classList.contains('next')?'[>] ':'[ ] ')+x.querySelector('.c').textContent+(x.querySelector('.r')?' = '+x.querySelector('.r').textContent:'')), done:!!$('clBody').querySelector('.cl-done')}));
 console.log('run:', JSON.stringify(await st0()));
 await p.click('#clBody li.i >> nth=0'); await p.click('#clBody li.i >> nth=1'); await p.waitForTimeout(100);
 await p.screenshot({path:'play/checklist_run.png'});
 console.log('two ticked:', JSON.stringify((await st0()).items), (await st0()).count);
 await p.reload(); await p.waitForFunction(()=>typeof render==='function'); await p.click('#fpCl'); await p.click('#clBody li [data-a="run"]');
 console.log('after reload:', (await st0()).count);
 await p.click('#clBody li.i >> nth=2'); await p.click('#clBody li.i >> nth=3'); console.log('all:', (await st0()).count, 'complete shown', (await st0()).done);
 await p.click('#clBody li.i >> nth=3'); console.log('untick:', (await st0()).count);
 await p.click('#clBody [data-a="reset"]'); console.log('reset:', (await st0()).count);
 // editing the items clears its ticks; renaming alone keeps them
 await p.click('#clBody li.i >> nth=0'); await p.click('#clBody [data-a="back"]'); await p.click('#clBody li [data-a="ed"]'); await p.fill('#clName','Before start'); await p.click('#clBody [data-a="save"]');
 console.log('renamed, ticks kept:', await p.evaluate(()=>clCount(CL[0]).join('/')));
 await p.click('#clBody li [data-a="ed"]'); await p.fill('#clText','# Cabin\nSeat belts .... fastened'); await p.click('#clBody [data-a="save"]');
 console.log('items changed, ticks cleared:', await p.evaluate(()=>clCount(CL[0]).join('/')));
 // per aircraft: a list for another aircraft is under "other aircraft"
 await p.evaluate(()=>{ WB.profiles=[{id:'a1',name:'VH-ABC',u:'kg'},{id:'a2',name:'VH-XYZ',u:'kg'}]; WB.cur='a1'; CL.push({id:'c2',name:'Shutdown',ac:'a2',items:['Fuel .... off'],t:1}); clStore(); clRender(); });
 console.log('aircraft split:', await p.evaluate(()=>[...$('clBody').querySelectorAll(':scope > .pl-list li[data-id] b')].map(x=>x.textContent).join(',')+' | other: '+[...$('clBody').querySelectorAll('details li[data-id] b')].map(x=>x.textContent).join(',')));
 // delete + merge
 await p.evaluate(()=>{ CLV.v='edit'; CLV.id='c2'; clRender(); }); await p.click('#clBody [data-a="del"]');
 console.log('deleted:', await p.evaluate(()=>CL.map(c=>c.name).join(',')+' · tombstones '+ls.get('clDel',[]).length));
 console.log('merge:', await p.evaluate(()=>{ const r=listMerge(CL,'clDel',[{id:'c2',name:'Shutdown',ac:'a2',items:['x'],t:1},{id:'c3',name:'Run-up',ac:'',items:['Mags .... both'],t:9},{id:7,name:'bad'}].filter(clValid),[]); if(r){ CL=r; clStore(); } return CL.map(c=>c.name).join(', '); }));
 console.log('ticks not in the backup:', await p.evaluate(()=>!('rc_clTick' in JSON.parse(gdBackup()).keys)&&('rc_cl' in JSON.parse(gdBackup()).keys)));
 console.log(errs); await b.close(); })();
