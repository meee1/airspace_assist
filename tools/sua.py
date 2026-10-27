"""ERSA SUA section -> restricted, danger and military operating areas with their status, hours, authority,
contact number and activity (ERSA "SPECIAL USE AIRSPACE (SUA)": 6. RESTRICTED AREAS, 7. DANGER AREAS,
8. MILITARY OPERATING AREAS, 9. LIST OF RELEVANT CONTACT NUMBERS, and the RA conditional status legend in 3.2).

parse(text) -> {'areas': {IDENT: {st, lim, hr, auth, ph, act, grp}}, 'ra': {RA1: text, RA2: ..., RA3: ...}}
IDENT is the area ident without the military group, e.g. R330A (group PCX in 'grp').

The tables come from `pdftotext -layout`, so they're parsed by column: each page repeats a header line
("IDENT STATUS LIMIT HOUR AUTHORITY ACTIVITY", or "IDENT LIMIT HOUR CONTACT ACTIVITY") whose word positions give
the columns for that page. Text runs (split on 2+ spaces) go to the nearest column; a run that crosses the
ACTIVITY column (authority and activity only one space apart) is split before its trailing words in capitals, and "(n) Authority" always starts the authority. Indented lines continue the row above.
"""
import re

COLS_R = ('STATUS', 'LIMIT', 'HOUR', 'AUTHORITY', 'ACTIVITY')
COLS_D = ('LIMIT', 'HOUR', 'CONTACT', 'ACTIVITY')


def _runs(line):
    return [(m.start(), m.group(0)) for m in re.finditer(r'\S+(?: \S+)*', line)]


def _header(line):
    if not line.startswith('IDENT'): return None
    names = COLS_R if 'STATUS' in line else COLS_D
    cols = [('id', 0)]
    for n in names:
        i = line.find(n)
        if i < 0: return None
        cols.append(({'STATUS': 'st', 'LIMIT': 'lim', 'HOUR': 'hr', 'AUTHORITY': 'auth', 'CONTACT': 'auth', 'ACTIVITY': 'act'}[n], i))
    return cols


def _assign(line, cols):
    out = {}
    act = dict(cols).get('act')
    runs = []
    for start, txt in _runs(line):   # "(19) FLTCDR ..." starts the authority even when only one space follows the hours
        for part in re.split(r' (?=\(\d+\) )', txt):
            runs.append((line.index(part, start), part))
    if runs:   # 'R560A(WWX) RA2' has one space between ident and status: split the ident off
        s0, t0 = runs[0]
        m = re.match(r'^([PRDM]\d+[A-Z]?(?:\([A-Z]+\))?)\s+(\S.*)$', t0)
        if m: runs[0:1] = [(s0, m.group(1)), (s0 + m.start(2), m.group(2))]
    for start, txt in runs:
        end = start + len(txt)
        if re.match(r'^\(\d+\)\s', txt):   # '(6) DOTAM RCO Majura' is the authority wherever it starts
            out.setdefault('auth', []).append(txt); continue
        if act is not None and start < act - 2 and end > act + 2:   # authority and activity run together: split later
            out.setdefault('authact', []).append(txt); continue
        out.setdefault(_nearest(cols, start), []).append(txt)
    return {k: ' '.join(v) for k, v in out.items()}


def _nearest(cols, x):
    best = None
    for name, c in cols:
        if c <= x + 3: best = name          # the last column that starts at or before the text
    return best or 'id'


def parse(text):
    lines = text.splitlines()
    try:
        i0 = next(i for i, l in enumerate(lines) if re.match(r'^6\.\s+RESTRICTED AREAS', l))
    except StopIteration:
        return {'areas': {}, 'ra': {}}
    # RA conditional status legend (3.2), just above the tables
    ra = {}
    leg = '\n'.join(lines[max(0, i0 - 200):i0])
    for k in ('RA1', 'RA2', 'RA3'):
        m = re.search(rf'{k}:\s*(.+?)(?=\n\s*[a-c]\.\s*RA\d:|\n\s*Note:|\n\s*\d\.\s)', leg, re.S)
        if m: ra[k] = re.sub(r'\s+', ' ', m.group(1)).strip()
    areas, phones, cols, cur, sec = {}, {}, None, None, None
    for l in lines[i0:]:
        if re.match(r'^9\.\s+LIST OF RELEVANT CONTACT NUMBERS', l): sec = 'ph'; continue
        if sec == 'ph':
            m = re.match(r'^\((\d+)\)\s+(.+)$', l.strip())
            if m: phones[m.group(1)] = re.sub(r'\s+', ' ', m.group(2)).strip()
            elif re.match(r'^\s*\d+\.\s+[A-Z]', l) or l.startswith(('AERODROME', 'SECTION')): break
            continue
        h = _header(l)
        if h: cols = h; cur = None; continue
        if not cols or not l.strip() or re.match(r'^\s*SUA\s|^\s*\d\d [A-Z]{3} \d{4}\s*$|^\d\.\s', l):
            if re.match(r'^\s*SUA\s|^\s*\d\d [A-Z]{3} \d{4}', l): cur = None
            continue
        f = _assign(l, cols)
        m = re.match(r'^([PRDM]\d+[A-Z]?)(?:\(([A-Z]+)\))?$', f.get('id', ''))
        if m:
            cur = dict(id=m.group(1), grp=m.group(2) or '', st=f.get('st', ''), lim=f.get('lim', ''), hr=f.get('hr', ''),
                       auth=f.get('auth', '') or f.get('authact', ''), act=f.get('act', ''))
            areas[cur['id']] = cur
        elif cur and not f.get('id'):
            for k in ('hr', 'auth', 'act'):
                if f.get(k): cur[k] = (cur[k] + ' ' + f[k]).strip()
    # all-capitals authority and activity one space apart ("(65) FLTCDR 453SQN PEARCE MILITARY FLYING"): take the
    # longest activity seen elsewhere in the tables off the end of the authority
    vocab = sorted({a['act'] for a in areas.values() if a['act']}, key=len, reverse=True)
    for a in areas.values():
        if not a['act']:
            v = next((v for v in vocab if a['auth'].endswith(' ' + v)), None)
            if v: a['auth'] = a['auth'][:-len(v)].strip(); a['act'] = v; continue
            w = a['auth'].split(' '); k = len(w)   # otherwise: the trailing words in capitals
            while k > 0 and re.fullmatch(r"[A-Z0-9/&,()'.-]+", w[k - 1]): k -= 1
            if 0 < k < len(w): a['auth'] = ' '.join(w[:k]); a['act'] = ' '.join(w[k:])
    out = {}
    for k, a in areas.items():
        n = re.match(r'^\((\d+)\)\s*(.*)$', a['auth'])
        auth, ph = (n.group(2), phones.get(n.group(1), '')) if n else (a['auth'], '')
        out[k] = {'st': a['st'], 'lim': re.sub(r'\s*-\s*', ' - ', a['lim']), 'hr': a['hr'], 'auth': auth, 'ph': ph,
                  'act': a['act'], 'grp': a['grp']}
    return {'areas': out, 'ra': ra}


if __name__ == '__main__':
    import sys, json
    r = parse(open(sys.argv[1], encoding='utf-8', errors='replace').read())
    print(len(r['areas']), 'areas;', json.dumps(r['ra'])[:300])
    for k in sys.argv[2:]: print(k, json.dumps(r['areas'].get(k)))
