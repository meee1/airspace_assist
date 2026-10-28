# NOTAM and traffic proxy (Cloudflare Worker)

Radio Calls AU is a static page, so it can't hold credentials or call a NOTAM service directly (they need a key and
send no CORS headers). This Worker sits in between: it keeps the FAA NOTAM Management Service (NMS) credentials,
fetches the NOTAMs the app asks for, and returns a small JSON list the app can read. The app stores the last answer,
so NOTAMs stay available offline in flight.

The FAA's NMS API carries international NOTAMs (classification INTERNATIONAL, from the FAA's international NOTAM
exchange), which is where Australian (Y***) NOTAMs come from. It is free for registered users.
**Check the coverage once your credentials work** (see step 5): if Australian NOTAMs are missing or late, the Worker
can be pointed at another provider without changing the app (only `nms()` and `norm()` need to change).

## Set up (once)
1. **FAA NMS credentials:** email NOTAMS@faa.gov asking for NMS API access (client ID and secret) for a personal VFR
   flight-information app. Say you need international NOTAMs for Australia.
2. **Cloudflare account** (the free plan is enough: 100,000 requests a day): https://dash.cloudflare.com/sign-up
3. **Deploy**, from this folder (needs Node.js):
   ```
   npx wrangler login
   npx wrangler secret put NMS_CLIENT_ID
   npx wrangler secret put NMS_CLIENT_SECRET
   npx wrangler deploy
   ```
   Wrangler prints the address, e.g. `https://radio-au-notam.<your-subdomain>.workers.dev`.
4. **In the app:** open **NOTAMs** at the bottom of the page, paste that address into **NOTAM server**, and tap
   **Fetch now**. The summary line shows how many active NOTAMs came back.
5. **Check coverage:** open `https://radio-au-notam.<you>.workers.dev/notams?loc=YMML,YMMB&lat=-37.8&lon=144.9&nm=60`
   in a browser and compare it with a NAIPS location briefing for the same places.

## What it does
- `GET /notams?lat=&lon=&nm=&loc=` : NOTAMs within `nm` (max 100) of the point, plus those for up to 25 locations.
  The app asks for 60 NM around you and the aerodromes on your flight plan and Go to, about every 15 minutes while
  there's signal, or sooner after moving 25 NM or adding an aerodrome.
- Normalises each NOTAM to `{id, loc, fir, q, lo, hi, la, lon, r, from, to, est, sch, text, icao}` (limits in ft,
  Q-line circle in NM), filling gaps from the ICAO text (Q, A–E fields) when the structured fields are empty.
- Caches each answer for 10 minutes at the edge (position rounded to 0.1°).
- Only answers CORS for the origins in `ALLOW_ORIGIN` (wrangler.toml).

## Traffic (ADS-B)
- `GET /traffic?lat=&lon=&nm=` (nm max 40): aircraft from **airplanes.live** (free, non-commercial use, 1 request a
  second, no key; please consider feeding them), cached 3 s per ~0.6 NM position. The app asks every 5 s while the
  map's **Traffic** button is on and there's signal.
- Returns `{src, t, n, ac:[{hex, flt, reg, type, la, lo, ab, gnd, ag, gs, trk, vs, cat, seen}]}`: `ab` pressure
  altitude, `ag` GNSS altitude (WGS84 ellipsoid; the app converts it to MSL with the geoid), `seen` position age in s.
- Another readsb-style feed: set `ADSB_URL` in wrangler.toml, e.g. `https://api.adsb.lol/v2/point/{lat}/{lon}/{nm}`
  or `https://opendata.adsb.fi/api/v2/lat/{lat}/lon/{lon}/dist/{nm}`, and `npx wrangler secret put ADSB_KEY` if it
  needs a key (sent as the `api-auth` header).
- It's internet ADS-B: only aircraft transmitting ADS-B that a ground receiver hears, 5–10 s late, patchy at low
  level. Not TCAS.

## Test locally (no credentials, no network)
- `node test.mjs`: the Worker against a fake NMS (parsing, merging, errors, CORS, token reuse).
- `node mockserver.mjs`: the Worker on http://localhost:8812 with fake NOTAMs around Barwon Heads and Moorabbin and
  four fake aircraft around the first position asked for (one converging, one proximate, one far, and VH-EAN itself);
  set the app's NOTAM server to `http://localhost:8812` (app served on :8811).

NOTAMs from this proxy are for awareness. They may be incomplete or late: always get a NAIPS briefing before flight.
