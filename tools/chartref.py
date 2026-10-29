#!/usr/bin/env python3
"""Georeference an Airservices VTC/VNC PDF for the app's chart underlay -> an entry for tools/charts.json.

The charts themselves are never stored in the repo or the site: pilots import their own copy on the phone, and the app
only needs these numbers to place it. Model per chart panel:

    chart pt (u, v) = similarity( LCC(lat, lon) )
    LCC: spherical Lambert conformal conic, standard parallels 36S/39S, origin 37.8S 145E (same as the app's lccFwd)
    similarity with reflection (PDF y points down): u = a*x + b*y + c ; v = b*x - a*y + d
    then, where the panel has a printed graticule, an affine u = A0 x + A1 y + A2 ; v = A3 x + A4 y + A5 ('aff', which
    the app prefers): the PDF artwork is stretched ~0.4 % E-W, which a similarity cannot follow.

Fit:
 1. coarse: place-name labels on the chart matched to ERSA VFR waypoints / aerodromes (RANSAC);
 2. fine: chamfer match of the chart's printed controlled-airspace boundaries (the cyan C/D/A lines) against the DAH
    geometry. On the Melbourne VTC/VNC the median misfit is 0.5 pt (about 45 m on the VTC, 90 m on the VNC).
 3. graticule: affine fit to the chart's own meridians/parallels (rms < 10 m). This is the chart's true frame:
    aerodrome symbols then sit within ~10-15 m of ERSA, R/D areas within ~45 m. The cyan C/D/A lines are printed
    ~100-130 m off DAH in that frame (drafting), so the app's own DAH lines will not sit exactly on the cyan.
Panels (neatlines) are taken from the chart's 0.99 pt black frame lines, or given with --panel x0,y0,x1,y1 (repeatable).

Usage:
  python chartref.py CHART.pdf --dah DAH.pdf --data data.json --sheet ML-VTC --name "Melbourne VTC" --kind VTC \
         --match melbourne [--levels 0.5,2.5] [--panel ...] >> new_sheet.json
Then add the printed sheet to tools/charts.json, re-run assemble.py, and import the PDF on the phone to check it lines
up with the app's airspace. Needs pymupdf, numpy, scipy, opencv-python (and dah.py / dah_text.py from this folder).
"""
import argparse, json, math, os, random, sys
import numpy as np

R_NM = 6371008.8 / 1852
CYAN = (0.0, 0.681, 0.938)          # Airservices VTC/VNC controlled-airspace boundary colour (filled outlines)

GLAST = {}
PROJ = (-36, -39, -37.8, 145.0)      # lat1, lat2, lat0, lon0 of the sheet being fitted (default: Victoria, as the app's lccFwd)

class LCC:
    def __init__(s, lat1=None, lat2=None, lat0=None, lon0=None):
        if lat1 is None: lat1, lat2, lat0, lon0 = PROJ
        p1, p2, p0 = map(math.radians, (lat1, lat2, lat0)); s.lon0 = math.radians(lon0)
        s.n = math.log(math.cos(p1) / math.cos(p2)) / math.log(math.tan(math.pi / 4 + p2 / 2) / math.tan(math.pi / 4 + p1 / 2))
        s.F = math.cos(p1) * math.tan(math.pi / 4 + p1 / 2) ** s.n / s.n
        s.r0 = R_NM * s.F / math.tan(math.pi / 4 + p0 / 2) ** s.n
    def fwd(s, la, lo):
        p = np.radians(np.asarray(la, float)); l = np.radians(np.asarray(lo, float))
        r = R_NM * s.F / np.tan(np.pi / 4 + p / 2) ** s.n; th = s.n * (l - s.lon0)
        return r * np.sin(th), s.r0 - r * np.cos(th)

def sim_fit(X, Y, U, V):
    A, B = [], []
    for x, y, u, v in zip(X, Y, U, V):
        A.append([x, y, 1, 0]); B.append(u); A.append([-y, x, 0, 1]); B.append(v)
    return np.linalg.lstsq(np.array(A), np.array(B), rcond=None)[0]

def sim_apply(p, x, y):
    a, b, c, d = p; return a * x + b * y + c, -a * y + b * x + d

def drawings(page):
    out = []
    for g in page.get_drawings():
        pts = []
        for it in g['items']:
            if it[0] == 'l': pts += [(it[1].x, it[1].y), (it[2].x, it[2].y)]
            elif it[0] == 'c':
                a, b, c, e = it[1:5]
                for t in (0, .25, .5, .75, 1):
                    mt = 1 - t
                    pts.append((mt**3*a.x + 3*mt*mt*t*b.x + 3*mt*t*t*c.x + t**3*e.x, mt**3*a.y + 3*mt*mt*t*b.y + 3*mt*t*t*c.y + t**3*e.y))
            elif it[0] == 're':
                r = it[1]; pts += [(r.x0, r.y0), (r.x1, r.y0), (r.x1, r.y1), (r.x0, r.y1), (r.x0, r.y0)]
        if len(pts) < 2: continue
        sc = tuple(round(c, 3) for c in g['color']) if g.get('color') else None
        fc = tuple(round(c, 3) for c in g['fill']) if g.get('fill') else None
        out.append((sc, fc, g.get('width'), pts))
    return out

def frames(D, page_wh=None):
    """Map neatlines -> panel outlines. Closed black ~1 pt frames longer than 1000 pt (main map and insets), inside the
    page, without duplicates. If the main map's neatline is drawn as separate straight pieces, its outline is the box
    around the long ~1 pt black pieces, less any inset frames inside it."""
    W, H = page_wh or (1e9, 1e9); res = []
    def add(u):
        xs = [q[0] for q in u]; ys = [q[1] for q in u]; bb = (min(xs), min(ys), max(xs), max(ys))
        if bb[0] < -5 or bb[1] < -5 or bb[2] > W + 5 or bb[3] > H + 5: return              # bleeds off the page: not a neatline
        if any(all(abs(x - y) <= 3 for x, y in zip(bb, r[1])) for r in res): return    # the same frame twice
        res.append((u, bb))
    for sc, fc, w, pts in D:
        if sc and max(sc) < 0.2 and w and 0.9 < w < 1.1:
            L = sum(math.hypot(pts[i+1][0]-pts[i][0], pts[i+1][1]-pts[i][1]) for i in range(len(pts) - 1))
            if L > 1000 and math.hypot(pts[0][0]-pts[-1][0], pts[0][1]-pts[-1][1]) < 2:
                u = []
                for q in pts:
                    q = (round(q[0]), round(q[1]))
                    if not u or q != u[-1]: u.append(q)
                add(u[:-1] if u[0] == u[-1] else u)
    big = [r for r in res if (r[1][2] - r[1][0]) * (r[1][3] - r[1][1]) > 0.25 * W * H]
    if not big and page_wh:
        seg = []
        for sc, fc, w, pts in D:
            if sc and max(sc) < 0.2 and w and 0.9 < w < 1.1:
                for k in range(len(pts) - 1):
                    (x0, y0), (x1, y1) = pts[k], pts[k + 1]
                    if math.hypot(x1 - x0, y1 - y0) > 400 and (abs(x1 - x0) < 1 or abs(y1 - y0) < 1): seg += [(x0, y0), (x1, y1)]
        if len(seg) >= 4:
            xs = [q[0] for q in seg]; ys = [q[1] for q in seg]; box = (min(xs), min(ys), max(xs), max(ys))
            if (box[2] - box[0]) * (box[3] - box[1]) > 0.25 * W * H:
                from shapely.geometry import box as sbox, Polygon
                main = sbox(*box)
                for u, bb in res:
                    if bb[0] >= box[0] - 2 and bb[2] <= box[2] + 2 and bb[1] >= box[1] - 2 and bb[3] <= box[3] + 2: main = main.difference(Polygon(u).buffer(1))
                if main.geom_type == 'Polygon':
                    res.insert(0, ([(round(x), round(y)) for x, y in list(main.exterior.coords)[:-1]], box))
    res.sort(key=lambda r: -(r[1][2] - r[1][0]) * (r[1][3] - r[1][1]))                 # main map first, then insets
    return [u for u, bb in res]

_PLACES = {}
def places(data):
    """name -> [(lat, lon)]: ERSA VFR waypoints and aerodromes, plus ABS towns (small urban centres and localities, by
    their centre) and suburbs/localities. Only names that occur once are used for matching."""
    k = id(data)
    if k in _PLACES: return _PLACES[k]
    cand = {}
    for c, n, la, lo in data['vw']: cand.setdefault(n.upper(), []).append((la, lo))
    for a in data['ap']: cand.setdefault(a['n'].upper().split('/')[-1], []).append((a['la'], a['lo']))
    town = {}
    for n, t, bb, *_ in data.get('urb', []):
        if t == 'M' or (bb[1] - bb[0]) > 400 or (bb[3] - bb[2]) > 500: continue        # big cities: the label is far from the centre
        town.setdefault(n.upper(), []).append(((bb[0] + bb[1]) / 2e4, (bb[2] + bb[3]) / 2e4))
    for n, la, lo, *_ in data.get('sal', []): town.setdefault(n.upper().split(' (')[0], []).append((la / 1e4, lo / 1e4))
    for n, v in town.items():
        if n in cand: continue                                                          # ERSA wins
        u = []
        for q in v:
            if not any(abs(q[0] - w[0]) < 0.05 and abs(q[1] - w[1]) < 0.05 for w in u): u.append(q)   # UCL and SAL of the same town
        cand[n] = u
    _PLACES[k] = cand; return cand

def coarse_pairs(lines, data, poly):
    from matplotlib.path import Path as MPath
    cand = places(data)
    pp = MPath(poly); lc = LCC(); pairs = []
    for t, b in lines:
        k = t.upper(); cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
        if k in cand and len(cand[k]) == 1 and pp.contains_point((cx, cy)):
            x, y = lc.fwd(*cand[k][0]); pairs.append((float(x), float(y), cx, cy))
    return pairs

def coarse(lines, data, poly, scl=None):
    from matplotlib.path import Path as MPath  # noqa
    cand = places(data)
    pp = MPath(poly); lc = LCC(); pairs = []
    for t, b in lines:
        k = t.upper(); cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
        if k in cand and len(cand[k]) == 1 and pp.contains_point((cx, cy)):
            x, y = lc.fwd(*cand[k][0]); pairs.append((float(x), float(y), cx, cy))
    if len(pairs) < 3: raise SystemExit('not enough labelled places inside the panel for a first fit')
    random.seed(1); best = None
    for _ in range(4000):
        s = random.sample(pairs, 2)
        p = sim_fit(*zip(*[(q[0], q[1], q[2], q[3]) for q in s]))
        sc = math.hypot(p[0], p[1])
        if scl and not (scl[0] <= sc <= scl[1]): continue      # chart scale known from its kind (VTC 1:250k, VNC 1:500k)
        inl = [q for q in pairs if math.hypot(*np.subtract(sim_apply(p, q[0], q[1]), (q[2], q[3]))) < 1.2 * sc]
        if not best or len(inl) > len(best[1]): best = (p, inl)
    if not best or len(best[1]) < 2: raise SystemExit('no consistent label matches at this scale')
    return sim_fit(*zip(*[(q[0], q[1], q[2], q[3]) for q in best[1]])), len(best[1])

def lcc_inv(lc, x, y):
    s = np.sign(lc.n); rho = s * np.sqrt(x ** 2 + (lc.r0 - y) ** 2); th = np.arctan2(x * s, (lc.r0 - y) * s)
    return np.degrees(2 * np.arctan((R_NM * lc.F / rho) ** (1 / lc.n)) - np.pi / 2), np.degrees(lc.lon0 + th / lc.n)

_GSEG = {}
def _gsegs(page, pp, bez):
    segs = []
    for g in page.get_drawings():
        col = g.get('color'); w = g.get('width') or 0
        if col is None or max(col) > 0.2 or w > 0.45: continue
        for it in g['items']:
            if it[0] == 'l': A = np.array([(it[1].x + (it[2].x - it[1].x) * t, it[1].y + (it[2].y - it[1].y) * t) for t in np.linspace(0, 1, 8)])
            elif it[0] == 'c': A = np.array([bez(*it[1:5], t) for t in np.linspace(0, 1, 9)])
            else: continue
            if np.hypot(*(A[-1] - A[0])) < 60: continue
            A = A[[pp.contains_point(q, radius=-3) for q in A]]
            if len(A) >= 3: segs.append(A)
    return segs

def graticule(page, p, poly):
    """Affine fit to the chart's own graticule (thin black meridians and parallels inside the panel).

    The printed artwork is stretched about 0.4 % east-west relative to north-south on the Melbourne VTC/VNC, so a
    similarity fitted to the airspace leaves the topography (aerodromes, coast, roads) 150-350 m out at the panel edges.
    Fitted to the graticule the residual is under 10 m and aerodrome symbols land within ~10-15 m of their ERSA position.
    Returns (affine [A0..A5] with u = A0 x + A1 y + A2, v = A3 x + A4 y + A5, rms m, n lines) or None."""
    from matplotlib.path import Path as MPath
    from scipy.optimize import least_squares
    pp = MPath(poly); lc = LCC(); a, b, c, d = p; sc = math.hypot(a, b)
    def bez(q0, q1, q2, q3, t):
        m = 1 - t; return (m**3*q0.x + 3*m*m*t*q1.x + 3*m*t*t*q2.x + t**3*q3.x, m**3*q0.y + 3*m*m*t*q1.y + 3*m*t*t*q2.y + t**3*q3.y)
    # candidate segments: every straight piece (or curve) of the thin black lines inside the panel, at least 60 pt long.
    # A graticule may be drawn as long lines or as a rectangle per cell, and a sheet may be printed rotated, so pieces are
    # classed as meridian / parallel by their direction on the ground (from the first fit), not on the page.
    ck = (id(page), tuple(map(tuple, poly)))
    if ck in _GSEG: segs = _GSEG[ck]
    else: segs = _GSEG[ck] = _gsegs(page, pp, bez)
    def toll(T, u, v):
        x, y = np.linalg.solve(np.array([[T[0], T[1]], [T[3], T[4]]]), np.vstack([u - T[2], v - T[5]])); return lcc_inv(lc, x, y)
    cl = math.cos(math.radians(PROJ[2]))   # residual in NM east-west near the chart centre (metres after *1852)
    def assign(T, tol):
        obs = []
        for A in segs:
            la, lo = toll(T, A[:, 0], A[:, 1]); dla, dlo = np.ptp(la), np.ptp(lo) * cl
            if dla > 4 * dlo and dla > 1 / 60: kind, val = 'mer', np.mean(lo)
            elif dlo > 4 * dla and dlo > 1 / 60: kind, val = 'par', np.mean(la)
            else: continue
            for step in (1 / 6, 1 / 12):
                t = round(val / step) * step
                if abs(val - t) < tol * step: obs.append((kind, t, A)); break
        return obs
    def res(T, obs):
        r = []
        for kind, t, A in obs:
            la, lo = toll(T, A[:, 0], A[:, 1]); r.append((lo - t) * 60 * cl if kind == 'mer' else (la - t) * 60)
        return np.concatenate(r) * 1852
    T = np.array([a, b, c, b, -a, d]); global GLAST; GLAST = dict(segs=len(segs))
    for tol in (0.4, 0.25, 0.15):          # assign, fit (robust), re-assign tighter
        obs = assign(T, tol); GLAST.update(mer=sum(k == 'mer' for k, _, _ in obs), par=sum(k == 'par' for k, _, _ in obs))
        if GLAST['mer'] < 2 or GLAST['par'] < 2: return None
        T = least_squares(lambda q: res(q, obs), T, x_scale=[0.01, 0.01, 1, 0.01, 0.01, 1], loss='soft_l1', f_scale=50).x
    GLAST.update(mer_vals=len({round(t, 4) for k_, t, _ in obs if k_ == 'mer'}), par_vals=len({round(t, 4) for k_, t, _ in obs if k_ == 'par'}))
    if GLAST['mer_vals'] < 2 or GLAST['par_vals'] < 2: return None     # one parallel (or meridian) leaves that scale unfixed
    r = res(T, obs); r = r[np.abs(r) < 200]   # ignore stray black lines that happen to run along a parallel
    if len(r) < 20: return None
    rms = float(np.sqrt(np.mean(r ** 2))); GLAST['rms'] = rms
    if rms > 60: return None          # not a clean graticule: keep the airspace similarity
    return T, rms, len(obs)

PUR = (0.352, 0.179, 0.569)   # aerodrome symbols (filled purple circles) on Airservices VTC/VNC
def symbols(D):
    out = []
    for sc, fc, w, pts in D:
        if fc != PUR: continue
        A = np.array(pts); ex = A.max(0) - A.min(0)
        if 4 < ex[0] < 22 and abs(ex[0] - ex[1]) < 0.8: out.append((A.max(0) + A.min(0)) / 2)
    return np.array(out) if out else np.zeros((0, 2))

def symfit(D, data, T0, poly, tols=(8, 5, 3, 2)):
    """Affine fit of ERSA aerodrome positions to the aerodrome symbols printed on the chart, starting from T0 and
    tightening the match radius. Returns (affine, median offset m, matches) or None. Used where the graticule can't be
    fitted (or disagrees with the symbols)."""
    from matplotlib.path import Path as MPath
    from scipy.optimize import least_squares
    sy = symbols(D)
    if len(sy) < 6: return None
    pp = MPath(poly); lc = LCC(); X = []
    for ad in data['ap']:
        x, y = lc.fwd([ad['la']], [ad['lo']]); X.append((float(x[0]), float(y[0])))
    X = np.array(X); T = np.array(T0, float)
    for tol in tols:
        u = T[0] * X[:, 0] + T[1] * X[:, 1] + T[2]; v = T[3] * X[:, 0] + T[4] * X[:, 1] + T[5]
        pr = []
        for i in range(len(X)):
            if not pp.contains_point((u[i], v[i]), radius=-5): continue
            d = np.hypot(sy[:, 0] - u[i], sy[:, 1] - v[i]); j = d.argmin()
            if d[j] < tol: pr.append((i, j))
        if len(pr) < 6: return None
        I = np.array([q[0] for q in pr]); J = np.array([q[1] for q in pr])
        def r(q): return np.concatenate([q[0] * X[I, 0] + q[1] * X[I, 1] + q[2] - sy[J, 0], q[3] * X[I, 0] + q[4] * X[I, 1] + q[5] - sy[J, 1]])
        T = least_squares(r, T, x_scale=[0.01, 0.01, 1, 0.01, 0.01, 1], loss='soft_l1', f_scale=0.5).x
    sc = math.hypot(T[0], T[3]); e = np.hypot(*r(T).reshape(2, -1)) / sc * 1852
    return T, float(np.median(e)), len(pr)

def symcheck(D, data, T, poly):
    """median offset (m) of aerodrome symbols from the ERSA positions under affine T, and how many were found"""
    from matplotlib.path import Path as MPath
    sy = symbols(D); pp = MPath(poly); lc = LCC(); e = []; sc = math.hypot(T[0], T[3])
    if not len(sy): return None, 0
    for ad in data['ap']:
        x, y = lc.fwd([ad['la']], [ad['lo']]); u = T[0] * x[0] + T[1] * y[0] + T[2]; v = T[3] * x[0] + T[4] * y[0] + T[5]
        if not pp.contains_point((u, v), radius=-5): continue
        d = np.hypot(sy[:, 0] - u, sy[:, 1] - v).min()
        if d < 8: e.append(d / sc * 1852)
    return (float(np.median(e)) if e else None), len(e)

_PREP = {}
def refine(D, dah, p0, poly, page_wh, S=2, quick=False):
    from scipy.optimize import minimize
    key = tuple(map(tuple, poly))
    if key in _PREP: cost, X, Y, inside, dt = _PREP[key]
    else: cost, X, Y, inside, dt = _PREP.setdefault(key, _prep(D, dah, poly, page_wh, S))
    if quick: return cost(np.array(p0, float), 30)
    p = np.array(p0, float)
    for tr in (30, 12, 5, 2.5):
        p = minimize(lambda q: cost(q, tr), p, method='Nelder-Mead', options={'xatol': 1e-4, 'fatol': 1e-5, 'maxiter': 4000}).x
    u, v = sim_apply(p, X, Y); k = inside(u, v); d = dt[(v[k] * S).astype(int), (u[k] * S).astype(int)]
    return p, float(np.median(d)), int(k.sum())

def _prep(D, dah, poly, page_wh, S):
    import cv2
    from scipy.ndimage import distance_transform_edt
    from matplotlib.path import Path as MPath
    W, H = int(page_wh[0]) + 1, int(page_wh[1]) + 1
    mask = np.zeros((H * S, W * S), np.uint8)
    for sc, fc, w, pts in D:
        if fc == CYAN or sc == CYAN: cv2.polylines(mask, [(np.array(pts) * S).astype(np.int32)], False, 255, 1)
    clipm = np.zeros_like(mask); cv2.fillPoly(clipm, [(np.array(poly) * S).astype(np.int32)], 255); mask &= clipm
    dt = distance_transform_edt(mask == 0) / S
    lc = LCC(); P = []
    for a in dah:
        if a['cls'] not in ('C', 'CTR', 'D', 'A'): continue
        ring = a['poly'] + [a['poly'][0]]
        for i in range(len(ring) - 1):
            (a1, o1), (a2, o2) = ring[i], ring[i + 1]; n = max(1, int(math.hypot(a2 - a1, (o2 - o1) * 0.79) * 60 / 0.05))
            P += [(a1 + (a2 - a1) * k / n, o1 + (o2 - o1) * k / n) for k in range(n)]
    P = np.array(P); X, Y = lc.fwd(P[:, 0], P[:, 1]); pp = MPath(poly)
    def inside(u, v):
        k = (u > 1) & (v > 1) & (u < W - 2) & (v < H - 2)
        k[k] = pp.contains_points(np.c_[u[k], v[k]], radius=-4); return k
    def cost(p, tr):
        u, v = sim_apply(p, X, Y); k = inside(u, v)
        if k.sum() < 100: return 1e9
        return np.mean(np.minimum(dt[(v[k] * S).astype(int), (u[k] * S).astype(int)], tr))
    return cost, X, Y, inside, dt

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('pdf'); ap.add_argument('--dah', required=True); ap.add_argument('--data', required=True)
    ap.add_argument('--sheet', required=True); ap.add_argument('--name', required=True); ap.add_argument('--kind', required=True)
    ap.add_argument('--match', required=True, help='regex that must appear in the file name or PDF title, e.g. melbourne')
    ap.add_argument('--levels', default=None, help='render scales: overview,detail (default 0.5,2.5 VTC / 0.5,2.0 VNC)')
    ap.add_argument('--panel', action='append', help='x0,y0,x1,y1 in PDF pt, if the frames are not found automatically')
    ap.add_argument('--near', default=None, help='lat,lon roughly at the chart centre, for charts with no readable text: the '
                    'aerodrome symbols are then matched to nearby ERSA aerodromes to locate it')
    ap.add_argument('--proj', default='auto', help='Lambert conformal conic for this sheet: lat1,lat2,lat0,lon0, "auto" (centred on the '
                    'places found on the chart; written to the sheet as "proj") or "vic" (the original -36,-39,-37.8,145, no "proj" key)')
    a = ap.parse_args()
    import pymupdf
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import dah as dahmod, dah_text
    page = pymupdf.open(a.pdf)[0]; D = drawings(page)
    lines = []
    for b in page.get_text('dict')['blocks']:
        for l in b.get('lines', []):
            t = ' '.join(s['text'].strip() for s in l['spans']).strip()
            if t: lines.append((t, l['bbox']))
    data = json.load(open(a.data)); dah = dahmod.parse(dah_text.dah_lines(a.dah))
    # some charts embed fonts with shifted codes (e.g. 'KRVSLWDO' = 'hospital', '\x15\x13' = '20'): use whichever reading
    # matches more ERSA / ABS place names
    dec = lambda t: ''.join(chr(ord(ch) + 29) if 3 <= ord(ch) < 0x5e else ch for ch in t)
    pl = places(data); hit = lambda L: sum(1 for t, b in L if t.upper() in pl)
    alt = [(dec(t), b) for t, b in lines]
    if hit(alt) > max(2, hit(lines)): lines = alt; print('text: decoded shifted font codes', file=sys.stderr)
    global PROJ
    proj = None
    if a.proj == 'auto':
        # centre the projection on the chart: the places printed on it that match ERSA (median), standard parallels a
        # third of the way in from the top and bottom of their spread, so the scale error over the sheet stays tiny
        cand = places(data)
        ll = np.array([cand[t.upper()][0] for t, b in lines if t.upper() in cand and len(cand[t.upper()]) == 1])
        if len(ll) < 3 and a.near: ll = np.array([[float(v) for v in a.near.split(',')]] * 3)
        if len(ll) < 3: raise SystemExit('not enough place names on the chart to centre its projection; give --proj or --near')
        la_c, lo_c = float(np.median(ll[:, 0])), float(np.median(ll[:, 1])); q = np.percentile(ll[:, 0], [10, 90])
        h = max(0.3, (q[1] - q[0]) / 3)
        proj = [round(la_c + h, 2), round(la_c - h, 2), round(la_c, 2), round(lo_c, 2)]
    elif a.proj != 'vic': proj = [float(v) for v in a.proj.split(',')]
    if proj: PROJ = tuple(proj); print(f'projection: LCC parallels {proj[0]}, {proj[1]}, origin {proj[2]}, {proj[3]}', file=sys.stderr)
    polys = [[(x0, y0), (x1, y0), (x1, y1), (x0, y1)] for x0, y0, x1, y1 in (map(float, s.split(',')) for s in a.panel)] if a.panel else frames(D, (page.rect.width, page.rect.height))
    if not polys: polys = [[(0, 0), (page.rect.width, 0), (page.rect.width, page.rect.height), (0, page.rect.height)]]
    def fit_panels():
        panels = []; first = None
        for k, poly in enumerate(polys):
            base = 21.0 if a.kind == 'VTC' else 10.5
            try: p0, n = coarse(lines, data, poly, (0.8 * base, 1.25 * base) if first is None else (0.8 * base, 3.5 * base))
            except SystemExit: p0, n = None, 0
            tries = [p0] if p0 is not None else []
            if n < 6 and first is not None:
                # few labels (e.g. an enlarged inset): sweep the scale against the first panel, translation from the labels
                pairs = coarse_pairs(lines, data, poly); s0 = math.hypot(first[0], first[1]); r0 = math.atan2(first[1], first[0])
                sweep = []
                for f in np.arange(1.0, 3.01, 0.05):
                    a_, b_ = s0 * f * math.cos(r0), s0 * f * math.sin(r0)
                    for q in pairs:      # each label in turn anchors the translation; a quick chamfer score ranks them
                        t = np.array([a_, b_, q[2] - (a_ * q[0] + b_ * q[1]), q[3] - (b_ * q[0] - a_ * q[1])])
                        sweep.append((refine(D, dah, t, poly, (page.rect.width, page.rect.height), quick=True), t))
                sweep.sort(key=lambda z: z[0]); tries += [t for _, t in sweep[:4]]
            def locate(p, tols=(8, 5, 3, 2)):
                """best affine for the panel from start p: (aff, score m, message) or None"""
                gr = graticule(page, p, poly); opts = []
                Ts = [[p[0], p[1], p[2], p[1], -p[0], p[3]]] + ([list(gr[0])] if gr else [])
                sfs = [r_ for r_ in (symfit(D, data, T_, poly, tols) for T_ in Ts) if r_ and r_[2] >= 6]
                sf = min(sfs, key=lambda r_: r_[1]) if sfs else None
                if gr:
                    mg, ng = symcheck(D, data, gr[0], poly)
                    if mg is None or ng < 5 or mg < 100:
                        opts.append((gr[0], gr[1] if gr[1] <= 20 else gr[1] + 20, f'graticule affine from {gr[2]} lines, rms {gr[1]:.0f} m'
                                     + (f'; aerodrome symbols {mg:.0f} m (n={ng})' if mg is not None else '')))
                if sf and sf[1] < 60: opts.append((sf[0], sf[1] + 5, f'aerodrome-symbol affine from {sf[2]} aerodromes, median {sf[1]:.0f} m'))
                def sane(T_):   # charts are conformal: x and y scales within 2 %, axes square within 1 degree
                    sx, sy_ = math.hypot(T_[0], T_[3]), math.hypot(T_[1], T_[4]); cosang = (T_[0] * T_[1] + T_[3] * T_[4]) / (sx * sy_)
                    return abs(sx / sy_ - 1) < 0.02 and abs(cosang) < 0.02
                opts = [o for o in opts if sane(o[0])]
                # a graticule fit can be out by a whole graticule step (10'): check it against the printed controlled
                # airspace (cyan) as well, where there is some
                pk = tuple(map(tuple, poly))
                if pk not in _PREP: refine(D, dah, p, poly, (page.rect.width, page.rect.height), quick=True)
                _c, X_, Y_, inside_, dt_ = _PREP[pk]; ok_ = []
                for o in opts:
                    T_ = o[0]; u_ = T_[0] * X_ + T_[1] * Y_ + T_[2]; v_ = T_[3] * X_ + T_[4] * Y_ + T_[5]; kk = inside_(u_, v_)
                    if kk.sum() >= 200 and np.median(dt_[(v_[kk] * 2).astype(int), (u_[kk] * 2).astype(int)]) > 3: continue
                    ok_.append(o)
                opts = ok_
                return min(opts, key=lambda o: o[1]) if opts else None
            best = None
            for t0 in tries:
                r = refine(D, dah, t0, poly, (page.rect.width, page.rect.height))
                if best is None or r[1] < best[1]: best = r
            loc = None
            if best is not None:
                p, med, npts = best; loc = locate(p)
                print(f'panel {k}: {n} label matches, {npts} boundary samples, median misfit {med:.2f} pt, {math.hypot(p[0], p[1]):.2f} pt/NM', file=sys.stderr)
            if loc is None and first is None:
                # few or poor label matches: assume north up at the chart's nominal scale, anchored on each matched name
                # (or, with --near and no text, on each aerodrome symbol for each nearby ERSA aerodrome); rank the starts
                # by how many aerodrome symbols they line up (cheap), then fit the best few properly
                from matplotlib.path import Path as MPath
                lc_ = LCC(); sy = symbols(D); pp_ = MPath(poly)
                syp = np.array([q for q in sy if pp_.contains_point(q)]) if len(sy) else np.zeros((0, 2))
                AX = np.array([[float(v[0]) for v in lc_.fwd([ad['la']], [ad['lo']])] for ad in data['ap']]).reshape(-1, 2)
                starts = [np.array([base, 0.0, q[2] - base * q[0], q[3] + base * q[1]]) for q in coarse_pairs(lines, data, poly)]
                if a.near and len(syp):
                    nla, nlo = [float(v) for v in a.near.split(',')]
                    near_i = [i_ for i_, ad in enumerate(data['ap']) if abs(ad['la'] - nla) < 1.0 and abs(ad['lo'] - nlo) < 1.0]
                    starts += [np.array([base, 0.0, q[0] - base * AX[i_, 0], q[1] + base * AX[i_, 1]]) for i_ in near_i for q in syp]
                def votes(t):
                    if not len(syp): return 0
                    u_ = t[0] * AX[:, 0] + t[2]; v_ = -t[0] * AX[:, 1] + t[3]
                    m_ = (u_ > -50) & (v_ > -50) & (u_ < page.rect.width + 50) & (v_ < page.rect.height + 50)
                    if not m_.any(): return 0
                    d_ = np.hypot(u_[m_, None] - syp[None, :, 0], v_[m_, None] - syp[None, :, 1]).min(1)
                    return int((d_ < 15).sum())
                starts.sort(key=lambda t: -votes(t))
                for t in starts[:4]:
                    l2 = locate(t, (40, 20, 10, 5, 3, 2))
                    if l2 and (loc is None or l2[1] < loc[1]): loc, p, med = l2, t, 0.0
                if loc: print(f'panel {k}: located from a north-up start on the chart scale', file=sys.stderr)
            if loc is None and best is not None and med <= 0.75 and n >= 3:
                # no graticule or symbol fit, but the airspace lines fit well: use the similarity (about 45 m on a VTC)
                loc = ([p[0], p[1], p[2], p[1], -p[0], p[3]], 50.0, f'airspace similarity (misfit {med:.2f} pt; no graticule or symbol fit)')
            if loc is None:
                print(f'panel {k}: dropped (could not be located: not a map panel, or too few names and symbols)', file=sys.stderr); continue
            if first is None: first = p
            pd = dict(id=f'{a.sheet}-{k}' if k else a.sheet, name=a.name if not k else f'{a.name} (panel {k + 1})', order=k + (0 if a.kind == 'VNC' else 1),
                      sim=[round(float(v), 6) for v in p], aff=[round(float(v), 6) for v in loc[0]], _s=float(loc[1]))
            print(f'panel {k}: {loc[2]} (app uses this)', file=sys.stderr)
            pd['clip'] = [[round(x), round(y)] for x, y in poly]; panels.append(pd)

        return panels
    panels = fit_panels()
    if a.proj == 'auto' and panels:
        # second pass: centre the projection on what the panels actually cover (labels can include far-off places)
        lc = LCC(); g = []
        for pd in panels:
            A0, A1, A2, A3, A4, A5 = pd.get('aff') or (pd['sim'][0], pd['sim'][1], pd['sim'][2], pd['sim'][1], -pd['sim'][0], pd['sim'][3])
            M = np.array([[A0, A1], [A3, A4]])
            for u, v in pd['clip']:
                x, y = np.linalg.solve(M, [u - A2, v - A5]); la_, lo_ = lcc_inv(lc, np.array([x]), np.array([y])); g.append([float(np.ravel(la_)[0]), float(np.ravel(lo_)[0])])
        g = np.array(g)
        la0, la1, lo0, lo1 = g[:, 0].min(), g[:, 0].max(), g[:, 1].min(), g[:, 1].max(); h = max(0.3, (la1 - la0) / 3)
        p2 = [round((la0 + la1) / 2 + h, 2), round((la0 + la1) / 2 - h, 2), round((la0 + la1) / 2, 2), round((lo0 + lo1) / 2, 2)]
        if la1 - la0 < 15 and lo1 - lo0 < 20 and max(abs(p2[i_] - proj[i_]) for i_ in range(4)) > 0.1:
            proj1 = proj; proj = p2; PROJ = tuple(proj); _PREP.clear()
            print(f'projection (refit on the panels): LCC parallels {proj[0]}, {proj[1]}, origin {proj[2]}, {proj[3]}', file=sys.stderr)
            p2s = fit_panels()
            sc_ = lambda P_: (len(P_), -sum(q['_s'] for q in P_))
            if sc_(p2s) >= sc_(panels): panels = p2s
            else: proj = proj1; PROJ = tuple(proj); print('projection refit located fewer panels: keeping the first pass', file=sys.stderr)
    lv = [float(x) for x in a.levels.split(',')] if a.levels else ([0.5, 2.0] if a.kind == 'VNC' else [0.5, 2.5])
    out = dict(sheet=a.sheet, name=a.name, kind=a.kind, page=[round(page.rect.width, 2), round(page.rect.height, 2)], re=a.match, levels=lv)
    if proj: out['proj'] = proj
    for q in panels: q.pop('_s', None)
    out['panels'] = panels
    print(json.dumps(out, indent=1))

if __name__ == '__main__':
    main()
