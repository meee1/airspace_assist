#!/usr/bin/env python3
"""Build compact JSON for the Radio Calls AU phone app.

Source precedence (first wins, every value carries its source):
  1. Airservices AIP: ERSA (--ersa, PDF or `pdftotext -layout` text) and DAH (--dah, PDF)
  2. XC Australia OpenAir file (--xc), unofficial, built from DAH/ERSA
  3. VATPAC vatSys australia-dataset (flight-sim, AIRAC-aligned)
  4. OurAirports (community)
Usage: build_data.py DATA_DIR OUT.json [--ersa ERSA.pdf] [--dah DAH.pdf] [--xc openair.txt]
"""
import csv, json, re, sys, os, subprocess, collections, argparse
import xml.etree.ElementTree as ET
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

ap_ = argparse.ArgumentParser()
ap_.add_argument('data'); ap_.add_argument('out')
ap_.add_argument('--ersa'); ap_.add_argument('--dah'); ap_.add_argument('--xc')
ARGS = ap_.parse_args()
D = ARGS.data
OUT = ARGS.out

def dms(s):
    # -380222.000+1442810.000  -> lat, lon
    m = re.fullmatch(r'([-+])(\d+(?:\.\d+)?)([-+])(\d+(?:\.\d+)?)', s.strip())
    def conv(sign, v, degw):
        whole, _, frac = v.partition('.')
        whole = whole.zfill(degw + 4)
        d = int(whole[:-4]); mi = int(whole[-4:-2]); se = float(whole[-2:] + '.' + (frac or '0'))
        x = d + mi / 60 + se / 3600
        return -x if sign == '-' else x
    return round(conv(m.group(1), m.group(2), 2), 5), round(conv(m.group(3), m.group(4), 3), 5)

def f3(x):
    try:
        return f"{float(x):.3f}".rstrip('0').rstrip('.') if '.' in f"{float(x):.3f}" else str(x)
    except Exception:
        return None

def fq(x):
    v = float(x)
    s = f"{v:.3f}"
    # trim to 1-3 decimals, keep at least 1
    s = s.rstrip('0')
    if s.endswith('.'): s += '0'
    return s

# ---------- aerodromes ----------
airports = {}
root = ET.parse(f'{D}/vs_Airspace.xml').getroot()
for a in root.find('Airports'):
    icao = a.get('ICAO');
    if not icao or not icao.startswith('Y'): continue
    lat, lon = dms(a.get('Position'))
    airports[icao] = dict(i=icao, n=a.get('FullName'), la=lat, lo=lon,
                          e=int(a.get('Elevation')) if a.get('Elevation') else None, s='v')

oa = {}
for r in csv.DictReader(open(f'{D}/airports.csv', encoding='utf-8')):
    if r['iso_country'] != 'AU' or r['type'] == 'closed': continue
    oa[r['ident']] = r
for ident, r in oa.items():
    t = {'heliport': 'H', 'seaplane_base': 'W'}.get(r['type'], '')
    if ident in airports:
        if t: airports[ident]['t'] = t
        continue
    if not re.fullmatch(r'Y[A-Z0-9]{3}', ident) and r['type'] != 'heliport':
        continue  # skip AU-xxxx private strips without ICAO unless heliport
    try:
        lat = round(float(r['latitude_deg']), 5); lon = round(float(r['longitude_deg']), 5)
    except ValueError:
        continue
    e = r['elevation_ft']
    airports[ident] = dict(i=ident, n=r['name'], la=lat, lo=lon,
                           e=int(float(e)) if e else None, s='o')
    if t: airports[ident]['t'] = t

# ---------- frequencies ----------
freqs = collections.defaultdict(list)
for r in csv.DictReader(open(f'{D}/airport-frequencies.csv', encoding='utf-8')):
    if r['airport_ident'] in airports:
        try: fq(r['frequency_mhz'])
        except ValueError: continue
        freqs[r['airport_ident']].append(r)

vs_atis = {}
for f in ET.parse(f'{D}/vs_ATIS.xml').getroot().iter('Frequency'):
    vs_atis[f.get('Airport')] = fq(f.get('Frequency'))

AREA_WORDS = re.compile(r'CNTR|CENTRE|CENTER|CEN\b|RADAR|FLIGHTWATCH', re.I)
for icao, ap in airports.items():
    fl = freqs.get(icao, [])
    ctaf = [fq(f['frequency_mhz']) for f in fl if f['type'].upper() == 'CTAF']
    if ctaf: ap['c'] = ctaf[0]
    if icao in vs_atis:
        ap['a'] = vs_atis[icao]
    else:
        at = [fq(f['frequency_mhz']) for f in fl if f['type'].upper() in ('ATIS',)]
        if at: ap['a'] = at[0]
    aw = [fq(f['frequency_mhz']) for f in fl if f['type'].upper() in ('AWIS', 'AWS', 'AWIB')]
    if aw: ap['w'] = aw[0]
    area = []
    for f in fl:
        T = f['type'].upper(); desc = f['description'] or ''
        if T in ('FSS', 'FIA', 'CTR', 'CNTR') or AREA_WORDS.search(T) or (T == 'MISC' and AREA_WORDS.search(desc)):
            area.append([desc.strip() or T, fq(f['frequency_mhz'])])
    if area: ap['ar'] = area[:3]
    other = []
    for f in fl:
        T = f['type'].upper()
        if T in ('TWR', 'GND', 'SMC', 'APP', 'DEP', 'CLD', 'ACD', 'UNIC', 'APP/DEP'):
            other.append([T, (f['description'] or '').strip(), fq(f['frequency_mhz'])])
    if other: ap['x'] = other[:8]

# ---------- ATC sectors / volumes ----------
vt = open(f'{D}/vs_Volumes.xml', encoding='utf-8').read()
bounds = {}
for name, body in re.findall(r'<Boundary Name="([^"]+)"[^>]*>(.*?)</Boundary>', vt, re.S):
    pts = [dms(p) for p in body.split('/') if p.strip()]
    # simplify: drop points closer than ~0.3 NM to previous kept
    simp = []
    for p in pts:
        if not simp or abs(p[0] - simp[-1][0]) + abs(p[1] - simp[-1][1]) > 0.004:
            simp.append(p)
    bounds[name] = [[round(a, 4), round(b, 4)] for a, b in simp]
vols = {}
for attrs, b in re.findall(r'<Volume ([^>]*)>\s*<Boundaries>([^<]*)</Boundaries>', vt):
    a = dict(re.findall(r'(\w+)="([^"]*)"', attrs))
    vols[a['Name']] = dict(lo=int(a['LowerLimit']), hi=int(a['UpperLimit']),
                           b=[x.strip() for x in b.split(',') if x.strip()])

sectors = []
used_b = set()
for s in ET.parse(f'{D}/vs_Sectors.xml').getroot().iter('Sector'):
    cs = s.get('Callsign') or ''
    kind = cs.rsplit('_', 1)[-1]
    if kind not in ('CTR', 'APP', 'DEP', 'TWR', 'FSS'): continue
    if not (cs.startswith(('ML', 'BN')) or kind in ('APP', 'DEP', 'TWR')): continue
    if s.get('DisplayInSectorsWindow') == 'False' and kind in ('CTR', 'FSS'): continue
    vnames = [v.strip() for v in (s.findtext('Volumes') or '').split(',') if v.strip()]
    vv = []
    for vn in vnames:
        v = vols.get(vn)
        if not v: continue
        bl = [bn for bn in v['b'] if bn in bounds]
        if not bl: continue
        used_b.update(bl)
        vv.append([v['lo'], v['hi'], bl])
    if not vv: continue
    fn = s.get('FullName')
    if kind == 'CTR':
        call = ('Melbourne' if cs.startswith('ML') else 'Brisbane') + ' Centre'
    elif kind == 'FSS':
        call = fn
    else:
        call = fn
    sectors.append(dict(k=kind, n=fn, cs=call, f=fq(s.get('Frequency')), v=vv))

# ---------- source-tagged aerodrome fields ----------
SRC_NAMES = {'E': 'ERSA', 'X': 'XC Australia', 'V': 'VATPAC', 'O': 'OurAirports'}
for ap in airports.values():
    if 'c' in ap: ap['cS'] = 'O'
    if 'a' in ap: ap['a'] = [ap['a']]; ap['aS'] = 'V' if ap['i'] in vs_atis else 'O'
    if 'w' in ap: ap['wS'] = 'O'
    if 'x' in ap: ap['x'] = [[t, n, f, ''] for t, n, f in ap['x']]; ap['xS'] = 'O'
    ap.pop('ar', None)   # superseded by ERSA FIA and DAH FIA boundaries

def conflict(ap, field, new, old, oldsrc):
    if old is not None and old != new:
        ap.setdefault('cf', []).append([field, old, oldsrc])

meta = dict(built=__import__('datetime').date.today().isoformat())

# ---------- XC Australia OpenAir (unofficial, DAH/ERSA-derived) ----------
xc_air = []
if ARGS.xc:
    import openair
    _txt = open(ARGS.xc, encoding='latin-1').read()
    _m = re.search(r'valid\s+(\d{1,2})-(\w+)-(\d{4})', _txt)
    meta['xc'] = f"{_m.group(1)} {_m.group(2)[:3].upper()} {_m.group(3)}" if _m else ''
    SEC = {'A': 'A', 'C': 'C', 'D': 'D', 'E': 'E', 'CTR': 'CTR', 'R': 'R', 'Q': 'Q',
           'FIA': 'FIA', 'E FREQUENCY BOUNDARIES': 'EF'}
    for r in openair.parse(_txt):
        if r['section'] == 'CTAF':
            m = re.search(r'\s(1\d\d\.\d+)\s.*\((Y\w{3})\)', r['name'])
            if m and m.group(2) in airports:
                ap = airports[m.group(2)]; f = fq(m.group(1))
                conflict(ap, 'c', f, ap.get('c'), ap.get('cS'))
                ap['c'] = f; ap['cS'] = 'X'
                if '*TWR' in r['name'].upper(): ap['ct'] = 1
            continue
        k = SEC.get(r['section'])
        if not k: continue
        lo, lok = openair.parse_limit(r['al']); hi, hik = openair.parse_limit(r['ah'])
        name = re.sub(r'\s*\[[^\]]*\]\s*$', '', r['name']).strip()
        freq = None
        if k in ('FIA', 'EF'):
            m = re.search(r'(1\d\d\.\d+)', name)
            if m: freq = fq(m.group(1))
            name = re.sub(r'\s*(EFREQUENCY\s*)?1\d\d\.\d+\w*$', '', name).strip()
        xc_air.append(dict(cls=k, name=name, lo=lo, lok=lok, hi=hi, hik=hik, freq=freq, poly=r['poly'], x={}))

# ---------- ERSA (AIP) — first source for aerodromes and frequencies ----------
ersa_idx = {}
if ARGS.ersa:
    import ersa
    if ARGS.ersa.lower().endswith('.pdf'):
        txt = subprocess.run(['pdftotext', '-layout', ARGS.ersa, '-'], capture_output=True, text=True, errors='replace').stdout
    else:
        txt = open(ARGS.ersa, encoding='utf-8', errors='replace').read()
    m = re.search(r'AIP Australia\s+(\d{1,2} [A-Z]{3} \d{4})\s+FAC', txt)
    meta['ersa'] = m.group(1) if m else ''
    E = ersa.parse(txt)
    for icao, r in E.items():
        ap = airports.get(icao)
        if not ap:
            ap = airports[icao] = dict(i=icao)
        ap.update(n=r['n'], la=r['la'], lo=r['lo'], e=r['e'], s='E')
        if r.get('cat'): ap['cat'] = r['cat']
        if r.get('ctaf'):
            conflict(ap, 'c', r['ctaf'], ap.get('c'), ap.get('cS'))
            ap['c'] = r['ctaf']; ap['cS'] = 'E'; ap['afru'] = r.get('afru', 0)
            if r.get('twr'): ap['ct'] = 1
        elif r.get('twr'):
            ap.pop('c', None); ap.pop('cS', None)   # H24 tower or CTAF not published
        if r.get('atis'):
            if ap.get('a') and ap['a'][0] not in r['atis']: conflict(ap, 'a', r['atis'][0], ap['a'][0], ap.get('aS'))
            ap['a'] = r['atis']; ap['aS'] = 'E'
            if r.get('atisnav'): ap['an'] = r['atisnav']
        if r.get('awis'):
            conflict(ap, 'w', r['awis'], ap.get('w'), ap.get('wS'))
            ap['w'] = r['awis']; ap['wS'] = 'E'
        x = []
        for key, T in (('twr', 'TWR'), ('smc', 'GND'), ('acd', 'DEL'), ('app', 'APP'), ('dep', 'DEP'), ('unicom', 'UNICOM')):
            for svc, f, note in r.get(key, []):
                x.append([T, svc, f, note])
        if x: ap['x'] = x; ap['xS'] = 'E'
        elif ap.get('xS') == 'O': ap.pop('x'); ap.pop('xS')
        if r.get('fia'): ap['fia'] = r['fia']
        for k3 in ('st', 'utc', 'cnotes', 'proc', 'keys'):
            if r.get(k3) is not None: ap[k3] = r[k3]
        ersa_idx[icao] = r

# controlling unit for a DAH/XC airspace name, looked up in ERSA
def ersa_unit(name, cls, lo=None):
    """All ERSA units that may control this airspace: [[service, freq], ...], best first."""
    base = re.split(r'\s+(?:FIR\s+)?(?:CTA|CONTROL ZONE|CTR|TMA)\b', name)[0].strip()
    want = 'twr' if cls in ('CTR', 'D') else 'app'
    best = None
    for icao, r in ersa_idx.items():
        segs = [x.strip() for x in r['n'].split('/')]
        if r['n'] == base: score = 0
        elif base in segs: score = 1 + segs.index(base)
        else: continue
        lst = r.get(want) or (r.get('app') if want == 'twr' else None)
        if not lst: continue
        if want == 'twr' and not r.get('twr'): score += 5
        if not any(e[0].upper().startswith(base.split()[0]) for e in lst): score += 3
        if best is None or score < best[0]: best = (score, lst)
    if not best: return None
    lst = best[1]
    own = [e for e in lst if e[0].upper().startswith(base.split()[0])] or lst
    if lo is not None:
        lvl = [e for e in own if ('LOW' in e[0].upper()) == (lo < 12500)]
        if lvl and any(('LOW' in e[0].upper() or 'HIGH' in e[0].upper()) for e in own): own = lvl
    seen, out = set(), []
    for svc, f, _ in own:
        if f in seen: continue
        seen.add(f); out.append([titlecase(svc), f])
    return out

def titlecase(s):
    return re.sub(r'\b([a-z])', lambda m: m.group(1).upper(), s.lower())

# ---------- DAH (AIP) — first source for airspace ----------
dah_air = []
if ARGS.dah:
    import dah, dah_text
    lines = dah_text.dah_lines(ARGS.dah) if ARGS.dah.lower().endswith('.pdf') else open(ARGS.dah).read().splitlines()
    m = re.search(r'DAH Effective Date\s+(\d{1,2} [A-Z]{3} \d{4})', '\n'.join(lines[:400])) or \
        re.search(r'(\d{1,2} [A-Z]{3} \d{4})', os.path.basename(ARGS.dah).replace('_', ' '))
    if not m:
        mm = re.search(r'(\d{1,2})([A-Z]{3})(\d{4})', os.path.basename(ARGS.dah))
        meta['dah'] = f"{mm.group(1)} {mm.group(2)} {mm.group(3)}" if mm else ''
    else:
        meta['dah'] = m.group(1)
    for r in dah.parse(lines):
        lo, lok = dah.parse_limit(r['al']); hi, hik = dah.parse_limit(r['ah'])
        x = {}
        if r.get('ctrcls'): x['cc'] = r['ctrcls']
        if r.get('status'): x['st'] = r['status']
        dah_air.append(dict(cls=r['cls'], name=r['name'], lo=lo, lok=lok, hi=hi, hik=hik,
                            freq=fq(r['freq']) if r['freq'] else None, poly=r['poly'], x=x))

import openair
airspace = []
src_air = dah_air if dah_air else xc_air
meta['airspace'] = 'DAH' if dah_air else ('XC' if xc_air else '')
for a in src_air:
    if a['cls'] == 'BA': pass
    x = dict(a['x'])
    if a['cls'] == 'CTR' and 'cc' not in x:
        mm = re.search(r'\(([A-Z])\)', a['name']); x['cc'] = mm.group(1) if mm else 'D'
    if a['cls'] in ('CTR', 'C', 'D') and ersa_idx:
        u = ersa_unit(a['name'], a['cls'], a['lo'])
        if u: x['u'] = u
    poly = [[round(p, 4), round(q, 4)] for p, q in openair.simplify(a['poly'], 0.002)]
    if len(poly) < 3: continue
    airspace.append([a['cls'], a['name'], a['lo'], a['lok'], a['hi'], a['hik'], a['freq'], poly, x])

data = dict(
    built=meta['built'],
    meta=meta,
    ap=sorted([a for a in airports.values() if 'la' in a], key=lambda x: x['i']),
    sec=sectors,
    bnd={k: bounds[k] for k in sorted(used_b)},
    asp=airspace,
    dah=meta.get('dah') or meta.get('xc', ''),
)
json.dump(data, open(OUT, 'w'), separators=(',', ':'))
A = data['ap']
cnt = lambda f, v=None: sum(1 for a in A if (a.get(f) == v if v else f in a))
print('meta', meta)
print('aerodromes', len(A), 'from ERSA', cnt('s', 'E'))
print('CTAF', cnt('c'), 'by source', collections.Counter(a.get('cS') for a in A if 'c' in a))
print('ATIS', cnt('a'), collections.Counter(a.get('aS') for a in A if 'a' in a))
print('conflicts', sum(len(a.get('cf', [])) for a in A))
print('airspace', meta['airspace'], collections.Counter(a[0] for a in airspace),
      'with ERSA unit', sum(1 for a in airspace if a[8].get('u')))
