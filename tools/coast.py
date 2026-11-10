#!/usr/bin/env python3
"""Coastline tiles for the app's coast legs (follow the coast a set distance off the shore, in the flight plan).

Source: Geoscience Australia, GEODATA COAST 100K 2004 (https://pid.geoscience.gov.au/dataset/ga/61395), the national
land polygons (australia/cstauscd_r: mainland and islands; coastline at Mean High Water). Licence CC BY 4.0,
(C) Commonwealth of Australia (Geoscience Australia) 2004. Download 61395_shp.zip (22 MB) from that page.

  python3 tools/coast.py 61395_shp.zip               -> app/coast/index.json + one file per coastal 1° tile
  python3 tools/coast.py 61395_shp.zip --tol 40 --out app/coast
  python3 tools/coast.py --rings coast/vic_land.json  (testing: rings already extracted, as tools/coastroute.py uses)

The land is simplified (Douglas-Peucker, --tol metres, default 25: about a quarter of the app's smallest offset,
300 ft; 60 m makes the tiles about a third smaller), cut into 1° tiles and rounded to 1e-4° (about 10 m). Tiles that are all land or all sea get no file: the index
lists the coastal tiles (with a file) and the all-land ones; anything else is sea.

Tile file <S38E144>.json: {"p": [[ring, hole, ...], ...]} per polygon; a ring is [lon0, lat0, dlon, dlat, ...] in 1e-4°
(first point absolute, the rest deltas), closed implicitly. index.json: {v, src, tol, built, n, c: [coastal tiles],
l: [all-land tiles], kb}. The app draws the polygons of the tiles it needs onto a grid; tile edges vanish in the fill.
"""
import argparse, io, json, math, os, struct, sys, time, zipfile
from shapely.geometry import Polygon, MultiPolygon, box
from shapely.ops import unary_union
from shapely.validation import make_valid
from shapely import STRtree

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
SRC = ('Geoscience Australia, GEODATA COAST 100K 2004 (pid.geoscience.gov.au/dataset/ga/61395), CC BY 4.0, '
       '(C) Commonwealth of Australia (Geoscience Australia) 2004')

def tile_name(la0, lo0): return f"{'S' if la0 < 0 else 'N'}{abs(la0):02d}{'W' if lo0 < 0 else 'E'}{abs(lo0):03d}"   # SW corner, as the terrain tiles

def read_shp(shp, dbf):
    """Polygons (type 5) from a shapefile and FEAT_CODE from its .dbf -> [(feat, [ring, ...])], rings [(lon, lat), ...]."""
    d = dbf; n = struct.unpack('<I', d[4:8])[0]; hl, rl = struct.unpack('<HH', d[8:12]); fields = []; off = 1
    for o in range(32, hl - 1, 32):
        name = d[o:o + 11].split(b'\0')[0].decode(); ln = d[o + 16]; fields.append((name, off, ln)); off += ln
    fo = next((o, l) for nm, o, l in fields if nm == 'FEAT_CODE')
    feats = [d[hl + i * rl + fo[0]: hl + i * rl + fo[0] + fo[1]].decode('latin1').strip() for i in range(n)]
    out = []; p = 100; i = 0
    while p < len(shp):
        ln = struct.unpack('>i', shp[p + 4:p + 8])[0] * 2; st = struct.unpack('<i', shp[p + 8:p + 12])[0]
        if st == 5:
            np_, npt = struct.unpack('<ii', shp[p + 44:p + 52]); parts = list(struct.unpack(f'<{np_}i', shp[p + 52:p + 52 + 4 * np_])) + [npt]
            b = p + 52 + 4 * np_; xy = struct.unpack(f'<{2 * npt}d', shp[b:b + 16 * npt])
            out.append((feats[i], [[(xy[2 * j], xy[2 * j + 1]) for j in range(parts[k], parts[k + 1])] for k in range(np_)]))
        i += 1; p += 8 + ln
    return out

def land_from_zip(path):
    z = zipfile.ZipFile(path); base = 'australia/cstauscd_r'
    recs = read_shp(z.read(base + '.shp'), z.read(base + '.dbf'))
    polys = []
    for feat, rings in recs:
        if feat == 'sea': continue   # the sea polygon(s): everything else is land (mainland, island)
        # outlines and holes (lakes, lagoons; NSW's hole is the ACT) wind opposite ways. The shapefile spec says outlines are
        # clockwise, but this file has them anticlockwise, so take the direction of the largest ring as the outlines'
        sg = 1 if ring_area(max(rings, key=lambda r: abs(ring_area(r)))) > 0 else -1
        outer = [r for r in rings if ring_area(r) * sg > 0]; holes = [r for r in rings if ring_area(r) * sg < 0]
        for o in outer: polys.append(make_valid(Polygon(o, [h for h in holes if Polygon(o).contains(Polygon(h).representative_point())])))
    return polys

def ring_area(r):   # signed (shoelace): negative = clockwise
    return sum(r[i][0] * r[i - 1][1] - r[i - 1][0] * r[i][1] for i in range(len(r))) / 2

def land_from_rings(path):
    return [make_valid(Polygon([tuple(p) for p in g['r']])) for g in json.load(open(path))['rings'] if len(g['r']) >= 3]

def enc(ring):
    pts = [(round(x * 1e4), round(y * 1e4)) for x, y in ring]
    if len(pts) > 1 and pts[0] == pts[-1]: pts = pts[:-1]
    flat = []; px = py = 0
    for k, (x, y) in enumerate(pts):
        if k and (x, y) == (px, py): continue
        flat += [x, y] if not flat else [x - px, y - py]; px, py = x, y
    return flat if len(flat) >= 6 else None

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('zip', nargs='?'); ap.add_argument('--rings')
    ap.add_argument('--tol', type=float, default=25.0, help='simplification, metres'); ap.add_argument('--out', default=os.path.join(ROOT, 'app', 'coast'))
    o = ap.parse_args(); t0 = time.time()
    polys = land_from_rings(o.rings) if o.rings else land_from_zip(o.zip) if o.zip else sys.exit(__doc__)
    print(f'{len(polys)} land polygons, {sum(len(p.exterior.coords) for g in polys for p in getattr(g, "geoms", [g]) if p.geom_type == "Polygon")} points', flush=True)
    # simplify in degrees, scaled for the latitude of each polygon (metres east-west shrink with cos(lat))
    simp = []
    for g in polys:
        la = g.centroid.y; tol = o.tol / 111320.0 / max(0.3, math.cos(math.radians(la))) ** 0.5   # between the N-S and E-W scales
        s = g.simplify(tol, preserve_topology=True)
        if not s.is_empty and s.area > 0: simp.append(s)
    tree = STRtree(simp); os.makedirs(o.out, exist_ok=True)
    for f in os.listdir(o.out):
        if f.endswith('.json'): os.remove(os.path.join(o.out, f))
    x0, y0, x1, y1 = unary_union([b.envelope for b in simp]).bounds
    coastal, landt, pts_total, kb = [], [], 0, 0
    for la0 in range(math.floor(y0), math.ceil(y1)):
        for lo0 in range(math.floor(x0), math.ceil(x1)):
            T = box(lo0, la0, lo0 + 1, la0 + 1); hits = [simp[i] for i in tree.query(T)]
            if not hits: continue
            g = unary_union([h.intersection(T) for h in hits if h.intersects(T)])
            if g.is_empty or g.area < 1e-10: continue
            if T.difference(g).area < 1e-8:   # no water in it (1e-8 square degrees is about 100 m²)
                landt.append(tile_name(la0, lo0)); continue
            P = []
            for p in (g.geoms if hasattr(g, 'geoms') else [g]):
                if p.geom_type != 'Polygon' or p.area < 1e-9: continue
                rr = [enc(p.exterior.coords)] + [enc(h.coords) for h in p.interiors]
                if rr[0]: P.append([r for r in rr if r]); pts_total += sum(len(r) // 2 for r in rr if r)
            if not P: continue
            name = tile_name(la0, lo0); txt = json.dumps({'p': P}, separators=(',', ':'))
            open(os.path.join(o.out, name + '.json'), 'w').write(txt); coastal.append(name); kb += len(txt) / 1024
    idx = {'v': 1, 'src': SRC, 'tol': o.tol, 'built': time.strftime('%Y-%m-%d'), 'n': pts_total, 'c': sorted(coastal), 'l': sorted(landt), 'kb': round(kb)}
    json.dump(idx, open(os.path.join(o.out, 'index.json'), 'w'), separators=(',', ':'))
    print(f'{len(coastal)} coastal tiles ({pts_total} points, {kb:.0f} KB), {len(landt)} all-land tiles, tol {o.tol} m, {time.time() - t0:.0f} s -> {o.out}')

if __name__ == '__main__': main()
