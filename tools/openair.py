"""Minimal OpenAir parser for the XC Australia airspace file.

Returns a list of dicts: {cls, name, al, ah, poly:[[lat,lon],...], section}
al/ah are raw limit strings; use parse_limit() to convert.
"""
import math, re

COORD = re.compile(r'(\d+):(\d+):(\d+(?:\.\d+)?)\s*([NS])\s*,?\s*(\d+):(\d+):(\d+(?:\.\d+)?)\s*([EW])')

def _c(m, i=0):
    la = int(m[i+0]) + int(m[i+1]) / 60 + float(m[i+2]) / 3600
    lo = int(m[i+4]) + int(m[i+5]) / 60 + float(m[i+6]) / 3600
    if m[i+3] == 'S': la = -la
    if m[i+7] == 'W': lo = -lo
    return la, lo

def coords(s):
    return [_c(m) for m in COORD.findall(s)]

R_NM = 3440.065

def dest(lat, lon, brg, dist_nm):
    p1, l1, b, d = math.radians(lat), math.radians(lon), math.radians(brg), dist_nm / R_NM
    p2 = math.asin(math.sin(p1) * math.cos(d) + math.cos(p1) * math.sin(d) * math.cos(b))
    l2 = l1 + math.atan2(math.sin(b) * math.sin(d) * math.cos(p1), math.cos(d) - math.sin(p1) * math.sin(p2))
    return math.degrees(p2), math.degrees(l2)

def brg_dist(a, b):
    p1, p2 = math.radians(a[0]), math.radians(b[0]); dl = math.radians(b[1] - a[1])
    x = math.sin(dl) * math.cos(p2); y = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    brg = (math.degrees(math.atan2(x, y)) + 360) % 360
    h = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return brg, 2 * R_NM * math.asin(min(1, math.sqrt(h)))

def arc(center, start, end, cw, step=5):
    b1, r1 = brg_dist(center, start); b2, r2 = brg_dist(center, end)
    r = (r1 + r2) / 2
    sweep = (b2 - b1) % 360 if cw else -((b1 - b2) % 360)
    n = max(2, int(abs(sweep) / step))
    return [dest(center[0], center[1], b1 + sweep * i / n, r) for i in range(1, n)] + [end]

def parse(text):
    out = []; cur = None; centre = None; cw = True; section = ''
    def flush():
        if cur and cur['poly']:
            out.append(cur)
    for raw in text.splitlines():
        line = raw.strip()
        if not line: continue
        if line.startswith('*'):
            m = re.search(r'CLASS ([A-Z ]+?)\s*\*', line)
            if m: section = m.group(1).strip()
            continue
        if line.startswith('AC '):
            flush(); cur = dict(cls=line[3:].strip(), name='', al='', ah='', poly=[], section=section)
            centre = None; cw = True
        elif cur is None:
            continue
        elif line.startswith('AN '): cur['name'] = line[3:].strip()
        elif line.startswith('AL '): cur['al'] = line[3:].strip()
        elif line.startswith('AH '): cur['ah'] = line[3:].strip()
        elif line.startswith('DP '):
            c = coords(line)
            if c: cur['poly'].append(c[0])
        elif line.startswith('V '):
            v = line[2:].replace(' ', '')
            if v.startswith('X='): centre = coords(line)[0]
            elif v.startswith('D='): cw = v[2:].startswith('+')
        elif line.startswith('DB '):
            c = coords(line)
            if len(c) == 2 and centre:
                if not cur['poly'] or cur['poly'][-1] != c[0]: cur['poly'].append(c[0])
                cur['poly'].extend(arc(centre, c[0], c[1], cw))
        elif line.startswith('DA '):
            r, a1, a2 = [float(x) for x in line[3:].split(',')]
            if centre:
                sweep = (a2 - a1) % 360 if cw else -((a1 - a2) % 360)
                n = max(2, int(abs(sweep) / 5))
                cur['poly'].extend(dest(centre[0], centre[1], a1 + sweep * i / n, r) for i in range(n + 1))
        elif line.startswith('DC '):
            r = float(line[3:])
            if centre:
                cur['poly'].extend(dest(centre[0], centre[1], a, r) for a in range(0, 360, 6))
                cur['centre'] = centre; cur['radius'] = r
    flush()
    return out

def parse_limit(s):
    """-> (feet, kind) kind in SFC, AMSL, AGL, FL, UNL, BCTA, NOTAM"""
    s = s.upper().strip()
    if s in ('SFC', 'GND'): return 0, 'SFC'
    if s == 'UNL': return 99999, 'UNL'
    if s == 'BCTA': return None, 'BCTA'
    if s == 'NOTAM': return None, 'NOTAM'
    m = re.fullmatch(r'FL\s*(\d+)', s)
    if m: return int(m.group(1)) * 100, 'FL'
    m = re.fullmatch(r'(\d+)\s*(FT)?\s*(AMSL|MSL)?', s)
    if m: return int(m.group(1)), 'AMSL'
    m = re.fullmatch(r'(\d+)\s*(FT)?\s*AGL', s)
    if m: return int(m.group(1)), 'AGL'
    raise ValueError(s)

def simplify(poly, tol):
    """Douglas-Peucker on lat/lon (degrees)."""
    if len(poly) < 4: return poly
    def rdp(pts):
        a, b = pts[0], pts[-1]
        dx, dy = b[1] - a[1], b[0] - a[0]; L = math.hypot(dx, dy) or 1e-12
        imax, dmax = 0, 0
        for i in range(1, len(pts) - 1):
            p = pts[i]
            d = abs(dy * (p[1] - a[1]) - dx * (p[0] - a[0])) / L if (dx or dy) else math.hypot(p[0]-a[0], p[1]-a[1])
            if d > dmax: imax, dmax = i, d
        if dmax > tol:
            return rdp(pts[:imax + 1])[:-1] + rdp(pts[imax:])
        return [a, b]
    # split closed ring in two halves for stability
    mid = len(poly) // 2
    return rdp(poly[:mid + 1])[:-1] + rdp(poly[mid:])
