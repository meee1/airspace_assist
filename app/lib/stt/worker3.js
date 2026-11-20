// Offline speech-to-text worker for Radio Calls AU (Options → Radio audio and transcription).
// Runs Whisper (English-only, 8-bit) with Transformers.js / ONNX Runtime Web (WebAssembly) off the page's main thread.
// The model is downloaded once from Hugging Face and kept by Transformers.js in Cache Storage 'transformers-cache';
// the library files in lib/transformers are kept by the app's service worker. After that it works without signal.
// The file name carries a version (worker3.js): lib/ files are cached for good, so a changed worker needs a new name.
// A prompt (nearby aerodromes, reporting points, your type and callsign) is given to Whisper as previous text
// (<|startofprev|> prompt <|startoftranscript|> <|notimestamps|>), which is how it learns the spelling of local names;
// the decoded text repeats the prompt, which is cut off here.
// Memory: the model's weights and working space live in WebAssembly memory, which a page can't otherwise see from a worker
// (no performance.memory here). Every WebAssembly.Memory made or exported is collected and its size summed on request.
const MEMS=new Set(), WM=WebAssembly.Memory;
WebAssembly.Memory=function(d){ const m=new WM(d); MEMS.add(m); return m; }; WebAssembly.Memory.prototype=WM.prototype;
const keep=r=>{ try{ const ex=(r&&r.instance||r).exports; for(const k in ex) if(ex[k] instanceof WM) MEMS.add(ex[k]); }catch(e){} return r; };
{ const I=WebAssembly.instantiate, IS=WebAssembly.instantiateStreaming;
  WebAssembly.instantiate=(...a)=>I.apply(WebAssembly,a).then(keep);
  if(IS) WebAssembly.instantiateStreaming=(...a)=>IS.apply(WebAssembly,a).then(keep); }
const wasmBytes=()=>{ let n=0; for(const m of MEMS) try{ n+=m.buffer.byteLength; }catch(e){} return n; };
let asr=null, tk=null;
const tid=t=>tk.convert_tokens_to_ids? tk.convert_tokens_to_ids(t) : tk.encode(t,{add_special_tokens:false})[0];
self.onmessage=async e=>{ const m=e.data;
  try{
    if(m.t==='mem'){ self.postMessage({t:'mem', wasm:wasmBytes(), n:MEMS.size}); return; }
    if(m.t==='load'){
      const T=await import(m.base+'transformers.min.js');
      T.env.allowLocalModels=false; T.env.useBrowserCache=true;
      T.env.backends.onnx.wasm.wasmPaths={mjs:m.base+'ort-wasm-simd-threaded.asyncify.mjs', wasm:m.base+'ort-wasm-simd-threaded.asyncify.wasm'};
      T.env.backends.onnx.wasm.numThreads=self.crossOriginIsolated? Math.min(4,navigator.hardwareConcurrency||1) : 1;
      asr=await T.pipeline('automatic-speech-recognition',m.model,{device:'wasm', dtype:'q8',
        progress_callback:p=>self.postMessage({t:'prog',p:{status:p.status,file:p.file,loaded:p.loaded,total:p.total}})});
      tk=asr.tokenizer;
      // one short silent run so the first real call doesn't pay for setting up
      const t0=performance.now(); await asr(new Float32Array(16000)); self.postMessage({t:'ready', warm:performance.now()-t0});
    } else if(m.t==='run'){
      if(!asr) throw new Error('model not loaded');
      const o={chunk_length_s:30, stride_length_s:5}; let pre='';
      if(m.prompt){ const pt=tk.encode(' '+m.prompt,{add_special_tokens:false}).slice(-200);
        o.decoder_input_ids=[tid('<|startofprev|>'), ...pt, tid('<|startoftranscript|>'), tid('<|notimestamps|>')];
        pre=tk.decode(pt,{skip_special_tokens:true}).trim(); }
      const t0=performance.now(), r=await asr(m.pcm,o); let text=String(r&&r.text||'').trim();
      if(pre&&text.startsWith(pre)) text=text.slice(pre.length).trim();
      self.postMessage({t:'text', id:m.id, text, ms:performance.now()-t0, dur:m.pcm.length/16000});
    }
  }catch(err){ self.postMessage({t:'err', id:m.id, stage:m.t, msg:String(err&&err.message||err)}); }
};
