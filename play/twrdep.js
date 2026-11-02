// Moorabbin East/West tower: departing, the side of the next plan point after YMMB (ERSA "DEP to the E call 118.1")
const {chromium}=require('playwright'); const {PX9}=require('./px9.js');
const C=[ // name, pos, trk, plan [pts], active i, expect
 ['on field, plan YMMB->E',      [-37.9758,145.1022],0,  ['YMMB',[-37.95,145.30,'EPT']],0,'118.1'],
 ['after T/O rwy 17 (S), plan E',[-37.995,145.098],170,  ['YMMB',[-37.95,145.30,'EPT']],1,'118.1'],
 ['after T/O rwy 17, plan W',    [-37.995,145.098],170,  ['YMMB',[-37.95,144.98,'WPT']],1,'123.0'],
 ['on field, plan YMMB->W->E',   [-37.9758,145.1022],0,  ['YMMB',[-37.95,144.98,'WPT'],[-37.95,145.30,'EPT']],0,'123.0'],
 ['arriving from E, plan E->YMMB',[-37.96,145.16],250,   [[-37.95,145.30,'EPT'],'YMMB'],1,'118.1'],
 ['arriving from S (CARR), E->YMMB',[-38.03,145.105],0,  [[-37.95,145.30,'EPT'],'YMMB'],1,'123.0'],
 ['round trip back in from E',   [-37.96,145.16],250,    ['YMMB',[-37.95,145.30,'EPT'],'YMMB'],2,'118.1'],
 ['no plan, on field, Go to E',  [-37.9758,145.1022],0,  null,0,'118.1'],
];
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({...PX9}); await ctx.addInitScript(()=>{ const D=Date, off=D.parse('2026-11-02T01:00:00Z')-D.now(); window.Date=class extends D{ constructor(...a){ super(...(a.length?a:[D.now()+off])); } static now(){ return D.now()+off; } }; });
 const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); await p.goto('http://localhost:8811/index.html?sim=YMMB&alt=200&trk=000&gs=0'); await p.waitForFunction(()=>typeof twrPick==='function'); await p.waitForTimeout(800);
 let bad=0; for(const [n,pos,trk,plan,i,exp] of C){ const r=await p.evaluate(([pos,trk,plan,i])=>{ const a=DATA.ap.find(x=>x.i==='YMMB'); st.twrMem={};
   FP= plan? {pts:plan.map(q=>q==='YMMB'?{n:'YMMB',c:'YMMB',la:a.la,lo:a.lo}:{n:q[2],la:q[0],lo:q[1]}),i,rev:1} : null; GO= plan? null : {la:-37.95,lo:145.30,n:'EPT',c:'EPT'};
   st.pos=pos; st.trk=trk; st.gs=trk?90:0; st.alt=trk?1000:50; const [d,b]=distBrg(pos[0],pos[1],a.la,a.lo); const t=twrPick(a,{a,d,b}); return t.tw[2]+' '+t.side+(t.dep?' dep→'+(t.dep.pt.n||'')+' '+Math.round(t.dep.brg):'')+(t.via?' via '+t.via.rp:''); },[pos,trk,plan,i]);
   const ok=r.startsWith(exp); if(!ok) bad++; console.log((ok?'ok  ':'BAD ')+n.padEnd(34)+r); }
 // Radio calls text for the departing case
 await p.evaluate(()=>{ const a=DATA.ap.find(x=>x.i==='YMMB'); FP={pts:[{n:'YMMB',c:'YMMB',la:a.la,lo:a.lo},{n:'EPT',la:-37.95,lo:145.30}],i:1,rev:1}; GO=null; st.pos=[-37.995,145.098]; st.trk=170; st.gs=90; st.alt=1000; st.pin='YMMB'; render(); });
 await p.waitForTimeout(400); console.log(await p.evaluate(()=>{ const t=$('calls').textContent; const k=t.indexOf('Departing'); return k<0? 'no departing note: '+t.slice(0,200) : t.slice(k,k+140); }));
 console.log(bad?bad+' failed':'all ok',errs); await b.close(); })();
