#!/usr/bin/env python3
"""Georeference Airservices WAC sheets (World Aeronautical Chart, 1:1,000,000) for the app's chart underlay -> tools/charts.json.

    python wacref.py ../data/aip/WAC_3470_Melbourne_Ed._17.pdf [more WAC PDFs ...] > /tmp/wac.json
    then replace the WAC entries in charts.json with the printed array's objects, and render the tiles:
    python chartiles.py --add ../app/charts ../data/aip/WAC_*.pdf

Source of the PDFs: http://data.tmorris.net/aviation/wac/ (WAC_<number>_<name>_Ed._<n>.pdf).
The WAC PDFs are raster scans (one JPEG per strip, 1 px per pt, no text or vector layer), so chartref.py can't read them.
Instead, for each sheet:
  1. The neatline: on each side, scan in from the white margin to the first grey line pixel, at ~120 places, and robust-fit
     the side (straight meridians left and right, arcs top and bottom). The corners are where the sides meet.
  2. The corners' latitude and longitude are printed beside them; they're in SHEETS below (read off the sheets; a new sheet
     needs a line there). Some sheets run half a degree past the last labelled meridian (Melbourne to 150 deg 30', Hamilton
     to 145 deg 30'), and Albany's frame is at 31 deg 20' / 35 deg 20'.
  3. The projection is the WAC's Lambert conformal conic, standard parallels 40' inside the sheet's top and bottom edges
     (with "proj" in charts.json the app uses the same LCC). Page pt = affine(LCC), first from the corners.
  4. Refinement: every 1-degree graticule crossing inside the sheet is looked for within 25 pt of where the corner fit puts
     it (a line search along the meridian and the parallel through it), and the affine is refitted on corners + crossings.
     Typical result: rms 0.5-1 pt (50-100 m) over 8-20 points.
  5. The clip is the frame as the model draws it (12 points a side, so the curved top and bottom are followed), except where
     a sheet's frame steps (Nullarbor Plain: a tab below 32 S on the left, traced by hand in STEP).
Aerodrome rings on a WAC are often nudged for legibility (up to ~1 km), so they aren't used for the fit.
Note: Airservices charts are copyright; publishing tiles of them is the site owner's decision.
"""
import json, re, sys, os
import numpy as np, cv2, pymupdf

# sheet number -> name, frame N lat, S lat, W lon, E lon (degrees; south negative)
SHEETS = {'3351': ('Perth', -28, -32, 113.5, 120), '3353': ('Nullarbor Plain', -28, -32, 126, 132),
          '3456': ('Sydney', -32, -36, 147, 153), '3458': ('Adelaide', -32, -36, 138, 144),
          '3461': ('Esperance', -32, -36, 120, 126), '3462': ('Albany', -31 - 20 / 60, -35 - 20 / 60, 114, 120),
          '3469': ('Hamilton', -36, -40, 139, 145.5), '3470': ('Melbourne', -36, -40, 144, 150.5)}
# frames that aren't a plain quadrilateral: corners not to use (0 TL, 1 TR, 2 BR, 3 BL) and the clip's extra outline (page pt)
STEP = {'3353': dict(skip=[3], cut_x=3080, extra=[(3075, 4300), (2233, 4633), (944, 4667)])}
R_NM = 6371008.8 / 1852


def lcc(pr, la, lo):   # = lccFwdP in tools/template.html and LCC in chartref.py
    rad = np.pi / 180; p1, p2, p0 = [v * rad for v in pr[:3]]; l0 = pr[3] * rad
    n = np.log(np.cos(p1) / np.cos(p2)) / np.log(np.tan(np.pi / 4 + p2 / 2) / np.tan(np.pi / 4 + p1 / 2))
    F = np.cos(p1) * np.tan(np.pi / 4 + p1 / 2) ** n / n
    r0 = R_NM * F / np.tan(np.pi / 4 + p0 / 2) ** n; r = R_NM * F / np.tan(np.pi / 4 + np.asarray(la, float) * rad / 2) ** n
    th = n * (np.asarray(lo, float) * rad - l0)
    return r * np.sin(th), r0 - r * np.cos(th)


def ransac(t, v, deg, tol=1.5):
    t = np.asarray(t, float); v = np.asarray(v, float); best = None; rng = np.random.default_rng(1)
    for _ in range(400):
        i = rng.choice(len(t), deg + 1, replace=False); c = np.polyfit(t[i], v[i], deg); inl = np.abs(np.polyval(c, t) - v) < tol
        if best is None or inl.sum() > best.sum(): best = inl
    return np.polyfit(t[best], v[best], deg)


def neatline(img):
    """corners TL TR BR BL and the fitted sides, page pt"""
    H, W = img.shape[:2]; mx, mn = img.max(2), img.min(2)
    dark = (mx < 175) & ((mx - mn) < 45)
    small = cv2.resize(img.astype(np.uint8), (W // 4, H // 4), interpolation=cv2.INTER_AREA).astype(int)
    m = cv2.morphologyEx((small.sum(2) < 735).astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(m); k = 1 + np.argmax(st[1:, 4]); ys, xs = np.nonzero(lab == k)
    TL, TR, BR, BL = [(xs[i] * 4, ys[i] * 4) for i in [np.argmax(dx * xs + dy * ys) for dx, dy in [(-1, -1), (1, -1), (1, 1), (-1, 1)]]]
    def first(line):
        for k, (x, y) in enumerate(line):
            if 0 <= x < W and 0 <= y < H and dark[y, x]: return k
        return None
    L, R, T, B = [], [], [], []
    for y in np.linspace(max(TL[1], TR[1]) + 60, min(BL[1], BR[1]) - 60, 120).astype(int):
        xl = int(TL[0] + (BL[0] - TL[0]) * (y - TL[1]) / (BL[1] - TL[1])) - 120; xr = int(TR[0] + (BR[0] - TR[0]) * (y - TR[1]) / (BR[1] - TR[1])) + 120
        a = first([(x, y) for x in range(xl, xl + 260)]); b = first([(x, y) for x in range(xr, xr - 260, -1)])
        if a is not None: L.append((y, xl + a + .5))
        if b is not None: R.append((y, xr - b + .5))
    for x in np.linspace(max(TL[0], BL[0]) + 60, min(TR[0], BR[0]) - 60, 160).astype(int):
        yt = int(TL[1] + (TR[1] - TL[1]) * (x - TL[0]) / (TR[0] - TL[0])) - 120; yb = int(BL[1] + (BR[1] - BL[1]) * (x - BL[0]) / (BR[0] - BL[0])) + 120
        a = first([(x, y) for y in range(yt, yt + 260)]); b = first([(x, y) for y in range(yb, yb - 260, -1)])
        if a is not None: T.append((x, yt + a + .5))
        if b is not None: B.append((x, yb - b + .5))
    cl, cr = ransac(*zip(*L), 1), ransac(*zip(*R), 1); ct, cb = ransac(*zip(*T), 2), ransac(*zip(*B), 2)
    def isect(cv, ch):
        y = np.polyval(ch, np.polyval(cv, 500.0))
        for _ in range(20): x = np.polyval(cv, y); y = np.polyval(ch, x)
        return (float(x), float(y))
    return [isect(cl, ct), isect(cr, ct), isect(cr, cb), isect(cl, cb)]


def crossings(img, P, N, S, Wl, E):
    """1-degree graticule crossings found near P(lat, lon): [(lat, lon, u, v)]"""
    mx, mn = img.max(2), img.min(2); dk = ((mx < 150) & ((mx - mn) < 35)).astype(float); out = []
    for la in np.arange(np.ceil(S), np.floor(N) + 1):
        for lo in np.arange(np.ceil(Wl), np.floor(E) + 1):
            if not (S + .05 < la < N - .05 and Wl + .05 < lo < E - .05): continue
            c = np.array(P(la, lo)); dm = np.array(P(la + .05, lo)) - P(la - .05, lo); dm /= np.linalg.norm(dm)
            dp = np.array(P(la, lo + .05)) - P(la, lo - .05); dp /= np.linalg.norm(dp)
            t = np.arange(-60, 61, 1.0); t = t[np.abs(t) > 6]
            def score(o, along, across):
                q = c[None, :] + o * across[None, :] + t[:, None] * along[None, :]; xi = np.round(q[:, 0]).astype(int); yi = np.round(q[:, 1]).astype(int)
                ok = (xi >= 0) & (yi >= 0) & (xi < dk.shape[1]) & (yi < dk.shape[0]); return dk[yi[ok], xi[ok]].mean()
            os_ = np.arange(-25, 25.5, .5); sm = np.array([score(o, dm, dp) for o in os_]); sp = np.array([score(o, dp, dm) for o in os_])
            if sm.max() < .6 or sp.max() < .6: continue
            q = c + os_[sm.argmax()] * dp + os_[sp.argmax()] * dm; out.append((la, lo, q[0], q[1]))
    return out


def fit(pr, pts):
    P = np.array(pts, float); x, y = lcc(pr, P[:, 0], P[:, 1]); M = np.c_[x, y, np.ones(len(P))]
    ax = np.linalg.lstsq(M, P[:, 2], rcond=None)[0]; ay = np.linalg.lstsq(M, P[:, 3], rcond=None)[0]
    return ax, ay, np.hypot(M @ ax - P[:, 2], M @ ay - P[:, 3])


def sheet(path):
    num = re.search(r'WAC[ _-]?(\d{4})', os.path.basename(path), re.I).group(1); name, N, S, Wl, E = SHEETS[num]; st = STEP.get(num, {})
    page = pymupdf.open(path)[0]; pix = page.get_pixmap(matrix=pymupdf.Matrix(1, 1))
    img = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width, 3).astype(int)
    C = neatline(img); ll = [(N, Wl), (N, E), (S, E), (S, Wl)]; use = [i for i in range(4) if i not in st.get('skip', [])]
    pr = [round(N - 2 / 3, 4), round(S + 2 / 3, 4), (N + S) / 2, (Wl + E) / 2]
    corners = [(*ll[i], *C[i]) for i in use]
    ax, ay, _ = fit(pr, corners)
    P = lambda la, lo: (ax[0] * lcc(pr, la, lo)[0] + ax[1] * lcc(pr, la, lo)[1] + ax[2], ay[0] * lcc(pr, la, lo)[0] + ay[1] * lcc(pr, la, lo)[1] + ay[2])
    gx = crossings(img, P, N, S, Wl, E)
    ax, ay, r = fit(pr, corners + gx)
    P = lambda la, lo: (ax[0] * lcc(pr, la, lo)[0] + ax[1] * lcc(pr, la, lo)[1] + ax[2], ay[0] * lcc(pr, la, lo)[0] + ay[1] * lcc(pr, la, lo)[1] + ay[2])
    t = np.linspace(0, 1, 13); seg = lambda la, lo: list(zip(*P(la, lo)))
    top = seg(np.full(13, N), Wl + (E - Wl) * t); right = seg(N + (S - N) * t, np.full(13, E))
    bot = seg(np.full(13, S), E + (Wl - E) * t); left = seg(S + (N - S) * t, np.full(13, Wl))
    if st.get('extra'): bot = [q for q in seg(np.full(25, S), np.linspace(E, Wl, 25)) if q[0] > st['cut_x']] + st['extra']
    clip = [[round(float(x), 1), round(float(y), 1)] for x, y in top + right[1:] + (bot[1:] if not st.get('extra') else bot) + left[1:-1]]
    # similarity for the record (the app uses aff): u = a x + b y + c, v = -a y + b x + d
    X, Y = lcc(pr, [q[0] for q in ll], [q[1] for q in ll]); U, V = P(np.array([q[0] for q in ll]), np.array([q[1] for q in ll]))
    A = np.r_[np.c_[X, Y, np.ones(4), np.zeros(4)], np.c_[-Y, X, np.zeros(4), np.ones(4)]]; sim = np.linalg.lstsq(A, np.r_[U, V], rcond=None)[0]
    print(f'{name} WAC: {len(corners)} corners + {len(gx)} graticule crossings, rms {np.sqrt(np.mean(r ** 2)):.2f} pt, max {r.max():.2f} pt '
          f'(1 pt = {1852 / np.hypot(ax[0], ax[1]):.0f} m)', file=sys.stderr)
    sid = f'WAC-{num}'; nm = f'{name} WAC'
    return dict(sheet=sid, name=nm, kind='WAC', page=[round(page.rect.width, 2), round(page.rect.height, 2)], re=f'wac[ _-]?{num}',
                levels=[0.25, 1.0], proj=pr, panels=[dict(id=sid, name=nm, order=-1, sim=[round(float(v), 6) for v in sim],
                                                          aff=[round(float(v), 6) for v in [*ax, *ay]], clip=clip)])


if __name__ == '__main__':
    print(json.dumps([sheet(p) for p in sys.argv[1:]], indent=1))
