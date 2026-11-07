// For tests written before the full-screen map became the default (Nov 2026): every new context starts in the classic
// (scrolling) layout, unless the test sets rc_fsMap itself. Use: require('./classic.js')(browser)
module.exports=b=>{ const nc=b.newContext.bind(b);
  b.newContext=async o=>{ const c=await nc(o); await c.addInitScript(()=>{ try{ if(localStorage.getItem('rc_fsMap')==null) localStorage.setItem('rc_fsMap','false'); }catch(e){} }); return c; };
  b.newPage=async o=>(await b.newContext(o)).newPage(); return b; };
