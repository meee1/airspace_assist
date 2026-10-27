"""ABS Urban Centres and Localities (ASGS 2021, CC BY 4.0) -> compact polygons for the app's populous-area rule.

CASR 91.265 needs 1,000 ft over a "populous area", which CASA doesn't map. The ABS urban centres and localities are the
closest official proxy: Major Urban, Other Urban (1,000+ people) and Bounded Localities (200-999). Rural Balance is
left out. Download UCL_2021_AUST_GDA2020_SHP.zip from the ABS digital boundary files page and unzip it into data/abs/.

load(path) -> [[name, sos, [minLa,maxLa,minLo,maxLo] x1e4, [ring, ...]]], each ring a flat [la,lo,la,lo...] x1e4.
Holes are dropped (the area is treated as filled, which errs on the high side). Needs `pip install pyshp`.
"""
import shapefile

KEEP = {'Major Urban': 'M', 'Other Urban': 'U', 'Bounded Locality': 'L'}

def _dp(pts, tol):
    """Douglas-Peucker on [(x,y)], iterative."""
    if len(pts) < 4: return pts
    keep = [False] * len(pts); keep[0] = keep[-1] = True; stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop(); (x1, y1), (x2, y2) = pts[a], pts[b]; dx, dy = x2 - x1, y2 - y1; L = (dx * dx + dy * dy) ** .5
        best, bi = -1, -1
        for i in range(a + 1, b):
            x, y = pts[i]
            d = abs(dy * (x - x1) - dx * (y - y1)) / L if L else ((x - x1) ** 2 + (y - y1) ** 2) ** .5
            if d > best: best, bi = d, i
        if best > tol: keep[bi] = True; stack += [(a, bi), (bi, b)]
    return [p for p, k in zip(pts, keep) if k]

def _area(r): return sum(r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1] for i in range(len(r) - 1)) / 2

def load(path, tol=0.0003):
    sf = shapefile.Reader(path); out = []
    for sr in sf.iterShapeRecords():
        rec, shp = sr.record.as_dict(), sr.shape
        sos = KEEP.get(rec.get('SOS_NAME21'))
        if not sos or not shp.points: continue
        parts = list(shp.parts) + [len(shp.points)]; rings = []
        for i in range(len(parts) - 1):
            ring = shp.points[parts[i]:parts[i + 1]]                       # (lon, lat); outer rings are clockwise
            if len(ring) < 4 or _area(ring) > 0: continue                  # counter-clockwise = hole: dropped
            s = _dp([tuple(p) for p in ring], tol)
            if len(s) < 4 or abs(_area(s)) < 1e-6: continue                # < ~0.01 km2
            rings.append([v for lo, la in s for v in (round(la * 1e4), round(lo * 1e4))])
        if not rings: continue
        las = [r[i] for r in rings for i in range(0, len(r), 2)]; los = [r[i] for r in rings for i in range(1, len(r), 2)]
        out.append([rec['UCL_NAME21'], sos, [min(las), max(las), min(los), max(los)], rings])
    return out

if __name__ == '__main__':
    import sys, json
    u = load(sys.argv[1]); print(len(u), 'areas', sum(len(r) for x in u for r in x[3]) // 2, 'points', len(json.dumps(u, separators=(',', ':'))) // 1024, 'KB')
