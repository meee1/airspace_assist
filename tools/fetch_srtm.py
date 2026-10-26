#!/usr/bin/env python3
"""Build the app's terrain tiles from SRTM.

Run this on your own computer (it needs normal internet access). Standard library only.

Output: app/terrain/<S38E144>.bin.z  (zlib-compressed little-endian int16, 121 x 121 posts,
        30 arc-second spacing, row 0 = north edge, each post = MAX elevation in metres of the
        SRTM posts around it, so heights above ground are conservative)
        app/terrain/index.json  (tile list and metadata)

Sources (pick one):
  default    download SRTM 1 arc-second .hgt.gz tiles from the public AWS Terrain Tiles bucket
             (https://s3.amazonaws.com/elevation-tiles-prod/skadi/...)
  --from-dir use .hgt / .hgt.gz / .hgt.zip files you already have, e.g. NASA SRTMGL1 or SRTMGL3
             from https://search.earthdata.nasa.gov (free Earthdata login)

Area (pick one):
  --around=LAT,LON,KM    tiles within KM of a point  (e.g. --around=-38.15,144.36,300)
  --bbox=S,W,N,E         e.g. --bbox=-39.5,140.5,-33.5,150.5
  --australia            all Australian land tiles (about 900 tiles; the download is large)

Examples:
  python fetch_srtm.py --around=-38.15,144.36,300
  python fetch_srtm.py --from-dir C:\\srtm --australia
"""
import argparse, array, gzip, io, json, math, os, struct, sys, time, urllib.request, urllib.error, zipfile, zlib

N = 120                       # cells per degree (30 arc-seconds)
SKADI = 'https://s3.amazonaws.com/elevation-tiles-prod/skadi/{ns}{lat:02d}/{name}.hgt.gz'
AU_BOX = (-44.0, 112.0, -9.0, 154.0)

def tile_name(lat0, lon0):
    """lat0, lon0 = south-west corner (integers)."""
    ns = 'S' if lat0 < 0 else 'N'; ew = 'W' if lon0 < 0 else 'E'
    return f"{ns}{abs(lat0):02d}{ew}{abs(lon0):03d}", ns, abs(lat0)

def read_hgt_bytes(raw):
    n = int(round(math.sqrt(len(raw) // 2)))
    if n * n * 2 != len(raw): raise ValueError('not an HGT grid')
    a = array.array('h'); a.frombytes(raw)
    if sys.byteorder == 'little': a.byteswap()      # HGT is big-endian
    return n, a

def load_local(path):
    with open(path, 'rb') as f: data = f.read()
    if path.endswith('.gz'): data = gzip.decompress(data)
    elif path.endswith('.zip'):
        z = zipfile.ZipFile(io.BytesIO(data))
        data = z.read(next(n for n in z.namelist() if n.lower().endswith('.hgt')))
    return read_hgt_bytes(data)

def fetch(name, ns, alat, retries=3):
    url = SKADI.format(ns=ns, lat=alat, name=name)
    for k in range(retries):
        try:
            with urllib.request.urlopen(url, timeout=120) as r:
                return read_hgt_bytes(gzip.decompress(r.read()))
        except urllib.error.HTTPError as e:
            if e.code in (403, 404): return None          # no tile (ocean)
            err = e
        except Exception as e:
            err = e
        time.sleep(2 + 3 * k)
    raise RuntimeError(f'{name}: {err}')

def decimate(n, a):
    """Max-pool an n x n HGT (n = 3601 or 1201) to (N+1) x (N+1) posts. Voids are ignored."""
    step = (n - 1) / N
    out = array.array('h', [0] * ((N + 1) * (N + 1)))
    half = step / 2
    for j in range(N + 1):
        r0 = max(0, int(round(j * step - half))); r1 = min(n - 1, int(round(j * step + half)))
        for i in range(N + 1):
            c0 = max(0, int(round(i * step - half))); c1 = min(n - 1, int(round(i * step + half)))
            m = -32768
            for r in range(r0, r1 + 1):
                row = r * n
                seg = a[row + c0: row + c1 + 1]
                v = max(seg)
                if v > m: m = v
            out[j * (N + 1) + i] = m if m > -1000 else 0      # all-void cell -> 0 (sea)
    return out

def wanted(args):
    if args.bbox:
        s, w, n, e = [float(x) for x in args.bbox.split(',')]
    elif args.around:
        la, lo, km = [float(x) for x in args.around.split(',')]
        dl = km / 111.0; dlo = km / (111.0 * math.cos(math.radians(la)))
        s, w, n, e = la - dl, lo - dlo, la + dl, lo + dlo
    else:
        s, w, n, e = AU_BOX
    return [(la, lo) for la in range(math.floor(s), math.ceil(n)) for lo in range(math.floor(w), math.ceil(e))]

def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    g = p.add_mutually_exclusive_group(required=True)
    g.add_argument('--around'); g.add_argument('--bbox'); g.add_argument('--australia', action='store_true')
    p.add_argument('--from-dir', help='folder of .hgt/.hgt.gz/.hgt.zip files (instead of downloading)')
    p.add_argument('--out', default=os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'app', 'terrain'))
    args = p.parse_args()
    os.makedirs(args.out, exist_ok=True)
    idx_path = os.path.join(args.out, 'index.json')
    idx = json.load(open(idx_path)) if os.path.exists(idx_path) else {'res': 30, 'n': N + 1, 'agg': 'max', 'unit': 'm', 'tiles': []}
    have = set(idx['tiles']); sea = set(idx.get('sea', []))
    local = {}
    if args.from_dir:
        for root, _, files in os.walk(args.from_dir):
            for f in files:
                key = f.upper().split('.')[0][:7]
                if f.lower().endswith(('.hgt', '.hgt.gz', '.hgt.zip')): local[key] = os.path.join(root, f)
        idx['source'] = 'SRTM (local files)'
    else:
        idx['source'] = 'SRTM 1" via AWS Terrain Tiles (skadi)'
    todo = wanted(args)
    print(f'{len(todo)} candidate tiles, {len(have)} already built')
    for k, (la, lo) in enumerate(todo, 1):
        name, ns, alat = tile_name(la, lo)
        outf = os.path.join(args.out, name + '.bin.z')
        if (name in have and os.path.exists(outf)) or name in sea: continue
        t0 = time.time()
        if args.from_dir:
            if name not in local: continue
            grid = load_local(local[name])
        else:
            grid = fetch(name, ns, alat)
            if grid is None:
                print(f'[{k}/{len(todo)}] {name}: no data (sea)')
                sea.add(name); idx['sea'] = sorted(sea); json.dump(idx, open(idx_path, 'w')); continue
        d = decimate(*grid)
        if max(d) <= 0:
            print(f'[{k}/{len(todo)}] {name}: all sea, skipped')
            sea.add(name); idx['sea'] = sorted(sea); json.dump(idx, open(idx_path, 'w')); continue
        if sys.byteorder != 'little': d.byteswap()
        with open(outf, 'wb') as f: f.write(zlib.compress(d.tobytes(), 9))
        have.add(name); idx['tiles'] = sorted(have)
        idx['built'] = time.strftime('%Y-%m-%d')
        json.dump(idx, open(idx_path, 'w'))
        print(f'[{k}/{len(todo)}] {name}: max {max(d)} m, {os.path.getsize(outf)//1024} KB, {time.time()-t0:.1f}s')
    print(f'done: {len(have)} tiles in {os.path.abspath(args.out)}')

if __name__ == '__main__':
    main()
