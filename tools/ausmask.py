#!/usr/bin/env python3
"""Small land mask of Australia for the chart locator maps (Options -> Chart downloads).

Reads the coastline tiles the app already ships (app/coast/: tools/coast.py, Geoscience Australia GEODATA COAST 100K,
CC BY 4.0) and writes tools/aus_mask.json: a 0.1 degree land grid over 111-155 E, 8.5-44.5 S, run-length encoded per row.
assemble.py injects it into app.js at /*__AUS__*/null.

  python3 tools/ausmask.py [app/coast] [tools/aus_mask.json]

Each row (north to south) is a list of run lengths in base 36 joined by ',', starting with sea; rows are joined by ';'.
A cell is land when at least half of it is land (rasterised at 4x and averaged).
"""
import json, os, sys
from PIL import Image, ImageDraw

here = os.path.dirname(os.path.abspath(__file__))
src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, '..', 'app', 'coast')
out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(here, 'aus_mask.json')
X0, Y0, D, W, H = 111.0, -8.5, 0.1, 440, 360          # west edge, north edge, cell (deg), columns, rows
SS = 4                                                 # supersampling
idx = json.load(open(os.path.join(src, 'index.json'), encoding='utf-8'))
img = Image.new('L', (W * SS, H * SS), 0); dr = ImageDraw.Draw(img)
px = lambda lo, la: ((lo - X0) / D * SS, (Y0 - la) / D * SS)

def tile_ll(name):   # S38E144 -> SW corner (lat -38, lon 144): the tile covers lat -38..-37, lon 144..145
    la = int(name[1:3]) * (-1 if name[0] == 'S' else 1); lo = int(name[4:7]) * (1 if name[3] == 'E' else -1); return la, lo

for name in idx.get('l', []):                          # all-land tiles
    la, lo = tile_ll(name); a = px(lo, la + 1); b = px(lo + 1, la); dr.rectangle([a[0], a[1], b[0] - 1, b[1] - 1], fill=255)
for name in idx.get('c', []):                          # coastal tiles: polygons, first ring the outline, the rest holes
    t = json.load(open(os.path.join(src, name + '.json'), encoding='utf-8'))
    for poly in t.get('p', []):
        for k, ring in enumerate(poly):
            x, y = ring[0], ring[1]; pts = [px(x / 1e4, y / 1e4)]
            for i in range(2, len(ring) - 1, 2): x += ring[i]; y += ring[i + 1]; pts.append(px(x / 1e4, y / 1e4))
            if len(pts) >= 3: dr.polygon(pts, fill=255 if k == 0 else 0)
small = img.resize((W, H), Image.BOX)
def b36(n):
    d = '0123456789abcdefghijklmnopqrstuvwxyz'; s = ''
    while True:
        s = d[n % 36] + s; n //= 36
        if not n: return s
rows = []
for j in range(H):
    runs, cur, n = [], 0, 0
    for i in range(W):
        v = 1 if small.getpixel((i, j)) >= 128 else 0
        if v == cur: n += 1
        else: runs.append(n); cur, n = v, 1
    runs.append(n)
    if len(runs) == 1: runs = []                         # all sea
    rows.append(','.join(b36(r) for r in runs))
txt = ';'.join(rows)
json.dump({'x0': X0, 'y0': Y0, 'd': D, 'w': W, 'h': H, 'r': txt, 'src': 'Geoscience Australia GEODATA COAST 100K 2004, CC BY 4.0'},
          open(out, 'w', encoding='utf-8'), separators=(',', ':'))
land = sum(1 for j in range(H) for i in range(W) if small.getpixel((i, j)) >= 128)
print(f'{out}: {W}x{H} cells, {land} land, {len(txt)} chars')
