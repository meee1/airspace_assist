// Power lines (Wires layer + WIRES warning) from the Moorabbin–Dandenong sample, and the rain radar layer with RainViewer mocked
const {chromium}=require('playwright'); const {PX9}=require('./px9.js'); const zlib=require('zlib');
function png(w,h,rgba){ const raw=Buffer.alloc((w*4+1)*h); for(let y=0;y<h;y++){ raw[y*(w*4+1)]=0; for(let x=0;x<w;x++) rgba.copy(raw,y*(w*4+1)+1+x*4); }
  const crc=b=>{ let c=~0; for(const v of b){ c^=v; for(let k=0;k<8;k++) c=c&1?(c>>>1)^0xEDB88320:c>>>1; } return ~c>>>0; };
  const ch=(t,d)=>{ const l=Buffer.alloc(4); l.writeUInt32BE(d.length); const td=Buffer.concat([Buffer.from(t),d]), c=Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l,td,c]); };
  const ih=Buffer.alloc(13); ih.writeUInt32BE(w,0); ih.writeUInt32BE(h,4); ih[8]=8; ih[9]=6; return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),ch('IHDR',ih),ch('IDAT',zlib.deflateSync(raw)),ch('IEND',Buffer.alloc(0))]); }
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({...PX9}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 const now=Math.floor(Date.now()/1000/600)*600; let rvHits=0, tiles=0;
 await ctx.route('https://api.rainviewer.com/**',r=>{ rvHits++; r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({version:'2.0',generated:now,host:'https://tilecache.rainviewer.com',radar:{past:[{time:now-1200,path:'/v2/radar/aaa'},{time:now-600,path:'/v2/radar/bbb'}],nowcast:[]}})}); });
 await ctx.route('https://tilecache.rainviewer.com/**',r=>{ tiles++; r.fulfill({status:200,contentType:'image/png',headers:{'access-control-allow-origin':'*'},body:png(256,256,Buffer.from([30,90,220,150]))}); });
 await p.addInitScript(()=>{ window.__said=[]; Object.defineProperty(window,'speechSynthesis',{value:{speak:u=>window.__said.push(u.text)},configurable:true}); window.SpeechSynthesisUtterance=function(t){ this.text=t; }; });
 await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=300&trk=000&gs=90'); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(800);
 await p.evaluate(()=>{ ls.set('trVoice',true); CH.on=false; });
 await p.waitForFunction(()=>PL.d,null,{timeout:8000}).catch(()=>{});
 console.log('loaded:', await p.evaluate(()=>PL.d? `${PL.d.L.length} lines, ${PL.grid.size} grid cells · ${PL.d.src}` : 'no data '+PL.err));
 // fly north 1 NM south of the 220 kV line's first point (145.0773, -37.9408), low then high
 const fly=(alt,dla)=>p.evaluate(([alt,dla])=>{ $('simPos').value=(-37.9408-dla)+',145.0790'; $('simAlt')&&($('simAlt').value=alt); st.alt=alt; simApply(); st.alt=alt; render(); const t=terrainFt(st.pos[0],st.pos[1]);
   return `alt ${alt} terrain ${t==null?'?':Math.round(t)} → ${$('sWires').hidden?'(no warning)':$('sWires').innerText.replace(/\s+/g,' ')}`; },[alt,dla]);
 console.log('300 ft, 1 NM south :', await fly(300,1/60));
 console.log('300 ft, 3 NM south :', await fly(300,3/60));
 console.log('900 ft, 1 NM south :', await fly(900,1/60));
 console.log('said:', await p.evaluate(()=>JSON.stringify(window.__said)));
 await p.evaluate(()=>{ PL.warn=false; }); console.log('warning off       :', await fly(300,1/60)); await p.evaluate(()=>{ PL.warn=true; });
 // the layer, 10 NM, with the warning marker
 await fly(300,1/60); await p.click('#mapWire'); await p.evaluate(()=>{ MAP.range=10; render(); }); await p.waitForTimeout(300);
 const m=await p.$('.mapbox'); await m.scrollIntoViewIfNeeded(); await m.screenshot({path:'wires_map.png'});
 // radar
 await p.click('#mapWire'); await p.click('#mapRadar'); await p.waitForTimeout(1200); await p.evaluate(()=>{ MAP.range=40; render(); }); await p.waitForTimeout(800);
 console.log('radar:', await p.evaluate(()=>`frame ${RAD.fr&&RAD.fr.path} err '${RAD.err}' tiles cached ${RAD.img.size}`), `· api calls ${rvHits} · tile requests ${tiles}`);
 await m.screenshot({path:'radar_map.png'});
 console.log('canvas readable (not tainted):', await p.evaluate(()=>{ try{ $('map').toDataURL(); return true; }catch(e){ return e.name; } }));
 console.log(errs); await b.close(); })();
