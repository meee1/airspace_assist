"""Split the ERSA into one PDF per aerodrome FAC entry.

facsplit.py ERSA.pdf OUTDIR  ->  OUTDIR/<ICAO>.pdf and OUTDIR/index.json {ICAO: [first page, last page]} (1-based, in the ERSA)
An entry runs from the page with its header (name ... ELEV n, then the state/UTC/ICAO line) to the page before the next
entry starts, or to the next entry's page when that entry starts part way down it (short entries share a page).
"""
import re, subprocess, sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ersa import HDR, STATE

FACP = re.compile(r'\bFAC\s+[A-Z]\s*-\s*\d+\s*$')
ICAOL = re.compile(STATE + r'\s+UTC\s*[+-].*?\s(?P<i>Y[A-Z0-9]{3})\s*$')

def starts(lines):
    """[(line index, ICAO)] of FAC entry headers on one page."""
    out = []
    for j, l in enumerate(lines):
        m = ICAOL.search(l)
        if not m: continue
        # the name line (… ELEV n, or an all-caps line for ELEV-less entries) is a few lines above
        h = next((i for i in range(j - 1, max(-1, j - 13), -1) if HDR.match(lines[i])), None)
        if h is None:
            h = next((i for i in range(j - 1, max(-1, j - 6), -1) if re.fullmatch(r'\s*[A-Z][A-Z0-9 /().\'-]{2,}\s*', lines[i]) and not FACP.search(lines[i])), j)
        if not out or out[-1][1] != m.group('i'): out.append((h, m.group('i')))
    return out

def split(pdf, outdir):
    txt = subprocess.run(['pdftotext', '-layout', pdf, '-'], capture_output=True, text=True, errors='replace').stdout.split('\f')
    ent = []   # (page0, line, icao, top)
    for p, t in enumerate(txt):
        L = t.splitlines()
        if not any(FACP.search(l) for l in L[:3]): continue
        body = [i for i, l in enumerate(L) if l.strip()][1:]   # skip the page header line
        for i, ic in starts(L):
            top = not any(k < i and not re.search(r'^\s*$', L[k]) for k in body if k < i) or i <= (body[0] + 1 if body else 0)
            ent.append((p, i, ic, top))
    idx = {}
    for n, (p, i, ic, top) in enumerate(ent):
        if n + 1 < len(ent):
            q, _, _, qtop = ent[n + 1]
            last = q - 1 if qtop and q > p else q
        else:
            last = p
            while last + 1 < len(txt) and any(FACP.search(l) for l in txt[last + 1].splitlines()[:3]): last += 1
        if ic in idx: idx[ic][1] = max(idx[ic][1], last + 1); continue   # same ICAO twice (e.g. a heliport listed under its aerodrome)
        idx[ic] = [p + 1, last + 1]
    os.makedirs(outdir, exist_ok=True)
    t0 = os.path.getmtime(pdf)
    todo = {ic: r for ic, r in idx.items() if not (os.path.exists(f := os.path.join(outdir, ic + '.pdf')) and os.path.getmtime(f) >= t0 and os.path.getsize(f) > 0)}   # resumable
    try:
        import pymupdf   # one process, ~10x faster than a qpdf run per aerodrome
        src = pymupdf.open(pdf)
        for ic, (a, b) in todo.items():
            d = pymupdf.open(); d.insert_pdf(src, from_page=a - 1, to_page=b - 1)
            d.save(os.path.join(outdir, ic + '.pdf'), garbage=3, deflate=True); d.close()
    except ImportError:
        for ic, (a, b) in todo.items():
            subprocess.run(['qpdf', '--empty', '--pages', pdf, f'{a}-{b}', '--', os.path.join(outdir, ic + '.pdf')], check=True)
    for f in os.listdir(outdir):   # an aerodrome that left the ERSA
        if f.endswith('.pdf') and f[:-4] not in idx:
            try: os.remove(os.path.join(outdir, f))
            except OSError: pass
    json.dump(idx, open(os.path.join(outdir, 'index.json'), 'w'), separators=(',', ':'), sort_keys=True)
    return idx

if __name__ == '__main__':
    idx = split(sys.argv[1], sys.argv[2]); print(len(idx), 'entries ->', sys.argv[2])
