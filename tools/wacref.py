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
          '3469': ('Hamilton', -36, -40, 139, 145.5), '3470': ('Melbourne', -36, -40, 144, 150.5),
          '3097': ('Torres Strait', -8, -12, 138, 144), '3098': ('Cape Wessel', -8, -12, 132, 138), '3099': ('Melville Island', -8, -12, 126, 132),
          '3108': ('Brunswick Bay', -12, -16, 123, 129), '3109': ('Darwin', -12, -16, 129, 135), '3110': ('Groote Eylandt', -12, -16, 135, 141),
          '3112': ('Cooktown', -12, -16, 141, 147), '3219': ('Townsville', -16, -20, 144, 150), '3220': ('Normanton', -16, -20, 138, 144),
          '3221': ('Newcastle Waters', -16, -20, 132, 138), '3222': ('Halls Creek', -16, -20, 126, 132), '3223': ('Broome', -16, -20, 120, 126),
          '3229': ('Hamersley Range', -20, -24, None, 120), '3230': ('Oakover River', -20, -24, 120, 126), '3231': ('Lake Mackay', -20, -24, 126, 132),
          '3232': ('Alice Springs', -20, -24, 132, 138), '3233': ('Cloncurry', -20, -24, 138, 144), '3234': ('Clermont', -20, -24, 144, 150),
          '3235': ('Rockhampton', -20, -24, 147, 153), '3340': ('Brisbane', -24, -28, 148, 154), '3341': ('Charleville', -24, -28, 144, 150),
          '3342': ('Cooper Creek', -24, -28, 138, 144), '3343': ('Oodnadatta', -24, -28, 132, 138), '3344': ('Petermann Ranges', -24, -28, 126, 132),
          '3345': ('Wiluna', -24, -28, 120, 126), '3346': ('Meekatharra', -24, -28, None, 120), '3352': ('Kalgoorlie', -28, -32, 120, 126),
          '3354': ('Tarcoola', -28, -32, 132, 138), '3355': ('Broken Hill', -28, -32, 138, 144), '3356': ('Bourke', -28, -32, 144, 150),
          '3357': ('Armidale', -28, -32, 148, 154), '3457': ('Canberra', -32, -36, 144, 150), '3459': ('Port Augusta', -32, -36, 132, 139),
          '3556': ('Tasmania', -40, -43.9, 144, 150)}
# None: that edge's label isn't printed by its corner (Hamersley Range, Meekatharra): it's found from the fit (east corners + graticule)
# frames that aren't a plain quadrilateral: corners not to use (0 TL, 1 TR, 2 BR, 3 BL) and the clip's extra outline (page pt)
STEP = {'3353': dict(skip=[3], cut_x=3080, extra=[(3075, 4300), (2233, 4633), (944, 4667)]),
        # frames with tabs (islands, coast beyond the edge): the clip is the drawn map area (maskclip), the fit uses the main frame
        '3229': dict(mask=True), '3346': dict(mask=True), '3459': dict(mask=True), '3556': dict(mask=True)}
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
    small = cv2.resize(img, (W // 4, H // 4), interpolation=cv2.INTER_AREA).astype(np.int32)
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
    mx, mn = img.max(2), img.min(2); dk = (mx < 150) & ((mx - mn) < 35); out = []   # bool: .mean() still gives the dark fraction
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


def maskclip(img):
    """the map area as drawn (largest non-white region, holes ignored), simplified: for frames with tabs and steps"""
    small = cv2.resize(img, (img.shape[1] // 2, img.shape[0] // 2), interpolation=cv2.INTER_AREA).astype(np.int32)
    m = (small.sum(2) < 735).astype(np.uint8)
    m = cv2.morphologyEx(cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8)), cv2.MORPH_OPEN, np.ones((9, 9), np.uint8))
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE); c = max(cs, key=cv2.contourArea)
    c = cv2.approxPolyDP(c, 2.0, True)[:, 0, :]
    return [[round(float(x) * 2, 1), round(float(y) * 2, 1)] for x, y in c]


def affP(ax, ay, pr):
    def P(la, lo):
        x, y = lcc(pr, la, lo); return (ax[0] * x + ax[1] * y + ax[2], ay[0] * x + ay[1] * y + ay[2])
    return P


def lon_at(P, lat, u, lo0, lo1):
    """longitude where the parallel `lat` reaches page x = u (bisection)"""
    a, b = lo0, lo1; fa = P(lat, a)[0] - u
    for _ in range(60):
        m = (a + b) / 2; fm = P(lat, m)[0] - u
        if (fm < 0) == (fa < 0): a, fa = m, fm
        else: b = m
    return (a + b) / 2


RMS_WARN, MIN_CROSS, MIN_LINE = 3.0, 6, 4.0   # pt; graticule crossings on a mainland sheet; island grid line contrast (peak / median)


def warn(name, msgs):
    for m in msgs: print(f'WARNING {name}: {m} - check this sheet on the map before publishing it', file=sys.stderr)


def sheet(path):
    base = os.path.basename(path); num = re.search(r'WAC[ _-]?(\d{4})', base, re.I).group(1)
    key = num if num != '1919' else '1919-' + re.search(r'WAC[ _-]?1919[ _-]+([A-Za-z]+)', base).group(1).upper()
    name, N, S, Wl, E = SHEETS[key]; st = STEP.get(key, {})
    page = pymupdf.open(path)[0]; pix = page.get_pixmap(matrix=pymupdf.Matrix(1, 1))
    img = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width, 3)   # uint8 (mx - mn can't wrap: max >= min)
    C = neatline(img); use = [i for i in range(4) if i not in st.get('skip', [])]
    est = Wl is None   # west edge not printed in a readable place: found from the fit
    if est:
        use = [i for i in use if i in (1, 2)]; Wl = E - 6.25
    for it in range(3 if est else 1):
        pr = [round(N - 2 / 3, 4), round(S + 2 / 3, 4), (N + S) / 2, round((Wl + E) / 2, 4)]
        ll = [(N, Wl), (N, E), (S, E), (S, Wl)]; corners = [(*ll[i], *C[i]) for i in use]
        if len(corners) >= 3: ax, ay, _ = fit(pr, corners)
        else:   # two corners: similarity (conformal) through them
            X, Y = lcc(pr, [q[0] for q in corners], [q[1] for q in corners]); U = [q[2] for q in corners]; V = [q[3] for q in corners]
            A = np.r_[np.c_[X, Y, np.ones(2), np.zeros(2)], np.c_[-Y, X, np.zeros(2), np.ones(2)]]   # u = a x + b y + c, v = b x - a y + d
            a, b, c, d = np.linalg.solve(A, np.r_[U, V]); ax, ay = np.array([a, b, c]), np.array([b, -a, d])
        P = affP(ax, ay, pr)
        gx = crossings(img, P, N, S, Wl, E)
        ax, ay, r = fit(pr, corners + gx)
        for _ in range(3):   # drop crossings that don't fit (a road or a river taken for the line), refit
            bad = [i for i in range(len(corners), len(r)) if r[i] > max(3.0, 3 * np.median(r))]
            if not bad: break
            gx = [q for k, q in enumerate(gx) if k + len(corners) not in bad]; ax, ay, r = fit(pr, corners + gx)
        # enough crossings across the sheet: fit on them alone (on some scans the corners are a few pt off the graticule)
        if len(gx) >= 6 and len({q[0] for q in gx}) >= 2 and len({q[1] for q in gx}) >= 3:
            ax, ay, r = fit(pr, gx); used = 'crossings'
        else: used = 'corners + crossings'
        P = affP(ax, ay, pr)
        if est: Wl = round(lon_at(P, N, C[0][0], E - 8, E - 4) * 60) / 60
    ll = [(N, Wl), (N, E), (S, E), (S, Wl)]
    if st.get('mask'): clip = maskclip(img)
    else:
        t = np.linspace(0, 1, 13); seg = lambda la, lo: list(zip(*P(la, lo)))
        top = seg(np.full(13, N), Wl + (E - Wl) * t); right = seg(N + (S - N) * t, np.full(13, E))
        bot = seg(np.full(13, S), E + (Wl - E) * t); left = seg(S + (N - S) * t, np.full(13, Wl))
        if st.get('extra'): bot = [q for q in seg(np.full(25, S), np.linspace(E, Wl, 25)) if q[0] > st['cut_x']] + st['extra']
        clip = [[round(float(x), 1), round(float(y), 1)] for x, y in top + right[1:] + (bot[1:] if not st.get('extra') else bot) + left[1:-1]]
    # similarity for the record (the app uses aff): u = a x + b y + c, v = -a y + b x + d
    X, Y = lcc(pr, [q[0] for q in ll], [q[1] for q in ll]); U, V = P(np.array([q[0] for q in ll]), np.array([q[1] for q in ll]))
    A = np.r_[np.c_[X, Y, np.ones(4), np.zeros(4)], np.c_[-Y, X, np.zeros(4), np.ones(4)]]; sim = np.linalg.lstsq(A, np.r_[U, V], rcond=None)[0]
    sx, sy = np.hypot(ax[0], ay[0]), np.hypot(ax[1], ay[1])
    print(f'{name} WAC: fit on {used}: {len(corners)} corners, {len(gx)} graticule crossings, rms {np.sqrt(np.mean(r ** 2)):.2f} pt, max {r.max():.2f} pt, '
          f'x/y scale {sx / sy:.4f} (1 pt = {1852 / sx:.0f} m)' + (f', west edge {int(-Wl) if Wl < 0 else int(Wl)} deg {round(abs(Wl) % 1 * 60)}\'' if est else ''), file=sys.stderr)
    rms = float(np.sqrt(np.mean(r ** 2)))
    warn(f'{name} WAC', ([f'fit rms {rms:.2f} pt is over {RMS_WARN} pt'] if rms > RMS_WARN else []) +
         ([f'only {len(gx)} graticule crossings found (expected {MIN_CROSS} or more), the fit leans on the corners'] if len(gx) < MIN_CROSS else []) +
         ([f'only {len(corners)} usable corners'] if len(corners) < 3 and not est else []))
    sid = 'WAC-' + key; nm = f'{name} WAC'
    return dict(sheet=sid, name=nm, kind='WAC', page=[round(page.rect.width, 2), round(page.rect.height, 2)], re=f'wac[ _-]?{num}' + ('' if num != '1919' else '[ _-]+' + key[5:].lower()),
                levels=[0.25, 1.0], proj=pr, panels=[dict(id=sid, name=nm, order=-1, sim=[round(float(v), 6) for v in sim],
                                                          aff=[round(float(v), 6) for v in [*ax, *ay]], clip=clip)])


# ---- the four island sheets (all numbered 1919): large-scale plans with a 5' graticule, no corner labels ----
# Lines as (value, approximate page pt); the inset (North Keeling, Balls Pyramid) is cut out of the main panel and placed as
# its own panel from its one graticule crossing, at its printed scale relative to the main map.
ISLANDS = {
    'CHRISTMAS': dict(name='Christmas Island', lon=[(105 + 35 / 60, 875), (105 + 40 / 60, 1677)], lat=[(-(10 + 25 / 60), 890), (-(10.5), 1692), (-(10 + 35 / 60), 2500)]),
    'COCOS': dict(name='Cocos (Keeling) Islands', lon=[(96 + 50 / 60, 765), (96 + 55 / 60, 1567)], lat=[(-12, 570), (-(12 + 5 / 60), 1377), (-(12 + 10 / 60), 2180), (-12.25, 2982)],
                  inset=dict(name='North Keeling Island', rect=(395, 387, 1042, 1025), lat=(-(11 + 50 / 60), 705), lon=(96 + 50 / 60, 900), scale=1.0)),
    'LORD': dict(name='Lord Howe Island', lon=[(159 + 5 / 60, 1112)], lat=[(-31.5, 537), (-(31 + 35 / 60), 1860)],
                 inset=dict(name='Balls Pyramid', rect=(1350, 1805, 2090, 2265), lat=(-(31 + 47 / 60), 2168), lon=(159.25, 1718), scale=0.5, ticks=True)),   # edge ticks only: positions as read
    'NORFOLK': dict(name='Norfolk Island', lon=[(167 + 55 / 60, 680), (168, 2037)], lat=[(-29, 425), (-(29 + 5 / 60), 1787)]),
}


def _line(dk, axis, p0, lo, hi, R=30):
    """refine a graticule line near page coordinate p0 (axis 'x': vertical line, else horizontal), over lo..hi along it"""
    vs = [(dk[int(lo):int(hi), p].mean() if axis == 'x' else dk[p, int(lo):int(hi)].mean(), p) for p in range(int(p0 - R), int(p0 + R) + 1)]
    best = max(vs)
    return best[1] + .5, best[0] / (np.median([v for v, _ in vs]) + .005)   # position, and how far the line stands out from its surroundings


def island(path):
    key = re.search(r'WAC[ _-]?1919[ _-]+([A-Za-z]+)', os.path.basename(path)).group(1).upper(); I = ISLANDS[key]
    page = pymupdf.open(path)[0]; pix = page.get_pixmap(matrix=pymupdf.Matrix(1, 1))
    img = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width, 3); mx, mn = img.max(2), img.min(2)   # uint8: mx - mn can't wrap
    dk = (mx < 150) & ((mx - mn) < 40)
    ins = I.get('inset'); rx = ins['rect'] if ins else None
    ys = [y for _, y in I['lat']]; xs = [x for _, x in I['lon']]
    LX = [(v, _line(dk, 'x', x, min(ys) - 200, max(ys) + 200)) for v, x in I['lon']]
    LY = [(v, _line(dk, 'y', y, min(xs) - 200 if len(xs) > 1 else xs[0] - 600, max(xs) + 200 if len(xs) > 1 else xs[0] + 600)) for v, y in I['lat']]
    X = [(v, q[0]) for v, q in LX]; Y = [(v, q[0]) for v, q in LY]
    weak = [f"{'meridian' if a == 'x' else 'parallel'} {v:.4f} (contrast {q[1]:.1f}, found {q[0] - x0:+.1f} pt from where it was read)"
            for a, L, I0 in (('x', LX, I['lon']), ('y', LY, I['lat'])) for (v, q), (_, x0) in zip(L, I0) if q[1] < MIN_LINE or abs(q[0] - x0) > 25]
    pts = [(la, lo, x, y) for lo, x in X for la, y in Y]
    lac = np.mean([q[0] for q in pts]); loc = np.mean([q[1] for q in pts]); pr = [round(lac + .2, 4), round(lac - .2, 4), round(lac, 4), round(loc, 4)]
    if len(X) >= 2: ax, ay, r = fit(pr, pts)
    else:   # one meridian: similarity through the crossings (the plans are conformal)
        P_ = np.array(pts, float); x, y = lcc(pr, P_[:, 0], P_[:, 1]); n = len(P_)
        A = np.r_[np.c_[x, y, np.ones(n), np.zeros(n)], np.c_[-y, x, np.zeros(n), np.ones(n)]]
        a, b, c, d = np.linalg.lstsq(A, np.r_[P_[:, 2], P_[:, 3]], rcond=None)[0]; ax, ay = np.array([a, b, c]), np.array([b, -a, d])
        r = np.hypot(np.c_[x, y, np.ones(n)] @ ax - P_[:, 2], np.c_[x, y, np.ones(n)] @ ay - P_[:, 3])
    outer = maskclip(img)
    panels = []
    if ins:   # cut the inset box out of the main panel (a bridge to the box, round it the other way, back)
        x0, y0, x1, y1 = rx; area = sum(outer[i][0] * outer[i - 1][1] - outer[i - 1][0] * outer[i][1] for i in range(len(outer)))
        box = [[x0, y0], [x0, y1], [x1, y1], [x1, y0]] if area > 0 else [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
        k = min(range(len(outer)), key=lambda i: (outer[i][0] - x0) ** 2 + (outer[i][1] - y0) ** 2)
        outer = outer[:k + 1] + box + [box[0], outer[k]] + outer[k + 1:]
        # the inset: its crossing, the main map's linear part times the scale ratio
        la, lo = ins['lat'][0], ins['lon'][0]
        u, v = (ins['lon'][1], ins['lat'][1]) if ins.get('ticks') else (_line(dk, 'x', ins['lon'][1], y0 + 15, y1 - 15)[0], _line(dk, 'y', ins['lat'][1], x0 + 15, x1 - 15)[0])
        prI = [round(la + .2, 4), round(la - .2, 4), round(la, 4), round(lo, 4)]; xi, yi = lcc(prI, la, lo); k_ = ins['scale']
        axI = np.array([ax[0] * k_, ax[1] * k_, 0.0]); ayI = np.array([ay[0] * k_, ay[1] * k_, 0.0]); axI[2] = u - axI[0] * xi - axI[1] * yi; ayI[2] = v - ayI[0] * xi - ayI[1] * yi
        sid = f'WAC-1919-{key}-INSET'
        panels.append(dict(id=sid, name=ins['name'], order=-1, proj=prI, aff=[round(float(q), 6) for q in [*axI, *ayI]],
                           clip=[[x0 + 6, y0 + 6], [x1 - 6, y0 + 6], [x1 - 6, y1 - 6], [x0 + 6, y1 - 6]]))
    sid = f'WAC-1919-{key}'; nm = I['name'] + ' WAC'
    print(f"{nm}: {len(pts)} graticule crossings, rms {np.sqrt(np.mean(np.square(r))):.2f} pt (1 pt = {1852 / np.hypot(ax[0], ay[0]):.0f} m)" + (f", inset {ins['name']}" if ins else ''), file=sys.stderr)
    rms = float(np.sqrt(np.mean(np.square(r))))
    warn(nm, ([f'fit rms {rms:.2f} pt is over {RMS_WARN} pt'] if rms > RMS_WARN else []) + [f'weak grid line: {w}' for w in weak])
    main = dict(id=sid, name=nm, order=-1, aff=[round(float(q), 6) for q in [*ax, *ay]], clip=outer)
    return dict(sheet=sid, name=nm, kind='WAC', page=[round(page.rect.width, 2), round(page.rect.height, 2)], re=f'wac[ _-]?1919[ _-]+{key.lower()}',
                levels=[0.5, 1.0], proj=pr, panels=[main] + panels)


if __name__ == '__main__':
    print(json.dumps([island(p) if re.search(r'WAC[ _-]?1919', os.path.basename(p)) else sheet(p) for p in sys.argv[1:]], indent=1))
