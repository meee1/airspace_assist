"""Download the overhead power lines (66 kV and up) from Geoscience Australia and write them compactly for the app.

    python powerlines.py [OUT ...]        (default: powerlines.json here and ../app/powerlines.json if that folder exists)

Source: Geoscience Australia, Electricity Infrastructure, layer 2 "Power Lines" (ArcGIS REST), CC BY 4.0
(https://services.ga.gov.au/gis/rest/services/Electricity_Infrastructure/MapServer/2). It's the transmission network
only: local distribution lines (11/22 kV poles along roads and farms) are not in it.
Kept: overhead and overhead/underground lines that aren't non-operational. Simplified to about 30 m.
Output {src, got, l:[[kV, 0 overhead | 1 overhead/underground, 1 under construction, [x0, y0, dx, dy, ...]]]}
with coordinates in 1e-5 degrees (lon, lat), each point a difference from the one before.
Needs only the Python standard library; run it where you have internet (the app's builds don't fetch it).
"""
import json, os, sys, time, urllib.parse, urllib.request

URL = 'https://services.ga.gov.au/gis/rest/services/Electricity_Infrastructure/MapServer/2/query'
WHERE = "FEATURE_SUBTYPE<>'Underground' AND STATUS<>'Non-Operational'"


def page(offset):
    q = urllib.parse.urlencode({
        'where': WHERE, 'outFields': 'OBJECTID,CAPACITY_KV,FEATURE_SUBTYPE,STATUS', 'returnGeometry': 'true',
        'outSR': 4326, 'maxAllowableOffset': 0.0003, 'geometryPrecision': 5, 'resultOffset': offset,
        'resultRecordCount': 1000, 'orderByFields': 'OBJECTID', 'f': 'json'})
    req = urllib.request.Request(URL + '?' + q, headers={'User-Agent': 'radio-calls-au powerlines.py'})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                j = json.load(r)
            if 'error' in j:
                raise RuntimeError(j['error'])
            return j
        except Exception as e:
            if attempt == 3:
                raise
            print('retrying after', e)
            time.sleep(3 * (attempt + 1))


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    outs = sys.argv[1:] or [os.path.join(here, 'powerlines.json')] + (
        [os.path.join(here, '..', 'app', 'powerlines.json')] if os.path.isdir(os.path.join(here, '..', 'app')) else [])
    feats, off = [], 0
    while True:
        j = page(off)
        f = j.get('features', [])
        feats += f
        print(f'{len(feats)} lines…')
        if len(f) < 1000:
            break
        off += 1000
    lines = []
    for f in feats:
        a = {k.lower(): v for k, v in f['attributes'].items()}   # the service answers in lower case
        for p in (f.get('geometry') or {}).get('paths', []):
            if len(p) < 2:
                continue
            d, px, py = [], 0, 0
            for x, y in p:
                X, Y = round(x * 1e5), round(y * 1e5)
                d += [X - px, Y - py]
                px, py = X, Y
            lines.append([a.get('capacity_kv') or 0, 0 if a.get('feature_subtype') == 'Overhead' else 1,
                          1 if a.get('status') == 'Under Construction' else 0, d])
    if len(lines) < 1000:
        sys.exit(f'only {len(lines)} lines: the service may have changed; nothing written')
    data = json.dumps({'src': 'Geoscience Australia, Electricity Infrastructure: Power Lines (CC BY 4.0)',
                       'got': time.strftime('%Y-%m-%d'), 'l': lines}, separators=(',', ':'))
    for o in outs:
        with open(o, 'w') as fh:
            fh.write(data)
        print('wrote', o, len(data), 'bytes,', len(lines), 'lines')


if __name__ == '__main__':
    main()
