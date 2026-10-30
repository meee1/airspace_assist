// Local test: the real worker.js on http://localhost:8812 with a fake ADS-B feed behind it (no network)
import http from 'node:http';
// fake ADS-B around Barwon Heads: one converging (TA), one proximate, one far, and the ownship (VH-EAN)
const T0=Date.now(), mv=(la,lo,trk,gs)=>{ const s=(Date.now()-T0)/3600e3*gs/60; return [la+s*Math.cos(trk*Math.PI/180), lo+s*Math.sin(trk*Math.PI/180)/Math.cos(la*Math.PI/180)]; };
const ADSB=()=>{ const own=globalThis.OWN||[-38.2581,144.4275];
  const a=mv(own[0]+0.03,own[1]-0.01,180,90), b=mv(own[0]-0.05,own[1]+0.08,300,110), c=mv(own[0]+0.25,own[1]+0.2,45,140);
  return {ac:[{hex:'7c1234',flight:'VOZ123 ',r:'VH-VOZ',t:'C172',lat:a[0],lon:a[1],alt_baro:1700,alt_geom:1820,gs:90,track:180,baro_rate:-500,category:'A1',seen_pos:1.2},
    {hex:'7c2222',flight:'HEL2',r:'VH-HLX',t:'B06',lat:b[0],lon:b[1],alt_baro:2400,alt_geom:2520,gs:110,track:300,baro_rate:0,category:'A7',seen_pos:0.5},
    {hex:'7c3333',flight:'QFA401',r:'VH-XZA',t:'A333',lat:c[0],lon:c[1],alt_baro:8000,alt_geom:8150,gs:250,track:45,baro_rate:1500,category:'A5',seen_pos:0.8},
    {hex:'7c0ea0',flight:'',r:'VH-EAN',t:'B06',lat:own[0],lon:own[1],alt_baro:1500,alt_geom:1600,gs:100,track:45,category:'A7',seen_pos:0.3}]}; };
globalThis.fetch=async(u,o={})=>{ u=String(u);
  if(u.includes('adsb.lol')||u.includes('adsb.fi')){ const m=/point\/(-?[\d.]+)\/(-?[\d.]+)/.exec(u); if(!globalThis.OWN) globalThis.OWN=[+m[1],+m[2]]; return new Response(JSON.stringify(ADSB())); }
  // fake Esri imagery (when ESRI_KEY is set below): a 256/512 px PNG per tile, green checker with the tile id baked in by colour
  const t=/tile\/(\d+)\/(\d+)\/(\d+)\?token=/.exec(u);
  if(t&&/arcgis\.com/.test(u)){ globalThis.ESRI_HITS=(globalThis.ESRI_HITS||0)+1; return new Response(fakePng(/static-map/.test(u)?512:256,(+t[2]+ +t[3])%2),{headers:{'content-type':'image/png'}}); }
  return new Response('not found',{status:404}); };
import zlib from 'node:zlib';
function fakePng(S,odd){ const crcT=[]; for(let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++) c=c&1?0xedb88320^(c>>>1):c>>>1; crcT[n]=c>>>0; }
  const crc=b=>{ let r=0xffffffff; for(const x of b) r=crcT[(r^x)&255]^(r>>>8); return (r^0xffffffff)>>>0; };
  const ch=(ty,d)=>{ const l=Buffer.alloc(4); l.writeUInt32BE(d.length); const td=Buffer.concat([Buffer.from(ty),d]); const c=Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l,td,c]); };
  const raw=Buffer.alloc((S*3+1)*S); for(let y=0;y<S;y++) for(let x=0;x<S;x++){ const o=y*(S*3+1)+1+x*3, e=x<2||y<2; raw[o]=e?80:odd?110:150; raw[o+1]=e?80:odd?160:195; raw[o+2]=e?80:odd?110:150; }
  const ih=Buffer.alloc(13); ih.writeUInt32BE(S,0); ih.writeUInt32BE(S,4); ih[8]=8; ih[9]=2;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),ch('IHDR',ih),ch('IDAT',zlib.deflateSync(raw)),ch('IEND',Buffer.alloc(0))]); }
const store=new Map(); globalThis.caches={default:{match:async k=>store.get(k.url)?.clone(), put:async(k,r)=>{ store.set(k.url,r); }}};
const W=(await import('./worker.js')).default, env={ALLOW_ORIGIN:'http://localhost:8811', ESRI_KEY:'mock-key'};
http.createServer(async(req,res)=>{ const r=await W.fetch(new Request('http://localhost:8812'+req.url,{method:req.method,headers:req.headers}),env,{waitUntil:()=>{}});
  res.writeHead(r.status,Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer())); if(/\/tile\//.test(req.url)) globalThis.PROXY_TILES=(globalThis.PROXY_TILES||0)+1; }).listen(8812,()=>console.log('mock traffic proxy on :8812'));
setInterval(()=>{ if(globalThis.PROXY_TILES) process.stdout.write(`tiles served ${globalThis.PROXY_TILES}, fetched from "Esri" ${globalThis.ESRI_HITS||0}\n`); },2000).unref();
