# Traffic proxy (Cloudflare Worker)

Radio Calls AU is a static page, and the free ADS-B feeds send no CORS headers, so the app can't read them directly.
This Worker sits in between: it asks the feed for aircraft around you and returns a small JSON list the app can read.
(It also proxied FAA NOTAMs until 29 Oct 2026; NOTAMs now come only from a NAIPS briefing loaded into the app. The
folder keeps its old name.)

## Set up (once)
1. **Cloudflare account** (the free plan is enough: 100,000 requests a day): https://dash.cloudflare.com/sign-up
2. **Deploy**, either:
   - from this folder (needs Node.js): `npx wrangler login`, then `npx wrangler deploy`; or
   - in the dashboard: Workers & Pages → Create → Worker, paste `worker.js` into the editor, Deploy, then under
     Settings → Variables add `ALLOW_ORIGIN` = `https://meee1.github.io`.
   The address looks like `https://radio-au-notam.<your-subdomain>.workers.dev`.
3. **In the app:** the default is `https://test.mission.workers.dev`; to use another, put its address in
   **NOTAMs (NAIPS) and traffic → Traffic proxy** at the bottom of the page, then turn on **Traffic** above the map.
4. **Check:** open `https://<your worker>/traffic?lat=-38.04&lon=144.47&nm=25` in a browser: it should list aircraft.

## What it does
- `GET /traffic?lat=&lon=&nm=` (nm max 40): aircraft from **adsb.lol** (free, ODbL, no key), falling back to
  **adsb.fi** if adsb.lol fails, cached 3 s per ~0.6 NM position. The app asks every 5 s while the map's **Traffic**
  button is on and there's signal. (airplanes.live was the first choice but its API now answers 403 "please contact
  us" until they approve a project.) If both fail the answer is 502 with `errors` naming each feed's status, which the
  app shows under the map and in Settings.
- Returns `{src, t, n, ac:[{hex, flt, reg, type, la, lo, ab, gnd, ag, gs, trk, vs, cat, seen}]}`: `ab` pressure
  altitude, `ag` GNSS altitude (WGS84 ellipsoid; the app converts it to MSL with the geoid), `seen` position age in s.
- Another readsb-style feed: set `ADSB_URL` (wrangler.toml or the dashboard's Variables), e.g.
  `https://api.airplanes.live/v2/point/{lat}/{lon}/{nm}` once they've approved you, and `npx wrangler secret put ADSB_KEY` if it
  needs a key (sent as the `api-auth` header).
- It's internet ADS-B: only aircraft transmitting ADS-B that a ground receiver hears, 5–10 s late, patchy at low
  level. Not TCAS.

## Test locally (no network)
- `node test.mjs`: the Worker against fake feeds (parsing, adsb.lol → adsb.fi fallback, errors, cache, CORS).
- `node mockserver.mjs`: the Worker on http://localhost:8812 with four fake aircraft around the first position asked
  for (one converging, one proximate, one far, and VH-EAN itself); set the app's Traffic proxy to
  `http://localhost:8812` (app served on :8811).
