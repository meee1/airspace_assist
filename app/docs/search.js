/* Help search (25 Nov 2026, Michael: "Make sure the doc is fuzzy searchable"). Loads search.json (built from the pages by
   tools/docsindex.py; stored offline with the app) and ranks sections for the words typed:
   - each word matches a section word exactly, by prefix, inside a longer word (4+ letters), or with a typo
     (1 edit for 4-6 letters, 2 for 7+), also with hyphens and spaces ignored ("readback" = "read-back", "adsb" = "ADS-B");
   - a few aviation synonyms (e6b = flight computer, w&b = weight and balance, ...);
   - words in the page or section title count more; all the words must match (one may be missing with 3+ words);
   - the whole phrase found as typed is a bonus.
   Results: page › section, a snippet with the matches marked, a link to page.html#section. Enter opens the first. */
(function(){
  'use strict';
  var IDX=null, VOC=null, loading=null;
  var SYN={e6b:['flight computer'],e6:['flight computer'],wb:['weight balance'],'w&b':['weight balance'],cg:['centre gravity','weight balance'],
    adsb:['traffic'],tcas:['traffic'],sartime:['flight note'],stt:['transcription'],whisper:['transcription'],speech:['transcription','spoken'],
    voice:['spoken','transcription'],mic:['microphone'],headset:['bose','audio input'],a30:['bose'],ctr:['control zone'],twr:['tower'],
    rwy:['runway'],wx:['weather'],qnh:['pressure'],da:['density altitude'],pa:['pressure altitude'],lsalt:['lowest safe'],
    notam:['notams'],gpx:['flight plan'],fpl:['flight plan'],dct:['direct'],xwind:['crosswind'],hige:['ige'],hoge:['oge'],
    ige:['hover'],oge:['hover'],sat:['satellite'],vtc:['charts'],vnc:['charts'],wac:['charts'],sos:['emergency','mayday'],
    mayday:['emergency'],drive:['google drive'],backup:['settings file','drive'],offline:['without signal']};
  function norm(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim(); }
  function words(s){ var n=norm(s); return n? n.split(' ') : []; }
  function lev(a,b,max){ if(Math.abs(a.length-b.length)>max) return max+1; var prev=[],cur,i,j;
    for(j=0;j<=b.length;j++) prev[j]=j;
    for(i=1;i<=a.length;i++){ cur=[i]; var best=i; for(j=1;j<=b.length;j++){ cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
        if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1]) cur[j]=Math.min(cur[j],prev[j-2]+1); if(cur[j]<best) best=cur[j]; }
      if(best>max) return max+1; prev=cur; }
    return prev[b.length]; }
  function load(){ if(loading) return loading;
    loading=fetch('search.json').then(function(r){ return r.json(); }).then(function(d){ IDX=d; VOC={};
      d.forEach(function(e,i){ e.sw=words(e.s); e.pw=words(e.pt); e.n=norm(e.t); e.c=e.n.replace(/ /g,''); e.sc_=norm(e.s).replace(/ /g,''); e.pc=norm(e.pt).replace(/ /g,'');
        var cnt={}; e.sw.concat(e.pw,words(e.t)).forEach(function(w){ cnt[w]=(cnt[w]||0)+1; });
        Object.keys(cnt).forEach(function(w){ (VOC[w]=VOC[w]||[]).push([i,cnt[w]]); }); });
      return d; });
    return loading; }
  // score of one query word per section index: {i: score}
  function wordHits(q){ var out={}, max= q.length>=7? 2 : q.length>=4? 1 : 0;
    function give(list,sc){ list.forEach(function(x){ var v=sc*(1+0.3*Math.log(x[1])); if(!(out[x[0]]>=v)) out[x[0]]=v; }); }   // repeated mentions count a little more
    Object.keys(VOC).forEach(function(w){ var sc=0;
      if(w===q) sc=3; else if(w.indexOf(q)===0) sc= q.length>=3? 2.4 : 1.2;
      else if(q.length>=4&&w.indexOf(q)>0) sc=1.4;
      else if(max&&w.length>=4&&w[0]===q[0]){ var d=lev(q, w.length>q.length+max? w.slice(0,q.length+1) : w, max); if(d<=max) sc= d===1? 2 : 1.4; }   // a typo keeps the first letter
      if(sc) give(VOC[w],sc); });
    if(q.length>=3) IDX.forEach(function(e,i){ if(!(out[i]>=1.6)&&e.c.indexOf(q)>=0) out[i]=Math.max(out[i]||0,1.6); });   // across hyphens / spaces: readback, adsb, e6b
    return out; }
  var STOP={and:1,the:1,a:1,an:1,of:1,to:1,in:1,on:1,for:1,is:1,it:1,with:1,my:1,how:1,do:1,i:1,what:1,does:1,can:1,at:1,by:1,or:1};
  function search(qs){ qs=String(qs||'').replace(/\bw\s*(?:&|and)\s*b\b/gi,'weight balance').replace(/\bgo\s*to\b/gi,'goto go to');
    var Q0=words(qs).filter(function(w){ return w.length>1||/\d/.test(w); }), Q=Q0.filter(function(w){ return !STOP[w]; }); if(!Q.length) Q=Q0; if(!Q.length) return [];
    var groups=Q.map(function(q){ var alts=[q].concat(SYN[q]||[]), best={};
      alts.forEach(function(a,k){ var aw=words(a), per=aw.map(wordHits), f=k? 0.85 : 1;
        IDX.forEach(function(e,i){ var s=0; for(var j=0;j<per.length;j++){ if(!per[j][i]) return; s+=per[j][i]; } s=s/per.length*f; if(!(best[i]>=s)) best[i]=s; }); });
      return best; });
    var need= Q.length>=3? Q.length-1 : Q.length, phrase=norm(qs), res=[];
    IDX.forEach(function(e,i){ var n=0, sc=0;
      groups.forEach(function(g,k){ if(g[i]){ n++; var q=Q[k], hit=function(w){ return w===q||(q.length>=3&&w.indexOf(q)===0)||(q.length>=5&&w[0]===q[0]&&lev(q,w,1)<=1); };
          var tb= e.sw.some(hit)? 2 : e.pw.some(hit)? 1.15 : 1; sc+=g[i]*tb; } });   // the section's own title counts most
      if(n<need) return;
      var pc=phrase.replace(/ /g,''); if(phrase.length>3&&e.n.indexOf(phrase)>=0) sc+=2; if(pc.length>3&&e.sc_.indexOf(pc)>=0) sc+=4; else if(pc.length>3&&e.pc.indexOf(pc)>=0) sc+=1;
      if(!e.s) sc*=0.8;   // the page intro ranks under its sections
      res.push({e:e, sc:sc+n}); });
    res.sort(function(a,b){ return b.sc-a.sc; });
    if(res.length) res=res.filter(function(r){ return r.sc>=res[0].sc*0.35; });   // drop the weak tail
    return res.slice(0,12).map(function(r){ return r.e; }); }
  function esc(s){ return String(s).replace(/[&<>"]/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function snippet(e,qs){ var Q=words(qs), t=e.t, low=t.toLowerCase(), at=-1;
    for(var k=0;k<Q.length&&at<0;k++){ var m=low.indexOf(Q[k]); if(m<0&&Q[k].length>4) m=low.indexOf(Q[k].slice(0,4)); at=m; }
    var a=Math.max(0,(at<0?0:at)-50), s=(a?'…':'')+t.slice(a,a+170)+(a+170<t.length?'…':''), h=esc(s);
    Q.forEach(function(q){ if(q.length<3) return; h=h.replace(new RegExp('('+q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').slice(0,Math.max(3,Math.min(q.length,6)))+'[a-z0-9-]*)','gi'),'<mark>$1</mark>'); });
    return h; }
  function link(e){ return e.p+(e.id?'#'+e.id:''); }
  function setup(form){
    var inp=form.querySelector('input'), ul=form.querySelector('ul'), sel=-1, list=[], t=0;
    function show(){ var qs=inp.value.trim(); if(!qs){ ul.hidden=true; ul.innerHTML=''; return; }
      load().then(function(){ list=search(qs); sel=list.length?0:-1;
        ul.innerHTML= list.length? list.map(function(e,i){ return '<li'+(i===0?' class="on"':'')+'><a href="'+esc(link(e))+'"><b>'+esc(e.pt)+(e.s?' › '+esc(e.s):'')+'</b><span>'+snippet(e,qs)+'</span></a></li>'; }).join('')
          : '<li class="none">Nothing found for “'+esc(qs)+'”. Try fewer or other words.</li>';
        ul.hidden=false; }).catch(function(){ ul.innerHTML='<li class="none">Search isn\'t available (the index didn\'t load).</li>'; ul.hidden=false; }); }
    inp.addEventListener('input',function(){ clearTimeout(t); t=setTimeout(show,120); });
    inp.addEventListener('focus',function(){ load(); if(inp.value.trim()) show(); });
    inp.addEventListener('keydown',function(ev){ var li=ul.querySelectorAll('li:not(.none)');
      if(ev.key==='ArrowDown'||ev.key==='ArrowUp'){ if(!li.length) return; ev.preventDefault(); sel=(sel+(ev.key==='ArrowDown'?1:-1)+li.length)%li.length;
        for(var i=0;i<li.length;i++) li[i].classList.toggle('on',i===sel); li[sel].scrollIntoView({block:'nearest'}); }
      else if(ev.key==='Escape'){ ul.hidden=true; inp.blur(); } });
    form.addEventListener('submit',function(ev){ ev.preventDefault(); clearTimeout(t);
      load().then(function(){ var L=search(inp.value); if(!L.length){ show(); return; } location.href=link(L[Math.max(0,Math.min(sel,L.length-1))]); }); });
    document.addEventListener('pointerdown',function(ev){ if(!form.contains(ev.target)) ul.hidden=true; });
    var q=/[?&]q=([^&#]*)/.exec(location.search); if(q&&form.id==='dsBig'){ inp.value=decodeURIComponent(q[1].replace(/\+/g,' ')); show(); } }
  window.helpSearch=function(q){ return load().then(function(){ return search(q).map(function(e){ return link(e); }); }); };   // for tests
  function go(){ var F=document.querySelectorAll('form.dsrch'); for(var i=0;i<F.length;i++) setup(F[i]); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',go); else go();
})();
