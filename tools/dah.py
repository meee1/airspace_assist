"""Parse the Airservices Designated Airspace Handbook (DAH) PDF.

Returns records shaped like openair.parse(): dict(cls, name, al, ah, poly, freq, status, section).
Geometry: straight segments between listed points, arcs about the given centre,
full circles.  'then along <feature> - P' is approximated by a straight line to P.
"""
import re, math
from openair import dest, brg_dist

SEC_CLASS = {2: 'CTR', 3: 'CTR', 4: 'A', 5: 'C', 6: 'D', 7: 'E', 11: 'EF', 12: 'FIA', 13: 'SUA', 14: 'BA'}
CO = r'(\d{6}(?:\.\d+)?)\s*([NS])\s+(\d{7}(?:\.\d+)?)\s*([EW])'
CON = r'\d{6}(?:\.\d+)?\s*[NS]\s+\d{7}(?:\.\d+)?\s*[EW]'
TOK = re.compile(
    r'(?P<arc>then along the (?P<dir>counter clockwise|anti-clockwise|anticlockwise|clockwise) arc of a circle radius (?P<r>[\d.]+)\s*NM centre\s+'
    + CON + r'(?:\s*\([^)]*\))?\s*-\s*' + CON + r')'
    r'|(?P<circ>A circle radius (?P<cr>[\d.]+)\s*NM centre\s+' + CON + r')'
    r'|(?P<pt>' + CON + r')')
PT = re.compile(CO)

def dms(m):
    la, ns, lo, ew = m
    def c(v, dw):
        w, _, f = v.partition('.')
        w = w.zfill(dw + 4)
        return int(w[:-4]) + int(w[-4:-2]) / 60 + float(w[-2:] + '.' + (f or '0')) / 3600
    a, b = c(la, 2), c(lo, 3)
    return (-a if ns == 'S' else a, -b if ew == 'W' else b)

def pts_in(s):
    return [dms(m) for m in PT.findall(s)]

def arc_pts(centre, start, end, cw, step=4):
    b1, r1 = brg_dist(centre, start); b2, r2 = brg_dist(centre, end)
    r = (r1 + r2) / 2
    sweep = (b2 - b1) % 360 if cw else -((b1 - b2) % 360)
    if abs(sweep) < 1e-6: sweep = 360 if cw else -360
    n = max(2, int(abs(sweep) / step))
    return [dest(centre[0], centre[1], b1 + sweep * i / n, r) for i in range(1, n)] + [end]

def geometry(text):
    poly = []
    for m in TOK.finditer(text):
        if m.group('arc'):
            c, e = pts_in(m.group('arc'))[-2:]
            if poly:
                poly.extend(arc_pts(c, poly[-1], e, m.group('dir') == 'clockwise'))
            else:
                poly.append(e)
        elif m.group('circ'):
            c = pts_in(m.group('circ'))[0]; r = float(m.group('cr'))
            poly.extend(dest(c[0], c[1], a, r) for a in range(0, 360, 5))
        else:
            p = pts_in(m.group('pt'))[0]
            if not poly or poly[-1] != p: poly.append(p)
    if len(poly) > 2 and poly[0] == poly[-1]: poly.pop()
    return poly

HDR = re.compile(r'^(Y[A-Z]{3}(?:-Y[A-Z]{3})?)/(.+?)\s*$')
FIELDS = ('LATERAL LIMITS:', 'VERTICAL LIMITS:', 'HOURS OF ACTIVITY:', 'CONTROLLING AUTHORITY:', 'CONDITIONAL STATUS:', 'COMMUNICATIONS')

def parse(lines):
    out = []; sec = 0; cur = None; field = None
    def flush():
        if cur and cur.get('lat'):
            poly = geometry(' '.join(cur['lat']))
            if len(poly) >= 3:
                cur['poly'] = poly; out.append(cur)
    for ln in lines:
        m = re.match(r'^SECTION (\d+)\s*[–-]', ln)
        if m:
            flush(); cur = None; sec = int(m.group(1)); continue
        if sec not in SEC_CLASS: continue
        m = HDR.match(ln)
        if m and not ln.startswith('LATERAL'):
            flush()
            name = m.group(2).strip()
            cls = SEC_CLASS[sec]
            if cls == 'CTR':
                cls = 'CTR'
            if cls == 'SUA':
                k = name[:1]
                cls = {'R': 'R', 'D': 'Q', 'P': 'P', 'M': 'Q'}.get(k, 'R')   # M = military operating area, a kind of danger area (ERSA SUA 4.1)
            freq = None
            fm = re.search(r'\s(1\d\d\.\d+)\w*$', name)
            if fm and cls in ('FIA', 'EF', 'BA'):
                freq = fm.group(1)
                name = re.sub(r'\s*(EFREQUENCY|BROADCAST AREA)?\s*1\d\d\.\d+\w*$', '', name).strip()
            cur = dict(cls=cls, name=name, fir=m.group(1), al='', ah='', lat=[], freq=freq, status='',
                       section=sec, ctrcls=('C' if sec == 2 else 'D' if sec == 3 else None))
            field = 'HDR'
            continue
        if cur is None: continue
        f = next((f for f in FIELDS if ln.startswith(f)), None)
        if field == 'HDR' and not f and cur['cls'] in ('FIA', 'EF', 'BA') and re.fullmatch(r'[A-Z0-9 .\'()/&-]+', ln.strip()):   # SUA entries have an activity line here instead
            # a header wrapped onto more lines ("YBBB/BATHURST" / "IS/GARDEN" / "PT/SNAKE" / "BAY" / "BROADCAST AREA 126.5")
            cur['name'] = (cur['name'] + ' ' + ln.strip()).strip()
            fm = re.search(r'\s(1\d\d\.\d+)\w*$', cur['name'])
            if fm and cur['cls'] in ('FIA', 'EF', 'BA'):
                cur['freq'] = fm.group(1)
                cur['name'] = re.sub(r'\s*(EFREQUENCY|BROADCAST AREA)?\s*1\d\d\.\d+\w*$', '', cur['name']).strip()
            continue
        if f:
            field = f; rest = ln[len(f):].strip()
            if f == 'VERTICAL LIMITS:':
                parts = [p.strip() for p in re.split(r'\s+-\s+', rest, maxsplit=1)]
                cur['al'] = parts[0]; cur['ah'] = parts[1] if len(parts) > 1 else ''
            elif f == 'CONDITIONAL STATUS:':
                cur['status'] = rest
            elif f == 'LATERAL LIMITS:':
                cur['lat'].append(rest)
            continue
        if field == 'LATERAL LIMITS:':
            cur['lat'].append(ln)
    flush()
    return out

def parse_limit(s):
    s = s.upper().strip()
    s = re.split(r'\s+OR\s+|\s+\(', s)[0].strip()
    if s in ('SFC', 'GND', ''): return 0, 'SFC'
    if s == 'UNL': return 99999, 'UNL'
    if s.startswith('BCTA'): return None, 'BCTA'
    if s.startswith('NOTAM'): return None, 'NOTAM'
    m = re.match(r'FL\s*(\d+)', s)
    if m: return int(m.group(1)) * 100, 'FL'
    m = re.match(r'(\d+)\s*(?:FT)?\s*AGL', s)
    if m: return int(m.group(1)), 'AGL'
    m = re.match(r'(\d+)', s)
    if m: return int(m.group(1)), 'AMSL'
    raise ValueError(s)


def thresholds(lines):
    """SECTION 18 certified aerodrome threshold data -> {AD NAME: [[rwy, brgT, lat, lon], ...]}"""
    i = max(k for k, l in enumerate(lines) if l.startswith('SECTION 18'))
    j = next((k for k in range(i + 1, len(lines)) if lines[k].startswith('SECTION 19')), len(lines))
    keep = [l.strip() for l in lines[i + 1:j] if l.strip() not in ('AD', 'BRG(T)', 'RWY', 'LAT', 'LONG') and not l.startswith('SECTION')]
    split = []
    for l in keep:   # some rows put the name and bearing on one line: "MELBOURNE/AVALON 187.59"
        m = re.match(r'^(.*[A-Z)/])\s+(\d{1,3}\.\d{2})$', l)
        split += [m.group(1), m.group(2)] if m else [l]
    txt = '|' + '|'.join(split)
    out = {}
    for m in re.finditer(r'\|([A-Z][A-Z /\'()-]*?(?:\|[A-Z(][A-Z /\'()-]*?)?)\|(\d{1,3}\.\d{2})\|(\d{2}[LRC]?)\|(\d{6}(?:\.\d+)?)([NS])\|(\d{7}(?:\.\d+)?)([EW])', txt):
        name = re.sub(r'\s*/\s*', '/', m.group(1).replace('|', ' ')).strip()
        la, lo = dms((m.group(4), m.group(5), m.group(6), m.group(7)))
        out.setdefault(name, []).append([m.group(3), float(m.group(2)), la, lo])
    return out


def _section(lines, num, nxt):
    i = max(k for k, l in enumerate(lines) if l.startswith(f'SECTION {num}'))
    j = next((k for k in range(i + 1, len(lines)) if lines[k].startswith(f'SECTION {nxt}')), len(lines))
    return [l.strip() for l in lines[i + 1:j] if l.strip()]

def navaids(lines):
    """SECTION 21 -> [[ident, type, name, lat, lon]] for VOR / NDB / DME / TAC"""
    toks = [t for t in _section(lines, 21, 22) if t not in ('NAME', 'TYPE', 'IDENT', 'LOCATION')]
    txt = '|' + '|'.join(toks)
    out = []
    for m in re.finditer(r'\|([A-Z][A-Z0-9 /\'().-]*?)\|(VOR|NDB|DME|TAC|VORTAC)\|([A-Z]{1,3})\|(\d{6}(?:\.\d+)?)([NS])\|(\d{7}(?:\.\d+)?)([EW])', txt):
        la, lo = dms((m.group(4), m.group(5), m.group(6), m.group(7)))
        out.append([m.group(3), m.group(2), m.group(1).strip(), round(la, 5), round(lo, 5)])
    return out

def ifr_waypoints(lines):
    """SECTION 22 -> [[name, lat, lon]]"""
    toks = [t for t in _section(lines, 22, 23) if t not in ('WAYPOINT', 'LOCATION')]
    txt = '|' + '|'.join(toks)
    out = []
    for m in re.finditer(r'\|([A-Z0-9]{2,6})\|(\d{6}(?:\.\d+)?)([NS])\|(\d{7}(?:\.\d+)?)([EW])', txt):
        la, lo = dms((m.group(2), m.group(3), m.group(4), m.group(5)))
        out.append([m.group(1), round(la, 4), round(lo, 4)])
    return out
