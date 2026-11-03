// a fake NAIPS website for tests: login (session + anti-forgery token), Area briefing form, briefing result in <pre>
// fakeNaips(url, opts, brief) -> Response; NAIPS_FAKE.MODE 'ok' | 'blocked' | 'changed'; user pilot1 / secret99
export const NAIPS_FAKE={MODE:'ok', seen:[]};
const page=(body,title='NAIPS')=>`<!DOCTYPE html><html><head><title>${title}</title></head><body>${body}</body></html>`;
const esc=t=>t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const logon=(err='')=>page(`${err?`<div class="validation-summary-errors"><ul><li>${err}</li></ul></div>`:''}<form action="/naips/Account/LogOn" id="frmLogon" method="post"><input name="__RequestVerificationToken" type="hidden" value="tok1" /><input id="UserName" name="UserName" type="text" value="" /><input type="text" /><input type="password" /><input id="Password" name="Password" type="password" /><input type="submit" id="btnSubmit" value="Log On" /></form>`,'NAIPS Login');
export async function fakeNaips(url,o={},BRIEF){ url=String(url); const m=o.method||'GET', ck=(o.headers&&o.headers.Cookie)||'', body=o.body?String(o.body):''; NAIPS_FAKE.seen.push(m+' '+url.replace('https://www.airservicesaustralia.com','')+(ck?' ['+ck+']':''));
  const P=new URLSearchParams(body), H=(h={})=>({headers:{'content-type':'text/html',...h}}), MODE=NAIPS_FAKE.MODE;
  if(MODE==='blocked') return new Response(page('Request Rejected. Your support ID is: 123','Request Rejected'),H());
  if(url.endsWith('/naips/Account/LogOn')&&m==='GET') return new Response(logon(),H({'set-cookie':'ASP.NET_SessionId=s1; path=/; HttpOnly'}));
  if(url.endsWith('/naips/Account/LogOn')&&m==='POST'){ if(!/ASP\.NET_SessionId=s1/.test(ck)||P.get('__RequestVerificationToken')!=='tok1') return new Response('bad token',{status:400});
    if(P.get('UserName')==='pilot1'&&P.get('Password')==='secret99') return new Response('',{status:302,headers:{location:'/naips/','set-cookie':'.ASPXAUTH=auth1; path=/; HttpOnly'}});
    return new Response(logon('The user name or password provided is incorrect.'),H()); }
  if(url.endsWith('/naips/')) return new Response(page('Welcome'),H());
  if(url.endsWith('/naips/Briefing/Area')&&m==='GET'){ if(!/\.ASPXAUTH=auth1/.test(ck)) return new Response('',{status:302,headers:{location:'/naips/Account/LogOn'}});
    return new Response(page(`<form action="/naips/Briefing/Area" method="post"><input name="__RequestVerificationToken" type="hidden" value="tok2" /><input name="BriefingArea1" type="text" /><input name="Validity" type="text" value="12"/></form>`),H()); }
  if(url.endsWith('/naips/Briefing/Area')&&m==='POST'){ if(!/\.ASPXAUTH=auth1/.test(ck)) return new Response('',{status:302,headers:{location:'/naips/Account/LogOn'}});
    if(MODE==='changed') return new Response(page('<form action="/naips/Briefing/NewArea"><input name="Areas"/></form>','Area Briefing'),H());
    const okq=P.get('__RequestVerificationToken')==='tok2'&&P.get('BriefingArea1')&&P.getAll('Notam')[0]==='true';
    return new Response(page(okq?`<h2>Area Briefing Results</h2><pre>${esc(BRIEF)}</pre>`:'bad request '+body,'Area Briefing Results'),H()); }
  if(url.endsWith('/naips/Account/LogOff')) return new Response('',{status:302,headers:{location:'/naips/Account/LogOn'}});
  return new Response('?',{status:404}); }
