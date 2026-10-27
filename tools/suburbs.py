"""ABS Suburbs and Localities (ASGS 2021, CC BY 4.0) -> one labelled point per suburb, for search and map labels.

Download SAL_2021_AUST_GDA2020_SHP.zip from the ABS digital boundary files page and unzip it into data/abs/.

load(path) -> [[name, la x1e4, lo x1e4, state], ...] (state as Vic, NSW, Qld, SA, WA, Tas, NT, ACT, OT). The point is the area centroid of the suburb's largest part (holes
ignored). The state suffix ABS adds to names used in more than one state ("Richmond (Vic.)") is dropped, and the
non-geographic records ("No usual address", "Migratory - Offshore - Shipping") are skipped. Needs `pip install pyshp`.
"""
import re, shapefile

STE = {'New South Wales': 'NSW', 'Victoria': 'Vic', 'Queensland': 'Qld', 'South Australia': 'SA', 'Western Australia': 'WA',
       'Tasmania': 'Tas', 'Northern Territory': 'NT', 'Australian Capital Territory': 'ACT', 'Other Territories': 'OT'}

def _centroid(ring):
    A = x = y = 0.0
    for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]):
        f = x1 * y2 - x2 * y1; A += f; x += (x1 + x2) * f; y += (y1 + y2) * f
    if not A: return abs(A), ring[0]
    return abs(A), (x / (3 * A), y / (3 * A))

def load(path):
    sf = shapefile.Reader(path); out = []
    for sr in sf.iterShapeRecords():
        rec, shp = sr.record.as_dict(), sr.shape
        name = rec.get('SAL_NAME21') or ''
        if not shp.points or re.match(r'(No usual address|Migratory)', name): continue
        parts = list(shp.parts) + [len(shp.points)]; best = None
        for i in range(len(parts) - 1):
            a, c = _centroid([tuple(p) for p in shp.points[parts[i]:parts[i + 1]]])
            if best is None or a > best[0]: best = (a, c)
        lo, la = best[1]
        out.append([re.sub(r'\s*\([^)]*\)\s*$', '', name).strip(), round(la * 1e4), round(lo * 1e4), STE.get(rec.get('STE_NAME21'), '')])
    return out

if __name__ == '__main__':
    import sys, json
    s = load(sys.argv[1]); print(len(s), 'suburbs', len(json.dumps(s, separators=(',', ':'))) // 1024, 'KB')
