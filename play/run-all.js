// Run the browser tests in play/ and print a pass/fail summary.
//   node play/run-all.js                 every test except helpers, ones that need a local proxy, and slow ones
//   node play/run-all.js v3d gdrive opts only these (names without .js)
//   node play/run-all.js --all           include the slow ones too
//   node play/run-all.js --quick         one short test per area (about three minutes)
//   JOBS=4 node play/run-all.js          how many at once (default: the CPU count + 1)
//   node play/run-all.js --dpr           the phone's and tablet's real pixel densities (default here: 1x, quicker)
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
const TIMEOUT=+process.env.TEST_TIMEOUT||150e3, JOBS=+process.env.JOBS||require('os').cpus().length+1;
// The tests are CPU-bound (headless Chromium paints in software; measured 60-85% of a test's time is CPU), so running many
// more at once than there are CPUs only makes them time out: one more than the CPU count is about the best. Software WebGL
// and the timing measurements get a CPU to themselves afterwards, so they don't fail alongside the others and run twice.
const ALONE=[...WEBGL,'ctafperf','rwperf','asperf','perf','timings'];
// --quick: one short test per area, about three minutes, for use while working; the whole suite before a commit
const QUICK=['boot','opts','search','go','plans','fpsave','fpedit','gdrive','cfgfile','wx','taf','naips','nbsig','sua','ctafsplit','ctaftwr','twr','measure','fuel','wpts','checklist','share','planwind','sat','satop','tiles','logbk','voice','err','gosrc','brief','trnm','tcas','tilezoom'];
if(!process.env.TEST_DPR&&!args.includes('--dpr')) process.env.TEST_DPR='1';   // play/px9.js: 1x pixels instead of the phone's 3x (--dpr: the real densities)
const names=(pick.length? pick : args.includes('--quick')? QUICK.filter(n=>fs.existsSync(path.join(__dirname,n+'.js'))) : fs.readdirSync(__dirname).filter(f=>f.endsWith('.js')).map(f=>f.slice(0,-3))
  .filter(n=>!HELPERS.includes(n)&&!TOOLS.includes(n)&&!NEED_PROXY.includes(n)&&(all||!SLOW.includes(n))).sort());
// longest first (from the last run's times, play/.durations.json), so the long ones don't end up queued behind each other
const DUR=(()=>{ try{ return JSON.parse(fs.readFileSync(path.join(__dirname,'.durations.json'),'utf8')); }catch(e){ return {}; } })();
const byLen=L=>[...L].sort((a,b)=>(DUR[b]??30)-(DUR[a]??30));

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
  const T0=Date.now(), res=[], say=r=>console.log(`${r.ok?'pass':'FAIL'}  ${r.n.padEnd(14)} ${r.s}s${r.ok?'':'  '+r.why}`);
  const pool=async(L,jobs)=>{ let i=0; await Promise.all(Array.from({length:Math.min(jobs,L.length)},async()=>{ while(i<L.length){ const r=await run(L[i++]); res.push(r); say(r); } })); };
  const alone=names.filter(n=>ALONE.includes(n)), rest=names.filter(n=>!ALONE.includes(n));
  await pool(byLen(rest),JOBS);
  if(alone.length){ if(rest.length) console.log(`\n${alone.length} that need a CPU to themselves…`); await pool(byLen(alone),1); }
  // tests that time things can fail when several browsers share the CPU: run each failure again on its own
  const again=res.filter(r=>!r.ok); if(again.length) console.log(`\nre-running ${again.length} on their own…`);
  for(const r of again){ const r2=await run(r.n); if(r2.ok){ r.ok=true; r.flaky=true; r.s=r2.s; } else Object.assign(r,r2); console.log(`${r.ok?'pass':'FAIL'}  ${r.n.padEnd(14)} ${r2.s}s${r.ok?' (failed alongside other tests)':'  '+r.why}`); }
  try{ for(const r of res) if(r.ok) DUR[r.n]=+r.s; fs.writeFileSync(path.join(__dirname,'.durations.json'),JSON.stringify(DUR)); }catch(e){}
  const bad=res.filter(r=>!r.ok); console.log(`\n${res.length-bad.length}/${res.length} passed in ${Math.round((Date.now()-T0)/60e3)} min${res.some(r=>r.flaky)?' ('+res.filter(r=>r.flaky).length+' only on their own)':''}${bad.length?' · failed: '+bad.map(r=>r.n).join(', '):''}`);
  process.exit(bad.length?1:0); })();
