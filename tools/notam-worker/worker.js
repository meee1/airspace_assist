/*
 * Radio Calls AU proxy (Cloudflare Worker)
 * =========================================
 *
 * The app is a static page on GitHub Pages, so it can't keep secrets and can't call services that don't send CORS
 * headers. This Worker sits in between for four jobs:
 *
 *   GET  /traffic?lat=&lon=&nm=        ADS-B traffic around a point
 *   GET  /tile/{wi|st}/{z}/{y}/{x}     Esri satellite tiles (the Esri key stays here)
 *   POST /naips                        the pilot's own NAIPS area briefing, with their login
 *   GET|POST /gauth                    Google sign-in for saving flight logs to Drive (the client secret stays here)
 *
 * Nothing the app sends (NAIPS password, Google tokens) is stored or logged here.
 * (It used to proxy FAA NOTAMs too; those were removed on 29 Oct 2026: NOTAMs now come only from a NAIPS briefing.)
 *
 * Settings (wrangler.toml vars, or the Cloudflare dashboard → Settings → Variables and Secrets):
 *   ALLOW_ORIGIN          comma-separated origins allowed to use the proxy, e.g. "https://meee1.github.io,http://localhost:8811"
 *   ADSBLOL_KEY           (secret, optional) adsb.lol API key: tried first, on its keyed re-api
 *   ADSB_URL, ADSB_KEY    (optional) a different readsb-style feed instead of adsb.lol/adsb.fi; ADSB_KEY goes in "api-auth"
 *   ESRI_KEY              (secret) Esri location-services key for /tile
 *   GOOGLE_CLIENT_ID      (secret) Google OAuth "Web application" client, with https://meee1.github.io as a JavaScript origin
 *   GOOGLE_CLIENT_SECRET  (secret) its client secret
 * Secrets: npx wrangler secret put NAME, or the dashboard (type Secret).
 */


/* ===================================================================================================================
 * Shared helpers
 * =================================================================================================================== */

const USER_AGENT = 'radio-au-proxy (personal VFR app)';

/** The origins listed in ALLOW_ORIGIN, as an array (empty when the variable isn't set). */
function allowedOrigins(env) {
  return (env.ALLOW_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
}

/** CORS headers for a request: echo its Origin when it's allowed, otherwise name the first allowed one. */
function corsHeaders(req, env) {
  const origin = req.headers.get('Origin') || '';
  const allowed = allowedOrigins(env);
  return {
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : (allowed[0] || '*'),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

/** A JSON response with the given status and extra headers. */
function json(body, status, headers) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

/** fetch() that gives up after `ms` milliseconds (throws an AbortError). */
async function fetchWithTimeout(url, options, ms) {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: abort.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** A copy of a cached response with this request's CORS headers and an X-Cache marker (HIT / MISS). */
function withHeaders(response, cors, cacheState) {
  const copy = new Response(response.body, response);
  for (const [k, v] of Object.entries(cors)) copy.headers.set(k, v);
  copy.headers.set('X-Cache', cacheState);
  return copy;
}


/* ===================================================================================================================
 * Router
 * =================================================================================================================== */

export default {
  async fetch(req, env, ctx) {
    const cors = corsHeaders(req, env);

    // CORS preflight (the browser asks before a POST with a JSON body); the answer may be cached for a day
    if (req.method === 'OPTIONS') return new Response(null, { headers: { ...cors, 'Access-Control-Max-Age': '86400' } });

    const url = new URL(req.url);
    if (url.pathname === '/traffic')        return traffic(url, env, ctx, cors);
    if (url.pathname.startsWith('/tile/'))  return tile(req, url, env, ctx, cors);
    if (url.pathname === '/naips')          return naips(req, env, ctx, cors);
    if (url.pathname === '/gauth')          return gauth(req, env, cors);

    return json({ error: 'use /traffic?lat=&lon=&nm=, /tile/{wi|st}/{z}/{y}/{x}, POST /naips or /gauth' }, 404, cors);
  },
};


/* ===================================================================================================================
 * GET /traffic?lat=-38.25&lon=144.43&nm=25            ADS-B traffic within nm (1-100, default 25) of a point
 *
 * Answer: {src, keyed, skipped, t, nm, n, ac:[...]}
 *   src      the feed that answered (host name)
 *   keyed    true when the ADSBLOL_KEY secret is set
 *   skipped  why earlier feeds were passed over (e.g. "re-api.adsb.lol 401: invalid api key")
 *   nm       the radius actually used (after the 1-100 limit)
 *   ac       one entry per aircraft:
 *            {hex, flt (callsign), reg, type, la, lo,
 *             ab   barometric altitude ft (null on the ground, then gnd: true),
 *             ag   geometric (GNSS, WGS84 ellipsoid) altitude ft,
 *             gs, trk, vs (ft/min), cat (emitter category), seen (age of the position, s)}
 * On failure: 502 {error, keyed, errors:[one line per feed]}.
 * Answers are cached for 3 s per ~0.6 NM square, so nearby callers share them. Add &debug=1 to skip the cache.
 *
 * Feeds, in order (the first that answers wins):
 *   1. adsb.lol's keyed re-api (only with the ADSBLOL_KEY secret; key in the x-api-key header)
 *   2. adsb.lol's public v2 API, WITHOUT the key: a key bound to another address makes it answer
 *      401 "api key bound to a different address", although the public API needs no key at all
 *   3. adsb.fi's open data API
 * ADSB_URL (with ADSB_KEY as "api-auth") replaces the whole list.
 * adsb.lol data is ODbL. (airplanes.live's API answers 403 "please contact us" unless they approve the project.)
 * =================================================================================================================== */

const TRAFFIC_MAX_NM = 100;
const TRAFFIC_DEFAULT_NM = 25;
const FEED_TIMEOUT_MS = 5000;

async function traffic(url, env, ctx, cors) {
  // --- read and check the query ---
  const lat = parseFloat(url.searchParams.get('lat'));
  const lon = parseFloat(url.searchParams.get('lon'));
  const askedNm = Math.round(parseFloat(url.searchParams.get('nm')) || TRAFFIC_DEFAULT_NM);
  const nm = Math.min(TRAFFIC_MAX_NM, Math.max(1, askedNm));
  if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) return json({ error: 'give lat/lon' }, 400, cors);

  // --- cache: positions rounded to 0.01° (~0.6 NM), so nearby callers share an answer ---
  const la = lat.toFixed(2), lo = lon.toFixed(2);
  const debug = url.searchParams.has('debug');   // ?debug=1: skip the cache, so every feed is asked now
  const cacheKey = new Request(`https://adsb.cache/v1?${la},${lo},${nm}`);
  const cache = caches.default;
  const cached = debug ? null : await cache.match(cacheKey);
  if (cached) return withHeaders(cached, cors, 'HIT');

  // --- the feeds to try, each [url template, extra request headers] ---
  const baseHeaders = { Accept: 'application/json', 'User-Agent': USER_AGENT };
  let feeds;
  if (env.ADSB_URL) {
    feeds = [[env.ADSB_URL, env.ADSB_KEY ? { 'api-auth': env.ADSB_KEY } : {}]];
  } else {
    feeds = [];
    if (env.ADSBLOL_KEY) feeds.push(['https://re-api.adsb.lol/?circle={lat},{lon},{nm}', { 'x-api-key': env.ADSBLOL_KEY }]);
    feeds.push(['https://api.adsb.lol/v2/point/{lat}/{lon}/{nm}', {}]);
    feeds.push(['https://opendata.adsb.fi/api/v2/lat/{lat}/lon/{lon}/dist/{nm}', {}]);
  }

  // --- ask each feed in turn until one answers ---
  let data = null, feedUrl = '';
  const errors = [];
  for (const [template, headers] of feeds) {
    feedUrl = template.replace('{lat}', la).replace('{lon}', lo).replace('{nm}', nm);
    const host = new URL(feedUrl).host;
    try {
      const r = await fetchWithTimeout(feedUrl, { headers: { ...baseHeaders, ...headers } }, FEED_TIMEOUT_MS);
      if (!r.ok) {
        errors.push(`${host} ${r.status}: ${(await r.text()).slice(0, 120)}`);
        continue;
      }
      data = await r.json();
      break;
    } catch (e) {
      errors.push(`${host}: ${e.name === 'AbortError' ? 'timeout' : e.message}`);
    }
  }
  if (!data) return json({ error: 'ADS-B feed unavailable', keyed: !!env.ADSBLOL_KEY, errors }, 502, cors);

  // --- reduce each aircraft to the fields the app uses (readsb names → short names) ---
  const num = v => (typeof v === 'number' && isFinite(v)) ? v : null;
  const aircraft = (data.ac || data.aircraft || [])
    .filter(a => num(a.lat) != null && num(a.lon) != null)
    .map(a => ({
      hex:  a.hex || '',
      flt:  (a.flight || '').replace(/@/g, '').trim(),
      reg:  a.r || '',
      type: a.t || '',
      la:   a.lat,
      lo:   a.lon,
      ab:   num(a.alt_baro),                          // "ground" isn't a number → null, and gnd below
      gnd:  a.alt_baro === 'ground' || undefined,
      ag:   num(a.alt_geom),
      gs:   num(a.gs),
      trk:  num(a.track) ?? num(a.true_heading),
      vs:   num(a.baro_rate) ?? num(a.geom_rate),
      cat:  a.category || '',
      seen: num(a.seen_pos) ?? num(a.seen) ?? 0,
    }));

  const body = {
    src: new URL(feedUrl).host, keyed: !!env.ADSBLOL_KEY, skipped: errors,
    t: new Date().toISOString(), nm, n: aircraft.length, ac: aircraft,
  };
  const response = json(body, 200, { ...cors, 'Cache-Control': 'public, max-age=3' });
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}


/* ===================================================================================================================
 * GET /tile/{src}/{z}/{y}/{x}           Esri satellite imagery for the app's Sat layer
 *
 *   src wi   World Imagery raster tiles (256 px, zoom 3-19)
 *   src st   static basemap tiles "arcgis/imagery/labels" (512 px, zoom 2-20)
 *
 * Guards, so the proxy can't be used to spend the Esri allowance elsewhere:
 *   - only for the app: the Origin (images loaded with crossorigin) or Referer must be in ALLOW_ORIGIN
 *   - only tiles touching Australia (lat -46..-8, lon 108..160)
 * Tiles are cached at Cloudflare's edge for 90 days (the key isn't part of the cache key) and sent with
 * Cache-Control so the app's service worker keeps them for offline use.
 * =================================================================================================================== */

const TILE_SOURCES = {
  wi: { minZoom: 3, maxZoom: 19,
        url: (z, y, x) => `https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}` },
  st: { minZoom: 2, maxZoom: 20,
        url: (z, y, x) => `https://static-map-tiles-api.arcgis.com/arcgis/rest/services/static-basemap-tiles-service/v1/arcgis/imagery/labels/static/tile/${z}/${y}/${x}` },
};
const AUSTRALIA = { latMin: -46, latMax: -8, lonMin: 108, lonMax: 160 };
const TILE_TIMEOUT_MS = 8000;

/** The lat/lon box of a web-mercator tile. (A 512-px static tile at zoom z covers the same box as a 256-px tile at z.) */
function tileBounds(z, y, x) {
  const n = 2 ** z;
  const lonAt = v => v / n * 360 - 180;
  const latAt = v => Math.atan(Math.sinh(Math.PI * (1 - 2 * v / n))) * 180 / Math.PI;
  return { latMin: latAt(y + 1), latMax: latAt(y), lonMin: lonAt(x), lonMax: lonAt(x + 1) };
}

async function tile(req, url, env, ctx, cors) {
  // --- parse /tile/{src}/{z}/{y}/{x} ---
  const m = /^\/tile\/(wi|st)\/(\d{1,2})\/(\d{1,7})\/(\d{1,7})$/.exec(url.pathname);
  if (!m) return json({ error: 'use /tile/{wi|st}/{z}/{y}/{x}' }, 400, cors);
  const src = TILE_SOURCES[m[1]], z = +m[2], y = +m[3], x = +m[4], n = 2 ** z;

  // --- only the app may use it ---
  const allowed = allowedOrigins(env);
  const origin = req.headers.get('Origin') || '', referer = req.headers.get('Referer') || '';
  const fromApp = allowed.includes(origin) || allowed.some(o => referer.startsWith(o + '/') || referer === o);
  if (allowed.length && !fromApp) return json({ error: 'not allowed' }, 403, cors);

  // --- only real tiles, only over Australia ---
  if (z < src.minZoom || z > src.maxZoom || y >= n || x >= n) return json({ error: 'zoom or tile out of range' }, 400, cors);
  const b = tileBounds(z, y, x);
  const outside = b.latMax < AUSTRALIA.latMin || b.latMin > AUSTRALIA.latMax || b.lonMax < AUSTRALIA.lonMin || b.lonMin > AUSTRALIA.lonMax;
  if (outside) return json({ error: 'outside Australia' }, 400, cors);
  if (!env.ESRI_KEY) return json({ error: 'proxy has no ESRI_KEY secret' }, 503, cors);

  // --- from the edge cache if we have it ---
  const cacheKey = new Request(`https://esri.cache/${m[1]}/${z}/${y}/${x}`);
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) return withHeaders(cached, cors, 'HIT');

  // --- otherwise from Esri, with the key ---
  let r;
  try {
    r = await fetchWithTimeout(src.url(z, y, x) + '?token=' + encodeURIComponent(env.ESRI_KEY),
                               { headers: { 'User-Agent': USER_AGENT } }, TILE_TIMEOUT_MS);
  } catch (e) {
    return json({ error: 'Esri ' + (e.name === 'AbortError' ? 'timeout' : e.message) }, 502, cors);
  }
  const contentType = r.headers.get('content-type') || '';
  if (!r.ok || !/^image\//.test(contentType)) {
    // Esri sometimes reports errors as JSON with status 200
    const detail = (await r.text()).slice(0, 160);
    return json({ error: `Esri ${r.status}`, detail }, r.ok ? 502 : r.status, cors);
  }

  const NINETY_DAYS = 7776000;   // seconds
  const response = new Response(r.body, { status: 200, headers: { 'Content-Type': contentType, 'Cache-Control': `public, max-age=${NINETY_DAYS}, immutable` } });
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return withHeaders(response, cors, 'MISS');
}


/* ===================================================================================================================
 * POST /naips  {u, p, areas:['9300', ...], met:true, validity:12}        (JSON; only from ALLOW_ORIGIN)
 *
 * The pilot's own NAIPS area briefing. The username and password come from the app (stored encrypted on the pilot's
 * device); nothing is stored or logged here. Steps, like a browser:
 *   1. open the NAIPS login page (session cookies, any hidden anti-forgery field)
 *   2. log in
 *   3. open the area briefing form (for its hidden fields)
 *   4. post it the way the app's "Brief in NAIPS" button does (BriefingArea1-5, Met, Notam, Validity)
 *   5. log off (after answering)
 * Answer: {text, t, areas} with the briefing as plain text.
 * On failure: {error, stage, detail} — detail has the page title and the form field NAMES found (never values), so a
 * change to the NAIPS site can be diagnosed. A wrong login answers 401 with NAIPS's own message.
 * Unofficial: NAIPS's machine access is Airservices' Dynamic Data service; the website can change, and its bot
 * protection may refuse requests from here.
 * =================================================================================================================== */

const NAIPS = 'https://www.airservicesaustralia.com/naips';
const NAIPS_ORIGIN = 'https://www.airservicesaustralia.com';
const NAIPS_UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
const NAIPS_TIMEOUT_MS = 15000;
const MAX_REDIRECTS = 6;

/** Turn HTML entities back into characters (&amp; last, so "&amp;lt;" stays "&lt;"). */
function decodeHtml(t) {
  return t.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
          .replace(/&#39;|&#x27;/g, "'").replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&');
}

/** The page's <title>. */
function pageTitle(html) {
  return decodeHtml(((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html) || [])[1] || '').trim());
}

/** The forms on a page: {id, action, inputs:[{tag, type, name, value}]}. */
function pageForms(html) {
  const attr = (attrs, name) => ((new RegExp('\\b' + name + '\\s*=\\s*["\']([^"\']*)["\']', 'i')).exec(attrs) || [])[1];
  const forms = [];
  for (const m of html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)) {
    const formAttrs = m[1], body = m[2];
    const inputs = [...body.matchAll(/<(input|select|textarea)\b([^>]*)>/gi)]
      .map(x => ({ tag: x[1].toLowerCase(), type: (attr(x[2], 'type') || '').toLowerCase(), name: attr(x[2], 'name') || '', value: decodeHtml(attr(x[2], 'value') || '') }))
      .filter(i => i.name);
    forms.push({ id: attr(formAttrs, 'id') || '', action: decodeHtml(attr(formAttrs, 'action') || ''), inputs });
  }
  return forms;
}

/** A one-line summary of a page's forms for error reports: "frmLogon→/naips/Account/LogOn: UserName:text, Password:password". No values. */
function formShape(html) {
  return pageForms(html)
    .map(f => `${f.id || 'form'}→${f.action}: ${f.inputs.map(i => i.name + (i.type ? ':' + i.type : '')).join(', ')}`)
    .join(' | ').slice(0, 600);
}

/** The briefing text: the biggest <pre> on the page, else the page text with its line breaks kept. */
function briefText(html) {
  const pres = [...html.matchAll(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi)].map(m => m[1]).sort((a, b) => b.length - a.length);
  let raw;
  if (pres.length) {
    raw = pres[0];
  } else {
    raw = (/<body\b[^>]*>([\s\S]*)<\/body>/i.exec(html) || [, html])[1]
      .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|tr|li|h\d)>/gi, '\n');
  }
  return decodeHtml(raw.replace(/<[^>]+>/g, ''))
    .replace(/\r/g, '')
    .replace(/[ \t]+$/gm, '')       // trailing spaces
    .replace(/\n{3,}/g, '\n\n')     // at most one blank line
    .trim();
}

/** Signs of the site's bot protection page instead of NAIPS. */
const isBlocked = html => /Request Rejected|support ID is|TSPD|bobcmn|window\["bobcmn"\]/i.test(html);

async function naips(req, env, ctx, cors) {
  // --- only the app, only POST ---
  const allowed = allowedOrigins(env), origin = req.headers.get('Origin') || '';
  if (req.method !== 'POST') return json({ error: 'POST {u, p, areas}' }, 405, cors);
  if (allowed.length && !allowed.includes(origin)) return json({ error: 'not allowed' }, 403, cors);   // this isn't a public NAIPS relay

  // --- read and check the request ---
  let b;
  try { b = await req.json(); } catch (e) { return json({ error: 'bad JSON' }, 400, cors); }
  const user = String(b.u || ''), pass = String(b.p || '');
  const areas = (Array.isArray(b.areas) ? b.areas : []).map(String).filter(a => /^\d{3,4}$/.test(a)).slice(0, 5);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.\-]{0,19}$/.test(user) || pass.length < 4 || pass.length > 64)
    return json({ error: 'NAIPS username or password missing or not valid' }, 400, cors);
  if (!areas.length) return json({ error: 'give 1-5 NAIPS area numbers, e.g. 9300' }, 400, cors);

  // --- a tiny browser: a cookie jar and a fetch that follows redirects itself (so cookies from each hop are kept) ---
  const jar = new Map();
  const cookieHeader = () => [...jar].map(([k, v]) => k + '=' + v).join('; ');
  const keepCookies = r => {
    const setCookies = r.headers.getSetCookie ? r.headers.getSetCookie()
                                              : (r.headers.get('set-cookie') || '').split(/,(?=\s*[A-Za-z0-9_.-]+=)/);
    for (const c of setCookies) {
      const m = /^\s*([^=;\s]+)=([^;]*)/.exec(c || '');
      if (m) jar.set(m[1], m[2]);
    }
  };
  const browse = async (url, options = {}, hops = 0) => {
    const headers = {
      'User-Agent': NAIPS_UA, 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'en-AU,en;q=0.9',
      ...(jar.size ? { Cookie: cookieHeader() } : {}),
      ...(options.headers || {}),
    };
    const r = await fetchWithTimeout(url, { ...options, redirect: 'manual', headers }, NAIPS_TIMEOUT_MS);
    keepCookies(r);
    const location = r.headers.get('location');
    if (r.status >= 300 && r.status < 400 && location && hops < MAX_REDIRECTS)
      return browse(new URL(location, url).toString(), { headers: { Referer: url } }, hops + 1);
    return { status: r.status, url, html: await r.text() };
  };
  // POST a form as application/x-www-form-urlencoded, from the NAIPS site
  const postForm = (url, referer, params) => browse(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: NAIPS_ORIGIN, Referer: referer },
    body: params.toString(),
  });
  // the form's hidden fields plus our own
  const formParams = (form, fields) => {
    const q = new URLSearchParams();
    for (const i of form ? form.inputs : []) if (i.type === 'hidden') q.append(i.name, i.value);
    for (const [k, v] of fields) q.append(k, v);
    return q;
  };
  const fail = (stage, page, message) => json({
    error: message || `NAIPS ${stage} didn't work`, stage,
    detail: page ? { status: page.status, title: pageTitle(page.html), forms: formShape(page.html) } : null,
  }, 502, cors);

  try {
    // 1. login page
    const loginPage = await browse(NAIPS + '/Account/LogOn');
    if (isBlocked(loginPage.html)) return fail('login page', loginPage, "NAIPS's bot protection refused the request from the Worker");
    const loginForm = pageForms(loginPage.html).find(f => /LogOn/i.test(f.action) || f.id === 'frmLogon');
    if (!loginForm) return fail('login page', loginPage, 'NAIPS login form not found');

    // 2. log in
    const loginUrl = new URL(loginForm.action || '/naips/Account/LogOn', NAIPS + '/').toString();
    const afterLogin = await postForm(loginUrl, NAIPS + '/Account/LogOn', formParams(loginForm, [['UserName', user], ['Password', pass]]));
    if (isBlocked(afterLogin.html)) return fail('login', afterLogin, "NAIPS's bot protection refused the login from the Worker");
    if (/id=["']frmLogon["']/i.test(afterLogin.html)) {
      // still on the login form: show NAIPS's own message (only from the error box: the page footer has list items too)
      const box = /validation-summary-errors[^>]*>([\s\S]*?)<\/(?:div|ul)>/i.exec(afterLogin.html);
      const m = (box && /<li>([\s\S]*?)<\/li>/i.exec(box[1])) || /field-validation-error[^>]*>([^<]+)</i.exec(afterLogin.html);
      const why = m ? ': ' + decodeHtml(m[1].replace(/<[^>]+>/g, '')).trim() : ' (check the username and password)';
      return json({ error: 'NAIPS login failed' + why, stage: 'login' }, 401, cors);
    }

    // 3. the area briefing form (for any hidden fields)
    const areaPage = await browse(NAIPS + '/Briefing/Area');
    const areaForm = pageForms(areaPage.html).find(f => /Briefing\/Area/i.test(f.action) || f.inputs.some(i => /^BriefingArea1$/i.test(i.name)));

    // 4. ask for the briefing, as the app's "Brief in NAIPS" button does.
    //    Checkboxes post "true" then a hidden "false" (ASP.NET style), so a ticked box sends both.
    const met = b.met !== false;
    const validity = [6, 12, 18, 24].includes(+b.validity) ? String(+b.validity) : '12';
    const fields = [];
    for (let k = 1; k <= 5; k++) fields.push(['BriefingArea' + k, areas[k - 1] || '']);
    fields.push(['Met', met ? 'true' : 'false']);
    if (met) fields.push(['Met', 'false']);
    fields.push(['Notam', 'true'], ['Notam', 'false'], ['HeadOfficeNotam', 'false'], ['Charts', 'false'], ['MidSigwxGpwt', 'false'],
                ['GPWTRegionalCharts', 'false'], ['ChartVariant', 'HI'], ['GPWTNationalCharts', 'false'], ['Validity', validity]);
    const briefUrl = new URL((areaForm && areaForm.action) || '/naips/Briefing/Area', NAIPS + '/').toString();
    const briefing = await postForm(briefUrl, NAIPS + '/Briefing/Area', formParams(areaForm, fields));

    // 5. log off, best effort, after we've answered
    ctx.waitUntil(browse(NAIPS + '/Account/LogOff').catch(() => {}));

    if (isBlocked(briefing.html)) return fail('briefing', briefing, "NAIPS's bot protection refused the briefing request");
    const text = briefText(briefing.html);
    if (!/\d{4} UTC \d{2}\/\d{2}\/\d{2}/.test(text)) return fail('briefing', briefing, "NAIPS didn't return a briefing (the page may have changed)");
    return json({ text, t: new Date().toISOString(), areas }, 200, { ...cors, 'Cache-Control': 'no-store' });
  } catch (e) {
    return json({ error: 'NAIPS ' + (e.name === 'AbortError' ? 'timed out' : 'unreachable: ' + e.message) }, 502, cors);
  }
}


/* ===================================================================================================================
 * Google sign-in for Drive (the app saves flight logs to the pilot's Drive, scope drive.file: only files it made)
 *
 *   GET  /gauth                    → {client_id}                                   the OAuth client ID (not a secret)
 *   POST /gauth {code}             → {access_token, expires_in, refresh_token}     after the app's sign-in pop-up
 *   POST /gauth {refresh_token}    → {access_token, expires_in}                    a fresh 1-hour token, no pop-up
 *   POST /gauth {revoke}           → {ok}                                          withdraw access (Disconnect in the app)
 *
 * Swapping a code or refresh token needs the client secret, so it happens here. The refresh token is kept encrypted
 * on the pilot's device and only sent to be swapped. Nothing is stored or logged here.
 * A refresh token Google no longer accepts answers 400 with reauth: true (the app then asks to connect again).
 *
 * The Origin check only keeps browsers on other sites out; it isn't a security barrier (any script can send any
 * Origin). What protects this: a code or refresh token from this app's own Google client is needed to get anything.
 * =================================================================================================================== */

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const FORM = { 'Content-Type': 'application/x-www-form-urlencoded' };

async function gauth(req, env, cors) {
  const allowed = allowedOrigins(env), origin = req.headers.get('Origin') || '';
  if (allowed.length && !allowed.includes(origin)) return json({ error: 'not allowed' }, 403, cors);
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET)
    return json({ error: "Google Drive isn't set up on the proxy (secrets GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)" }, 501, cors);

  if (req.method === 'GET') return json({ client_id: env.GOOGLE_CLIENT_ID }, 200, cors);
  if (req.method !== 'POST') return json({ error: 'GET, or POST {code} / {refresh_token}' }, 405, cors);

  let b;
  try { b = await req.json(); } catch (e) { return json({ error: 'bad JSON' }, 400, cors); }

  // withdraw the app's access
  if (b.revoke) {
    try {
      const r = await fetch(GOOGLE_REVOKE_URL, { method: 'POST', headers: FORM, body: new URLSearchParams({ token: String(b.revoke) }) });
      return json({ ok: r.ok }, 200, cors);
    } catch (e) {
      return json({ error: 'Google revoke: ' + e.message }, 502, cors);
    }
  }

  // swap a sign-in code (redirect_uri "postmessage" = the pop-up flow) or a refresh token for an access token
  const client = { client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET };
  let grant = null;
  if (b.code)               grant = { ...client, code: String(b.code), redirect_uri: 'postmessage', grant_type: 'authorization_code' };
  else if (b.refresh_token) grant = { ...client, refresh_token: String(b.refresh_token), grant_type: 'refresh_token' };
  if (!grant) return json({ error: 'give code or refresh_token' }, 400, cors);

  let r, j;
  try {
    r = await fetch(GOOGLE_TOKEN_URL, { method: 'POST', headers: FORM, body: new URLSearchParams(grant) });
    j = await r.json();
  } catch (e) {
    return json({ error: 'Google token service: ' + e.message }, 502, cors);
  }
  if (!r.ok || !j.access_token) {
    const status = (r.status >= 400 && r.status < 500) ? 400 : 502;
    return json({ error: j.error_description || j.error || ('Google token service ' + r.status), reauth: j.error === 'invalid_grant' }, status, cors);
  }

  const answer = { access_token: j.access_token, expires_in: j.expires_in || 3600 };
  if (j.refresh_token) answer.refresh_token = j.refresh_token;   // only on the first sign-in
  return json(answer, 200, { ...cors, 'Cache-Control': 'no-store' });
}
