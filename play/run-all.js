// Run the browser tests in play/ and print a pass/fail summary.
//   node play/run-all.js                 every test except helpers, ones that need a local proxy, and slow ones
//   node play/run-all.js v3d gdrive opts only these (names without .js)
//   node play/run-all.js --all           include the slow ones too
// Start the app first: python3 assemble.py, then serve dist/ on port 8811 (see CLAUDE.md). Run from the repo's build folder,
// because the tests save screenshots to play/... relative to it.
// A test fails if it exits non-zero, times out, or the last error list it prints ("[]" or a list of quoted messages: the page errors it collected) has
// anything in it other than blocked-network noise (the sandbox can't reach map tiles or fonts). Tests that print no error list
// (measurement probes) pass if they finish.
const {spawn}=require('child_process'), fs=require('fs'), path=require('path'), http=require('http');
const HELPERS=['run-all','classic'];
const TOOLS=['asp','fr24replay','fr24replay_tool','tercmp'];              // take arguments, or compare against a second build on :8813
const NEED_PROXY=['nbdl','satproxy','traffic','trlog','trsel'];   // need the worker (or a stand-in) on localhost:8812
const SLOW=['chart_off','chart','chart_def','chclip','allcharts','play','lenovo','bench','perfbench'];   // import 13-20 MB AIP PDFs (several minutes;
                                                                 // paths in the tests), download every site chart, run a long simulated flight or a benchmark
const WEBGL=['v3d','v3dui','v3dprev','v3dfix'];                  // fine headless, just slower (software WebGL)
const args=process.argv.slice(2), all=args.includes('--all'), pick=args.filter(a=>!a.startsWith('--'));
const names=pick.length? pick : fs.readdirSync(__dirname).filter(f=>f.endsWith('.js')).map(f=>f.slice(0,-3))
  .filter(n=>!HELPERS.includes(n)&&!TOOLS.includes(n)&&!NEED_PROXY.includes(n)&&(all||!SLOW.includes(n))).sort();
const TIMEOUT=+process.env.TEST_TIMEOUT||150e3, JOBS=+process.env.JOBS||3;

function up(){ return new Promise(r=>http.get('http://localhost:8811/index.html',res=>{ res.resume(); r(res.statusCode===200); }).on('error',()=>r(false))); }
function run(n){ return new Promise(done=>{ const t0=Date.now(); let out='';
  const c=spawn(process.execPath,[path.join(__dirname,n+'.js')],{cwd:path.join(__dirname,'..')});
  c.stdout.on('data',d=>out+=d); c.stderr.on('data',d=>out+=d);
  const k=setTimeout(()=>{ out+='\n(timed out)'; c.kill('SIGKILL'); },SLOW.includes(n)?600e3:TIMEOUT);
  c.on('close',code=>{ clearTimeout(k); const lines=out.trim().split('\n'), arr=out.match(/\[\s*(?:['"][^\[\]]*)?\]\s*$/), errs=arr? arr[0].trim().slice(1,-1).split(/',\s*'|",\s*"/).map(x=>x.trim()).filter(Boolean) : [];
    const real=errs.filter(e=>!/ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_PROXY|fonts\.g/.test(e));
    const ok=code===0&&!real.length;
    done({n,ok,code,s:((Date.now()-t0)/1e3).toFixed(0),why:ok?'':(code!==0?`exit ${code}: `:'')+lines.slice(-3).join(' | ').slice(0,300)}); }); }); }

(async()=>{ if(!await up()){ console.error('No app on http://localhost:8811 — build and serve dist/ first.'); process.exit(2); }
  const res=[]; let i=0;
  await Promise.all(Array.from({length:Math.min(JOBS,names.length)},async()=>{ while(i<names.length){ const n=names[i++]; const r=await run(n); res.push(r);
    console.log(`${r.ok?'pass':'FAIL'}  ${n.padEnd(14)} ${r.s}s${r.ok?'':'  '+r.why}`); } }));
  // tests that time things can fail when several browsers share the CPU: run each failure again on its own
  const again=res.filter(r=>!r.ok); if(again.length) console.log(`\nre-running ${again.length} on their own…`);
  for(const r of again){ const r2=await run(r.n); if(r2.ok){ r.ok=true; r.flaky=true; } else Object.assign(r,r2); console.log(`${r.ok?'pass':'FAIL'}  ${r.n.padEnd(14)} ${r2.s}s${r.ok?' (failed alongside other tests)':'  '+r.why}`); }
  const bad=res.filter(r=>!r.ok); console.log(`\n${res.length-bad.length}/${res.length} passed${res.some(r=>r.flaky)?' ('+res.filter(r=>r.flaky).length+' only on their own)':''}${bad.length?' · failed: '+bad.map(r=>r.n).join(', '):''}`);
  process.exit(bad.length?1:0); })();
