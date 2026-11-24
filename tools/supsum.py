"""AIP SUP / AIC summary -> tools/sups.json (put into app.js by assemble.py at /*__SUPS__*/).

    python3 tools/supsum.py data/aip/SUPSummary_1226_26NOV2026.pdf     (default: the newest SUPSummary_*.pdf in data/aip)

The Airservices "Summary of SUP/AIC current" PDF (PyMuPDF words with their positions): rows whose first word is a number at
the left (x < 52) start an entry; the subject runs on in the next rows (x 57..265); the effective date (DDMONYY) sits at
x ~272 and the estimated expiry at x ~330 on the entry's first row. Year headings ("2026", "2026 (cont.)") give the year of
the number (H62/26). Sections: 1. AIP SUPPLEMENT (SUP), 2. AERONAUTICAL INFORMATION CIRCULAR (AIC), 3. CANCELLED SINCE LAST
SUMMARY, 4. WEBSITE. Dates in the summary are local (Canberra).
Output: {summary: '26 NOV 2026', issued: '202611251600', items: [{k: SUP|AIC, id: 'H62/26', subj, eff: 'YYYY-MM-DD',
exp: 'YYYY-MM-DD'|null, icao: [...]}], cancelled: {SUP: [...], AIC: [...]}, web, note}.
"""
import json, os, re, sys, glob
import pymupdf

MON = {m: i + 1 for i, m in enumerate('JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC'.split())}
DATE = re.compile(r'^(\d{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(\d{2})$')

def iso(s):
    m = DATE.match(s or '')
    return f'20{m.group(3)}-{MON[m.group(2)]:02d}-{m.group(1)}' if m else None

def parse(pdf):
    doc = pymupdf.open(pdf); rows = []
    for pn, page in enumerate(doc):
        by = {}
        for x0, y0, x1, y1, w, *_ in page.get_text('words'): by.setdefault(round(y0), []).append((x0, w))
        for y in sorted(by): rows.append((pn, y, sorted(by[y])))
    full = '\n'.join(' '.join(w for _, w in r[2]) for r in rows)
    head = re.search(r'SUMMARY OF SUP/AIC CURRENT\s+(\d{1,2} [A-Z]{3} \d{4})', full)
    issued = re.search(r'\b(\d{12})\s+UTC\b', full) or re.search(r'UTC\s+AIRAC.*?(\d{12})', full, re.S)
    items, sec, yr, cur = [], None, None, None
    for pn, y, ws in rows:
        line = ' '.join(w for _, w in ws)
        if re.match(r'^1\.\s+AIP SUPPLEMENT', line): sec = 'SUP'; continue
        if re.match(r'^2\.\s+AERONAUTICAL INFORMATION CIRCULAR', line): sec = 'AIC'; continue
        if re.match(r'^3\.\s+CANCELLED', line): sec = 'CNL'; cur = None; continue
        if re.match(r'^4\.\s+WEBSITE', line): sec = 'WEB'; cur = None; continue
        if sec not in ('SUP', 'AIC'): continue
        m = re.match(r'^(20\d\d)(\s+\(cont\.\))?$', line)
        if m: yr = m.group(1)[2:]; cur = None; continue
        if re.match(r'^(\(H\.\.\.\)|EST|Expiry|SUP/AIC Summary|Page \d|\d{2} [A-Z]{3} \d{4})', line) or 'Page' in line and 'of' in line: continue
        x0, w0 = ws[0]
        subj = [w for x, w in ws if 57 <= x < 265]
        dates = [w for x, w in ws if x >= 265 and DATE.match(w)]
        if x0 < 52 and re.fullmatch(r'\d{1,3}', w0) and yr:
            cur = {'k': sec, 'id': f'H{int(w0)}/{yr}', 'subj': ' '.join(subj), 'eff': None, 'exp': None}
            if dates: cur['eff'] = iso(dates[0])
            if len(dates) > 1: cur['exp'] = iso(dates[1])
            items.append(cur)
        elif cur is not None and subj and x0 >= 52:
            cur['subj'] += ' ' + ' '.join(subj)
            if dates and not cur['eff']: cur['eff'] = iso(dates[0])
    for it in items:
        it['subj'] = re.sub(r'\s+', ' ', it['subj']).replace('–', '-').replace('’', "'").replace('‘', "'").strip()
        it['icao'] = sorted(set(re.findall(r'\((Y[A-Z]{3})\)', it['subj'])))
    cnl = {}
    m = re.search(r'3\.\s+CANCELLED SINCE LAST SUMMARY(.*?)(?:\n4\.\s+WEBSITE|$)', full, re.S)
    if m:
        for k, body in re.findall(r'\b(SUP|AIC):\s*([^:]*?)(?=\b(?:SUP|AIC):|$)', m.group(1), re.S):
            cnl[k] = re.findall(r'H\d+/\d{2}', body)
    web = re.search(r'(www\.airservicesaustralia\.com/\S+)', full)
    return {'summary': head.group(1) if head else '', 'issued': issued.group(1) if issued else '', 'src': os.path.basename(pdf),
            'items': items, 'cancelled': cnl, 'web': web.group(1) if web else 'www.airservicesaustralia.com/aip/aip.asp',
            'note': 'Some AIP SUP and AIC may expire or come into force between summaries: check the Airservices website and NOTAMs.'}

if __name__ == '__main__':
    here = os.path.dirname(os.path.abspath(__file__))
    src = sys.argv[1] if len(sys.argv) > 1 else max(glob.glob(os.path.join(here, '..', 'data', 'aip', 'SUPSummary_*.pdf')), key=os.path.getmtime)
    out = parse(src)
    json.dump(out, open(os.path.join(here, 'sups.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    s = [i for i in out['items'] if i['k'] == 'SUP']; a = [i for i in out['items'] if i['k'] == 'AIC']
    print(f"{out['summary']}: {len(s)} SUP, {len(a)} AIC, cancelled {sum(len(v) for v in out['cancelled'].values())}; missing dates:",
          [i['id'] for i in out['items'] if not i['eff']])
