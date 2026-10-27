#!/usr/bin/env python3
"""Build compact JSON for the Radio Calls AU phone app.

Source precedence (first wins, every value carries its source):
  1. Airservices AIP: ERSA (--ersa, PDF or `pdftotext -layout` text) and DAH (--dah, PDF)
  2. XC Australia OpenAir file (--xc), unofficial, built from DAH/ERSA
  3. VATPAC vatSys australia-dataset (flight-sim, AIRAC-aligned)
  4. OurAirports (community)
Separately: ABS urban centres and localities (--urban data/abs/UCL_2021_AUST_GDA2020), used as populous areas for
the CASR 91.265 minimum height in flight-plan altitude suggestions (see urban.py); ABS suburbs and localities
(--sal data/abs/SAL_2021_AUST_GDA2020) as named points for search and map labels (see suburbs.py).
Usage: build_data.py DATA_DIR OUT.json [--ersa ERSA.pdf] [--dah DAH.pdf] [--xc openair.txt] [--urban UCL shapefile] [--sal SAL shapefile]
"""
import csv, json, re, sys, os, subprocess, collections, argparse
import xml.etree.ElementTree as ET
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

ap_ = argparse.ArgumentParser()
ap_.add_argument('data'); ap_.add_argument('out')
ap_.add_argument('--ersa'); ap_.add_argument('--dah'); ap_.add_argument('--xc'); ap_.add_argument('--urban'); ap_.add_argument('--sal')
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

# heliports / hospital landing sites are hidden unless "Show heliports" is on
for ap in airports.values():
    if re.search(r'\b(HOSPITAL|HELIPORT|HLS|HELIPAD|HELICOPTER BASE|MEDICAL)\b', (ap.get('n') or '').upper()): ap['t'] = 'H'

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
vfr_wp, ersa_nav = [], {}
ersa_sua = None
if ARGS.ersa:
    import ersa
    if ARGS.ersa.lower().endswith('.pdf'):
        txt = subprocess.run(['pdftotext', '-layout', ARGS.ersa, '-'], capture_output=True, text=True, errors='replace').stdout
    else:
        txt = open(ARGS.ersa, encoding='utf-8', errors='replace').read()
    m = re.search(r'AIP Australia\s+(\d{1,2} [A-Z]{3} \d{4})\s+FAC', txt)
    meta['ersa'] = m.group(1) if m else ''
    E = ersa.parse(txt)
    vfr_wp = ersa.vfr_waypoints(txt)
    ersa_nav = ersa.navaids(txt)
    import sua
    ersa_sua = sua.parse(txt)   # SUA tables: status, hours, authority, contact number, activity
    for icao, r in E.items():
        ap = airports.get(icao)
        if not ap:
            ap = airports[icao] = dict(i=icao)
        ap.update(n=r['n'], la=r['la'], lo=r['lo'], e=r.get('e', ap.get('e')), s='E')
        if re.search(r'\b(HOSPITAL|HELIPORT|HLS|HELIPAD|HELICOPTER BASE)\b', r['n']): ap['t'] = 'H'
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
        # label multiple tower frequencies East/West from the ERSA procedure text (e.g. YMMB 118.1 / 123.0)
        tw = [e for e in x if e[0] == 'TWR']
        if len(tw) > 1 and r.get('proc'):
            txt = ' '.join(' '.join(v) for v in r['proc'].values())
            for e in tw:
                F = re.escape(e[2]) + r'(?![\d])'
                hits = []
                for m in re.finditer(r'[^.;]*?\b(?:to|from) (?:the )?(E|W|EAST|WEST)\b[^.;]{0,25}?\b(?:call|on|contact)\s+' + F + r'[^.;]*', txt):
                    hits.append(('East' if m.group(1)[0] == 'E' else 'West', m.group(0).strip()))
                for m in re.finditer(r'[^.;]*?' + F + r'[^.;]{0,90}\b(eastern|western) circuit[^.;]*', txt, re.I):
                    hits.append(('East' if m.group(1).lower() == 'eastern' else 'West', m.group(0).strip()))
                sides = {h[0] for h in hits}
                if len(sides) == 1:
                    e += [hits[0][0], ' / '.join(dict.fromkeys(h[1][:150] for h in hits))]
        if x: ap['x'] = x; ap['xS'] = 'E'
        elif ap.get('xS') == 'O': ap.pop('x'); ap.pop('xS')
        if r.get('fia'): ap['fia'] = r['fia']
        for k3 in ('st', 'utc', 'cnotes', 'proc', 'keys', 'cct', 'var'):
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

# ---------- runways: DAH threshold positions first, ERSA physical characteristics for the rest ----------
import math
def _dest(la, lo, brg, nm):
    p1, l1, b_, d = math.radians(la), math.radians(lo), math.radians(brg), nm / 3440.065
    p2 = math.asin(math.sin(p1) * math.cos(d) + math.cos(p1) * math.sin(d) * math.cos(b_))
    l2 = l1 + math.atan2(math.sin(b_) * math.sin(d) * math.cos(p1), math.cos(d) - math.sin(p1) * math.sin(p2))
    return math.degrees(p2), math.degrees(l2)
def _recip(d):
    n = (int(d[:2]) + 18 - 1) % 36 + 1
    return f"{n:02d}" + {'L': 'R', 'R': 'L', 'C': 'C'}.get(d[2:], '')
thr = {}
if ARGS.dah and ersa_idx:
    thr_raw = dah.thresholds(lines)
    key = lambda n: re.sub(r'\W', '', n.upper())
    byname = {key(r['n']): icao for icao, r in ersa_idx.items()}
    for n, ends in thr_raw.items():
        icao = byname.get(key(n))
        if icao: thr[icao] = ends
nrw = collections.Counter()
for icao, r in ersa_idx.items():
    ap = airports.get(icao); rws = []
    ends = {e[0]: e for e in thr.get(icao, [])}
    phys = {(x[0], x[1]): x for x in r.get('rw', [])}
    done = set()
    # pairs from DAH thresholds (true positions)
    for d1, e1 in ends.items():
        d2 = _recip(d1)
        if d1 in done or d2 not in ends: continue
        e2 = ends[d2]; done |= {d1, d2}
        ph = phys.get((d1, d2)) or phys.get((d2, d1))
        lo_, hi_ = (e1, e2) if (d1, d2) in phys or not ph else (e2, e1)
        rws.append(dict(a=lo_[0], b=hi_[0], p=[round(lo_[2], 6), round(lo_[3], 6), round(hi_[2], 6), round(hi_[3], 6)],
                        len=ph[3] if ph else None, s=ph[4] if ph else None, w=ph[5] if ph else None, src='DAH'))
        nrw['DAH'] += 1
    # remaining runways from ERSA: schematic, centred on the ARP along the magnetic bearing
    for (d1, d2), ph in phys.items():
        if d1 in done or d2 in done: continue
        approx = ph[2] is None
        brgM = ph[2] if not approx else int(d1[:2]) * 10           # no bearing published: use the designator
        brgT = (brgM + r.get('var', 0)) % 360; L = (ph[3] or 600) / 1852
        a1 = _dest(r['la'], r['lo'], brgT + 180, L / 2); a2 = _dest(r['la'], r['lo'], brgT, L / 2)
        rws.append(dict(a=d1, b=d2, p=[round(a1[0], 6), round(a1[1], 6), round(a2[0], 6), round(a2[1], 6)],
                        len=ph[3], s=ph[4], w=ph[5], src='ERSA', sch=2 if approx or not ph[3] else 1))
        nrw['ERSA schematic'] += 1
    if rws and ap: ap['rw'] = [[x['a'], x['b'], *x['p'], x['len'], x['s'], x['w'], x['src'], x.get('sch', 0)] for x in rws]
print('runways', dict(nrw), 'aerodromes with runways', sum(1 for a in airports.values() if a.get('rw')))

# ---------- navigation points: ERSA VFR waypoints, DAH navaids (+ ERSA frequencies), DAH IFR waypoints ----------
nav_out, ifr_out = [], []
if ARGS.dah:
    for ident, typ, name, la, lo in dah.navaids(lines):
        f = (ersa_nav.get((ident, typ)) or [None])[0]
        nav_out.append([ident, typ, name, la, lo, f])
    # merge co-located VOR + DME into VOR/DME
    merged = {}
    for n in nav_out:
        k = n[0]; m = merged.get(k)
        if m and abs(m[3] - n[3]) + abs(m[4] - n[4]) < 0.01 and {m[1], n[1]} <= {'VOR', 'DME', 'TAC'}:
            if 'VOR' in (m[1], n[1]): m[1] = 'VOR/DME'; m[5] = m[5] if m[1] == 'VOR' else (n[5] if n[1] == 'VOR' else m[5])
            if n[1] == 'VOR' and n[5]: m[5] = n[5]
        else:
            merged[k + str(len(merged))] = n if not m else n
            if not m: merged[k] = merged.pop(k + str(len(merged) - 1))
    nav_out = list(merged.values())
    ifr_out = dah.ifr_waypoints(lines)
print('VFR waypoints', len(vfr_wp), 'navaids', len(nav_out), 'IFR waypoints', len(ifr_out))

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
    vw=[[c, n, la, lo] for c, n, s_, la, lo in vfr_wp],
    na=nav_out,
    iw=ifr_out,
)
if ersa_sua and ersa_sua['areas']:
    data['sua'] = ersa_sua
    print('SUA areas (ERSA)', len(ersa_sua['areas']))
if ARGS.urban:
    import urban
    data['urb'] = urban.load(ARGS.urban, 0.0005)
    meta['urban'] = 'ABS UCL 2021'
    print('urban areas', len(data['urb']))
if ARGS.sal:
    import suburbs
    data['sal'] = suburbs.load(ARGS.sal)
    meta['sal'] = 'ABS SAL 2021'
    print('suburbs', len(data['sal']))
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
