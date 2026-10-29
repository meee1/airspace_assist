"""Find the discrete CTAFs printed on the VTC/VNC sheets ("Wooloomanata / CTAF 118.8") for aerodromes ERSA gives no CTAF.

The chart labels are vector outlines, not text, so they are read with Tesseract OCR in two passes:
  1. every purple label box on the sheet (stroke (0.35,0.18,0.57) or (0.62,0.46,0.71)), OCR'd on its own
  2. the whole sheet in 500 pt tiles at two scales, purple ink only, looking for the word CTAF; then the area round each hit
The label position goes back to lat/lon through the sheet's fit in tools/charts.json, and the name above "CTAF" is matched
to aerodromes within 10 NM (data.json + data-next.json, fuzzy, >= 0.8).

  python tools/chartctaf.py scan   PDF_DIR [--only Melbourne_VNC]      # → WORK/scan/*.json (about 1.5 min per sheet per pass)
  python tools/chartctaf.py match                                      # → WORK/candidates.json, prints a summary
  python tools/chartctaf.py review [ICAO ...]                          # → WORK/review.png: the chart round each candidate

OCR misreads digits now and then (Somersby 137.1 for 132.1), so nothing goes into the app straight from here: read each
candidate off review.png and copy the confirmed ones into tools/chart_ctaf.json ({"ctaf": {ICAO: {f, n, sheets}}}).
assemble.py adds those as ap.cc for aerodromes without an ERSA CTAF. Needs: pymupdf, pytesseract (+ tesseract), numpy,
pillow, matplotlib. Sheets with no sheet entry in charts.json (Tindal VNC, the Sydney inset) are skipped.
"""
import argparse, difflib, json, math, os, re, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import chartref
WORK = os.path.join(HERE, 'chartctaf_work')
CH = {c['sheet']: c for c in json.load(open(os.path.join(HERE, 'charts.json')))}
PUR = (0.352, 0.179, 0.569); LIGHT = (0.62, 0.46, 0.71)
FQ = re.compile(r'(1[1-3]\d)\s?[.,·]\s?(\d{1,3})')
CTAF = re.compile(r'[CG]?T\s?A\s?[FE]')

# ---------- sheet geometry ----------
def lcc(s):
    p = CH[s].get('proj'); return chartref.LCC(*p) if p else chartref.LCC(-36, -39, -37.8, 145.0)
def fwd(s, pan, la, lo):
    x, y = lcc(s).fwd(la, lo)
    if 'aff' in pan: a = pan['aff']; return a[0]*x + a[1]*y + a[2], a[3]*x + a[4]*y + a[5]
    return chartref.sim_apply(pan['sim'], x, y)
def inv(s, pan, u, v):
    if 'aff' in pan: a = pan['aff']; x, y = np.linalg.solve([[a[0], a[1]], [a[3], a[4]]], [u - a[2], v - a[5]])
    else: a, b, c, d = pan['sim']; x, y = np.linalg.solve([[a, b], [b, -a]], [u - c, v - d])
    la, lo = chartref.lcc_inv(lcc(s), x, y); return float(la), float(lo)
def panel_at(s, u, v):
    from matplotlib.path import Path as MPath
    P = CH[s]['panels']
    if not any('clip' in p for p in P): return P[0]
    return next((p for p in P if 'clip' in p and MPath(p['clip']).contains_point((u, v))), None)
def sheet_of(fn):
    for s, c in CH.items():
        if re.search(c['re'], fn.lower()) and c['kind'] in fn.upper(): return s

# ---------- OCR ----------
def purple_only(pix):
    from PIL import Image
    a = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width, pix.n)[:, :, :3].astype(int)
    d = np.abs(a - np.array([90, 46, 145])).sum(2); return Image.fromarray(np.where(d < 170, 0, 255).astype('uint8'))
def read(dl, r, z=8):
    import pymupdf, pytesseract
    from PIL import ImageOps
    im = purple_only(dl.get_pixmap(clip=r, matrix=pymupdf.Matrix(z, z), alpha=False))
    return pytesseract.image_to_string(ImageOps.expand(im, 20, fill=255), config='--psm 6').strip()   # a margin: text touching the edge reads as nothing
def label_boxes(page):
    U = {}
    for g in page.get_drawings():
        c = g.get('color'); r = g['rect']
        if g['type'] not in ('s', 'fs') or not c or min(max(abs(a - b) for a, b in zip(c, P)) for P in (PUR, LIGHT)) > 0.06: continue
        if not (20 < r.width < 200 and 8 < r.height < 45) or not all(it[0] in ('l', 're', 'qu') for it in g['items']): continue
        U.setdefault((round(r.x0/3), round(r.y0/3), round(r.x1/3), round(r.y1/3)), r)   # the same box drawn several times
    return list(U.values())
def scan(path, s):
    import pymupdf, pytesseract
    page = pymupdf.open(path)[0]; dl = page.get_displaylist(); out = []
    def put(t, u, v, how):
        pan = panel_at(s, u, v)
        if pan is None: return
        la, lo = inv(s, pan, u, v); out.append(dict(t=t, la=la, lo=lo, uv=[round(u, 1), round(v, 1)], how=how))
    for r in label_boxes(page):                                                      # pass 1: label boxes
        try: t = read(dl, r + (1.6, 1.6, -1.6, -1.6))                                # inside the frame line
        except Exception: continue
        if CTAF.search(t.upper()): put(t, (r.x0 + r.x1)/2, (r.y0 + r.y1)/2, 'box')
    W, H = page.rect.width, page.rect.height; T = 500; hits = []                     # pass 2: the word CTAF anywhere
    for x0 in np.arange(0, W, T - 40):
        for y0 in np.arange(0, H, T - 40):
            for z in (3, 6):                                                         # each scale misses some
                r = pymupdf.Rect(x0, y0, min(W, x0 + T), min(H, y0 + T))
                d = pytesseract.image_to_data(purple_only(dl.get_pixmap(clip=r, matrix=pymupdf.Matrix(z, z), alpha=False)),
                                              output_type=pytesseract.Output.DICT, config='--psm 11')
                for k, t in enumerate(d['text']):
                    m = re.search(r'[CG]?T[AÁ][FE]', t)
                    if m and not re.search(r'B[CG]?TA', t) and not re.search(r'[A-Z]{2}TA[FE]|TA[FE][A-Z]{2}', t.replace('CTAF', '')):
                        hits.append((x0 + (d['left'][k] + d['width'][k]*m.start()/max(1, len(t)))/z, y0 + d['top'][k]/z))
    U = []
    for h in hits:
        if not any(abs(h[0] - u[0]) < 8 and abs(h[1] - u[1]) < 6 for u in U): U.append(h)
    for u, v in U:
        put(read(dl, pymupdf.Rect(u - 65, v - 22, u + 90, v + 15)), u + 15, v, 'word')
    return out

# ---------- match ----------
JUNK = re.compile(r'TWR|NDB|VOR|TACAN|DME|ATIS|ILS|HOWSIT|\bAH\b')      # navaid boxes, "TWR 118.1/CTAF AH", the legend sample
GEN = re.compile(r'\b(HELIPORT|HELIPAD|HLS|AIRPORT|AIRFIELD|AERODROME|ALA)\b')
def nm(a, b, c, d): return math.hypot(a - c, (b - d)*math.cos(math.radians(a)))*60
def clean(s): return ' '.join(t for t in re.sub(r'[^A-Z ]', ' ', s.upper()).split() if len(t) > 1)
def score(name, a):
    if not name: return 0
    ks = {k for q in [a['n']] + a['n'].split('/') for k in (clean(q), GEN.sub('', clean(q)).strip()) if k}
    return max(difflib.SequenceMatcher(None, n, k).ratio() for n in (name, GEN.sub('', name).strip() or name) for k in ks)
def match():
    A = {}
    for f in ('data.json', 'data-next.json'):
        p = os.path.join(HERE, f)
        if os.path.exists(p):
            for a in json.load(open(p))['ap']: A.setdefault(a['i'], a)
    res = []
    for fn in sorted(os.listdir(os.path.join(WORK, 'scan'))):
        d = json.load(open(os.path.join(WORK, 'scan', fn)))
        for x in d['items']:
            if JUNK.search(x['t'].upper()): continue
            L = [l for l in x['t'].split('\n') if l.strip()]
            ci = next((i for i, l in enumerate(L) if CTAF.search(l.upper())), None)
            if ci is None: continue
            m = FQ.search(L[ci]) or (FQ.search(L[ci + 1]) if ci + 1 < len(L) else None)
            f = m.group(1) + '.' + m.group(2) if m and 118.0 <= float(m.group(1) + '.' + m.group(2)) <= 136.975 else None
            name = clean(' '.join(L[max(0, ci - 2):ci]) + ' ' + CTAF.split(L[ci].upper())[0])
            best = None; w = name.split()
            for a in A.values():
                if abs(a['la'] - x['la']) > 0.25 or abs(a['lo'] - x['lo']) > 0.35: continue
                dd = nm(x['la'], x['lo'], a['la'], a['lo'])
                if dd > 10: continue
                full = score(name, a)   # the whole name first ("Albury Hospital" is not ALBURY), then word runs (stray map text round it)
                sc = max([full] + [score(' '.join(w[i:j]), a) for i in range(len(w)) for j in range(i + 1, min(len(w), i + 4) + 1)])
                if sc >= 0.8 and (not best or (full >= 0.8, sc, -dd) > (best[3] >= 0.8, best[0], -best[1])): best = (sc, dd, a, full)
            res.append(dict(sheet=d['sheet'], name=name, f=f, la=x['la'], lo=x['lo'], uv=x['uv'], t=x['t'],
                            icao=best[2]['i'] if best else None, ersa=best[2].get('c') if best and best[2].get('cS') == 'E' else None))
    json.dump(res, open(os.path.join(WORK, 'candidates.json'), 'w'), indent=1)
    by = {}
    for x in res:
        if x['icao']: by.setdefault(x['icao'], []).append(x)
    print('labels', len(res), 'aerodromes', len(by))
    for i, L in sorted(by.items()):
        fs = sorted({x['f'] for x in L if x['f']}); e = L[0]['ersa']
        tag = 'no ERSA CTAF' if not e else ('ERSA ' + e + ('' if fs == [e] else '  ← differs'))
        print(f"  {i:8} {A[i]['n'][:28]:28} chart {','.join(fs) or '?':14} {tag}  [{', '.join(sorted({CH[x['sheet']]['name'] for x in L}))}]")

def review(pdf_dir, only):
    import pymupdf
    from PIL import Image, ImageDraw
    res = json.load(open(os.path.join(WORK, 'candidates.json'))); files = {sheet_of(f): f for f in os.listdir(pdf_dir) if f.endswith('.pdf')}
    sel = [x for x in res if (x['icao'] in only) if only] if only else [x for x in res if x['icao'] and not x['ersa']]
    seen = set(); tiles = []; docs = {}
    for x in sel:
        if (x['icao'], x['sheet']) in seen: continue
        seen.add((x['icao'], x['sheet'])); f = files[x['sheet']]
        p = docs.get(f) or docs.setdefault(f, pymupdf.open(os.path.join(pdf_dir, f))[0]); u, v = x['uv']
        pix = p.get_pixmap(clip=pymupdf.Rect(u - 70, v - 35, u + 70, v + 30), matrix=pymupdf.Matrix(3, 3))
        t = Image.new('RGB', (420, 225), 'white'); t.paste(Image.frombytes('RGB', (pix.width, pix.height), pix.samples), (0, 30))
        ImageDraw.Draw(t).text((4, 4), f"{x['icao']} | OCR {x['f']} | {CH[x['sheet']]['name']}", fill='black'); tiles.append(t)
    if not tiles: print('nothing to review'); return
    cols = 4; out = Image.new('RGB', (420*cols, 225*((len(tiles) + cols - 1)//cols)), '#bbb')
    for i, t in enumerate(tiles): out.paste(t, ((i % cols)*420, (i//cols)*225))
    out.save(os.path.join(WORK, 'review.png')); print(len(tiles), 'tiles →', os.path.join(WORK, 'review.png'))

if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('cmd', choices=['scan', 'match', 'review']); ap.add_argument('args', nargs='*')
    ap.add_argument('--only', action='append', default=[])
    a = ap.parse_args(); os.makedirs(os.path.join(WORK, 'scan'), exist_ok=True)
    if a.cmd == 'scan':
        d = a.args[0]
        for f in sorted(os.listdir(d)):
            s = sheet_of(f)
            if not f.endswith('.pdf') or not s or (a.only and not any(o.lower() in f.lower() for o in a.only)): continue
            o = scan(os.path.join(d, f), s); print(f, s, len(o), flush=True)
            json.dump({'sheet': s, 'items': o}, open(os.path.join(WORK, 'scan', f + '.json'), 'w'))
    elif a.cmd == 'match': match()
    else: review(a.args[0] if a.args else os.path.join(HERE, '..', 'data', 'aip'), set(a.args[1:]))
