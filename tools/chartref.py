#!/usr/bin/env python3
"""Georeference an Airservices VTC/VNC PDF for the app's chart underlay -> an entry for tools/charts.json.

The charts themselves are never stored in the repo or the site: pilots import their own copy on the phone, and the app
only needs these numbers to place it. Model per chart panel:

    chart pt (u, v) = similarity( LCC(lat, lon) )
    LCC: spherical Lambert conformal conic, standard parallels 36S/39S, origin 37.8S 145E (same as the app's lccFwd)
    similarity with reflection (PDF y points down): u = a*x + b*y + c ; v = b*x - a*y + d

Fit:
 1. coarse: place-name labels on the chart matched to ERSA VFR waypoints / aerodromes (RANSAC);
 2. fine: chamfer match of the chart's printed controlled-airspace boundaries (the cyan C/D/A lines) against the DAH
    geometry. On the Melbourne VTC/VNC the median misfit is 0.5 pt (about 45 m on the VTC, 90 m on the VNC).
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

class LCC:
    def __init__(s, lat1=-36, lat2=-39, lat0=-37.8, lon0=145.0):
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

def frames(D):
    """closed black ~1 pt frames longer than 3000 pt = map neatlines"""
    res = []
    for sc, fc, w, pts in D:
        if sc and max(sc) < 0.2 and w and 0.9 < w < 1.1:
            L = sum(math.hypot(pts[i+1][0]-pts[i][0], pts[i+1][1]-pts[i][1]) for i in range(len(pts) - 1))
            if L > 3000 and math.hypot(pts[0][0]-pts[-1][0], pts[0][1]-pts[-1][1]) < 2:
                u = []
                for q in pts:
                    q = (round(q[0]), round(q[1]))
                    if not u or q != u[-1]: u.append(q)
                res.append(u[:-1] if u[0] == u[-1] else u)
    return res

def coarse_pairs(lines, data, poly):
    from matplotlib.path import Path as MPath
    cand = {}
    for c, n, la, lo in data['vw']: cand.setdefault(n.upper(), []).append((la, lo))
    for a in data['ap']: cand.setdefault(a['n'].upper().split('/')[-1], []).append((a['la'], a['lo']))
    pp = MPath(poly); lc = LCC(); pairs = []
    for t, b in lines:
        k = t.upper(); cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
        if k in cand and len(cand[k]) == 1 and pp.contains_point((cx, cy)):
            x, y = lc.fwd(*cand[k][0]); pairs.append((float(x), float(y), cx, cy))
    return pairs

def coarse(lines, data, poly):
    from matplotlib.path import Path as MPath  # noqa
    cand = {}
    for c, n, la, lo in data['vw']: cand.setdefault(n.upper(), []).append((la, lo))
    for a in data['ap']: cand.setdefault(a['n'].upper().split('/')[-1], []).append((a['la'], a['lo']))
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
        inl = [q for q in pairs if math.hypot(*np.subtract(sim_apply(p, q[0], q[1]), (q[2], q[3]))) < 1.2 * sc]
        if not best or len(inl) > len(best[1]): best = (p, inl)
    return sim_fit(*zip(*[(q[0], q[1], q[2], q[3]) for q in best[1]])), len(best[1])

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
    polys = [[(x0, y0), (x1, y0), (x1, y1), (x0, y1)] for x0, y0, x1, y1 in (map(float, s.split(',')) for s in a.panel)] if a.panel else frames(D)
    if not polys: polys = [[(0, 0), (page.rect.width, 0), (page.rect.width, page.rect.height), (0, page.rect.height)]]
    panels = []; first = None
    for k, poly in enumerate(polys):
        try: p0, n = coarse(lines, data, poly)
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
        best = None
        for t0 in tries:
            r = refine(D, dah, t0, poly, (page.rect.width, page.rect.height))
            if best is None or r[1] < best[1]: best = r
        p, med, npts = best
        if first is None: first = p
        print(f'panel {k}: {n} label matches, {npts} boundary samples, median misfit {med:.2f} pt, {math.hypot(p[0], p[1]):.2f} pt/NM', file=sys.stderr)
        panels.append(dict(id=f'{a.sheet}-{k}' if k else a.sheet, name=a.name if not k else f'{a.name} (panel {k + 1})', order=k + (0 if a.kind == 'VNC' else 1),
                           sim=[round(float(v), 6) for v in p], clip=[[round(x), round(y)] for x, y in poly]))
    lv = [float(x) for x in a.levels.split(',')] if a.levels else ([0.5, 2.0] if a.kind == 'VNC' else [0.5, 2.5])
    print(json.dumps(dict(sheet=a.sheet, name=a.name, kind=a.kind, page=[round(page.rect.width, 2), round(page.rect.height, 2)],
                          re=a.match, levels=lv, panels=panels), indent=1))

if __name__ == '__main__':
    main()
