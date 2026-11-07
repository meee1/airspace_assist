#!/usr/bin/env python3
"""Pre-render the calibrated VTC/VNC sheets (tools/charts.json) into JPEG tiles for the site: app/charts/.

The app downloads these by default and keeps them in Cache Storage for offline use. Tiles that fall entirely outside
every map panel (legends, margins) are skipped. Output, per sheet:
  app/charts/<sheet>-<edition>/<level>/<i>_<j>.jpg     512 px tiles, level scales from charts.json
  app/charts/index.json                                [{sheet,name,ed,edT,dir,bytes,levels:[{s,cols,rows,tiles:[[i,j],..]}],def?}]
  def: the sheet has "default": true in charts.json, so a new install downloads it without being asked (Options)
Usage: python chartiles.py OUT_DIR CHART.pdf [CHART.pdf ...]      (needs pymupdf, pillow)
         renders these sheets (a new edition replaces the old one's folder) and keeps every other sheet in index.json
       python chartiles.py --only OUT_DIR CHART.pdf ...   the site gets exactly these sheets: every other sheet's folder is removed
       (--add is accepted and is the default; before Nov 2026 the default was --only, which would now remove the 46 WACs)
WAC sheets (raster scans, 1 px per pt) carry an edition number rather than a date ("WAC_3470_Melbourne_Ed._17.pdf" -> "Ed 17").
Note: Airservices charts are copyright; publishing these tiles is the site owner's decision.
"""
import io, json, os, re, sys, datetime, shutil
import pymupdf
from PIL import Image

TILE = 512
here = os.path.dirname(os.path.abspath(__file__))

def edition(name, title):
    m = re.search(r'(\d{2})\s?(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s?(\d{4})', (name + ' ' + title).upper())
    if m: return f'{m.group(1)} {m.group(2)} {m.group(3)}'
    m = re.search(r'(?:^|[^A-Z])ED\.?[ _]*(\d+)', (name + ' ' + title).upper())   # WAC: edition number, no date
    return f'Ed {m.group(1)}' if m else ''

def main():
    args = sys.argv[1:]; add = True
    if args[:1] in (['--add'], ['--only']): add = args[0] == '--add'; args = args[1:]
    out = args[0]; pdfs = args[1:]
    sheets = json.load(open(os.path.join(here, 'charts.json')))
    os.makedirs(out, exist_ok=True); idx = []
    for path in pdfs:
        doc = pymupdf.open(path); page = doc[0]; W, H = page.rect.width, page.rect.height
        key = (os.path.basename(path) + ' ' + (doc.metadata or {}).get('title', '')).lower()
        sh = next((s for s in sheets if abs(W - s['page'][0]) < 2 and abs(H - s['page'][1]) < 2
                   and s['kind'].lower() in key and re.search(s['re'], key, re.I)), None)
        if not sh: print('no calibration for', path); continue
        ed = edition(os.path.basename(path), (doc.metadata or {}).get('title', ''))
        d = f"{sh['sheet']}-{ed.replace(' ', '').upper()}" if ed else sh['sheet']
        shutil.rmtree(os.path.join(out, d), ignore_errors=True)
        boxes = []
        for p in sh['panels']:
            xs = [q[0] for q in p['clip']]; ys = [q[1] for q in p['clip']]; boxes.append((min(xs), min(ys), max(xs), max(ys)))
        levels = []; total = 0
        for L, s in enumerate(sh['levels']):
            pix = page.get_pixmap(matrix=pymupdf.Matrix(s, s), alpha=False)
            img = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
            cols, rows = -(-pix.width // TILE), -(-pix.height // TILE); tiles = []
            os.makedirs(os.path.join(out, d, str(L)), exist_ok=True)
            for j in range(rows):
                for i in range(cols):
                    u0, v0, u1, v1 = i * TILE / s, j * TILE / s, (i + 1) * TILE / s, (j + 1) * TILE / s
                    if not any(u1 > b[0] and u0 < b[2] and v1 > b[1] and v0 < b[3] for b in boxes): continue
                    t = img.crop((i * TILE, j * TILE, min(pix.width, (i + 1) * TILE), min(pix.height, (j + 1) * TILE)))
                    bio = io.BytesIO(); t.save(bio, 'JPEG', quality=80, optimize=True); b = bio.getvalue(); total += len(b)
                    open(os.path.join(out, d, str(L), f'{i}_{j}.jpg'), 'wb').write(b); tiles.append([i, j])
            levels.append(dict(s=s, cols=cols, rows=rows, tiles=tiles))
            print(sh['name'], 'level', L, 'scale', s, len(tiles), 'tiles')
        edT = 0
        if re.match(r'\d{2} ', ed):
            edT = int((datetime.datetime.strptime(ed, '%d %b %Y').replace(tzinfo=datetime.timezone.utc) - datetime.timedelta(hours=8)).timestamp() * 1000)
        idx.append(dict(sheet=sh['sheet'], name=sh['name'], ed=ed, edT=edT, dir=d, bytes=total, levels=levels, src='site', **({'def': True} if sh.get('default') else {})))
        print(sh['name'], ed, round(total / 1048576, 1), 'MB')
    if add:   # keep the sheets not given here (and their folders); a given sheet replaces its old edition
        old = json.load(open(os.path.join(out, 'index.json'))) if os.path.exists(os.path.join(out, 'index.json')) else []
        mine = {e['sheet'] for e in idx}
        for e in old:
            if e['sheet'] in mine and e['dir'] not in {x['dir'] for x in idx}: shutil.rmtree(os.path.join(out, e['dir']), ignore_errors=True)
        idx = [e for e in old if e['sheet'] not in mine] + idx
    keep = {e['dir'] for e in idx}
    for n in ([] if add else os.listdir(out)):
        if os.path.isdir(os.path.join(out, n)) and n not in keep: shutil.rmtree(os.path.join(out, n))
    json.dump(idx, open(os.path.join(out, 'index.json'), 'w'), separators=(',', ':'))

if __name__ == '__main__':
    main()
