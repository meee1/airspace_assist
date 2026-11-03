// node test_naips.mjs : the Worker's POST /naips against a fake NAIPS website (no network)
import fs from 'node:fs';
const W=(await import('./worker.js')).default, env={ALLOW_ORIGIN:'https://meee1.github.io,http://localhost:8811'}, waits=[], ctx={waitUntil:p=>waits.push(p)};
const BRIEF=fs.readFileSync(['../play/fixtures/naips_met.txt','../../play/fixtures/naips_met.txt'].map(f=>new URL(f,import.meta.url)).find(f=>fs.existsSync(f)),'utf8');   // repo: tools/notam-worker, build: notam-worker
import {fakeNaips, NAIPS_FAKE} from './fake_naips.mjs';
globalThis.fetch=(u,o)=>fakeNaips(u,o,BRIEF);
const post=async(b,origin='https://meee1.github.io')=>{ const r=await W.fetch(new Request('https://w.dev/naips',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(b)}),env,ctx); return [r.status,await r.json(),r.headers.get('Access-Control-Allow-Origin')]; };
let [s,j,o]=await post({u:'pilot1',p:'secret99',areas:['9300'],met:true}); await Promise.all(waits);
console.log('ok', s, o, j.error||'', 'text', j.text&&j.text.length, j.text===BRIEF.replace(/\r/g,'').replace(/[ \t]+$/gm,'').replace(/\n{3,}/g,'\n\n').trim()?'(identical)':'(differs)', JSON.stringify(j.areas)); console.log('  requests:', NAIPS_FAKE.seen.join(' → ')); NAIPS_FAKE.seen.length=0;
[s,j]=await post({u:'pilot1',p:'wrongpass',areas:['9300']}); console.log('bad password', s, j.error, j.stage);
NAIPS_FAKE.MODE='blocked'; [s,j]=await post({u:'pilot1',p:'secret99',areas:['9300']}); console.log('bot block', s, j.error, JSON.stringify(j.detail).slice(0,90)); NAIPS_FAKE.MODE='ok';
NAIPS_FAKE.MODE='changed'; [s,j]=await post({u:'pilot1',p:'secret99',areas:['9300']}); console.log('site changed', s, j.error, j.detail&&j.detail.forms); NAIPS_FAKE.MODE='ok';
[s,j]=await post({u:'pilot1',p:'secret99',areas:['9300']},'https://evil.example'); console.log('other origin', s, j.error);
[s,j]=await post({u:'pilot 1',p:'x',areas:['9300']}); console.log('bad input', s, j.error);
[s,j]=await post({u:'pilot1',p:'secret99',areas:[]}); console.log('no areas', s, j.error);
const g=await W.fetch(new Request('https://w.dev/naips',{headers:{Origin:'https://meee1.github.io'}}),env,ctx); console.log('GET', g.status);
const pre=await W.fetch(new Request('https://w.dev/naips',{method:'OPTIONS',headers:{Origin:'http://localhost:8811'}}),env,ctx); console.log('preflight', pre.status, pre.headers.get('Access-Control-Allow-Methods'), pre.headers.get('Access-Control-Allow-Headers'));
