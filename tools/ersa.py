"""Parse ERSA FAC entries from `pdftotext -layout` output of the complete ERSA PDF.

parse(text) -> {ICAO: dict(n, la, lo, e, cat, ctaf, afru, fia, atis, atisnav, twr, smc, acd, app, dep, unicom, awis, notes)}
Every list entry is [service name, freq, note].
"""
import re

HDR = re.compile(r'^(\S.*?)\s{3,}ELEV\s+(-?\d+)\s*$')
PAGE = re.compile(r'^\s*(AIP Australia\s+\d{1,2} [A-Z]{3} \d{4}\s+FAC.*|\d{1,2} [A-Z]{3} \d{4}(\s+Information may be continued.*)?|Information may be continued.*)\s*$')
COMM_START = 'ATS AND AERODROME COMMUNICATION FACILITIES'
TYPES = r'(FIA|APP/DEP|APP|DEP|ATIS|AFIS|TWR|SMCV|SMC|ACD|UNICOM|GND|FSS|ARO)'
COMM = re.compile(r'^' + TYPES + r'(?: [EWNS]/(?:DEP|APP)?|\s)\s*(.*)$')   # 'APP E/DEPDARWIN APP E/DEP 125.2' (pdftotext ran the type into the name)
FREQ = re.compile(r'(?<![\d.])(1[0-3]\d\.\d{1,3})(?![\d.])')
CTAF = re.compile(r'^\s*CTAF(\s*-\s*AFRU)?\s+(1\d\d\.\d{1,3})\b')
AWIS = re.compile(r'\bAWIS\b[^\d\n]{0,12}?(1[0-3]\d\.\d{1,3})(?!\d)')   # 'AWIS 128.1', 'AWIS FREQ: 133.45MHz', 'AWIS - 125.4'
HEAD_LINE = re.compile(r'^[A-Z][A-Z ,/&()\'-]{8,}$')
CONT_LINE = re.compile(r'^[A-Z][A-Z /&()\'-]{2,}$')      # a wrapped service-name continuation, e.g. 'GROUND', 'TOWER', 'DEPARTURES'
STATE = r'(?<![A-Z])(NSW|VIC|QLD|SA|WA|TAS|NT|ACT|OTH)\b'   # no leading \b: diagram digits can be glued on ('19NSW')

def com(f):  # VHF COM band
    v = float(f); return 118.0 <= v <= 136.975

def fq(f):
    s = f"{float(f):.3f}".rstrip('0')
    return s + '0' if s.endswith('.') else s

def dd(v, dw):
    v = v.zfill(dw + 4)
    return int(v[:-4]) + int(v[-4:-2]) / 60 + int(v[-2:]) / 3600

KEEP = ('LOCAL TRAFFIC REGULATIONS', 'FLIGHT PROCEDURES', 'SPECIAL PROCEDURES')

def clip(lines, limit=6000):
    out, n = [], 0
    for l in lines:
        l = re.sub(r'\s{2,}', ' ', l)
        if re.fullmatch(r'[A-Z0-9 ]{1,3}', l): continue        # stray diagram labels
        n += len(l)
        if n > limit: out.append('…'); break
        out.append(l)
    return out

def parse(text):
    lines = [l for l in text.splitlines() if not PAGE.match(l)]
    # first FAC entry starts after the FAC index; find headers with an ICAO in the next lines
    heads = []
    for i, l in enumerate(lines):
        m = HDR.match(l)
        if not m: continue
        icao = None
        for j in range(i + 1, min(i + 13, len(lines))):
            mm = re.search(r'\bUTC\b.*?\s(Y[A-Z0-9]{3})\s*$', lines[j])
            if mm: icao = mm.group(1); break
        if icao: heads.append((i, m.group(1).strip(), int(m.group(2)), icao))
    # entries with no ELEV on the name line (water aerodromes, helidecks, e.g. ROSE BAY): the name is the
    # nearest all-caps line above the state/UTC/ICAO line. Without this they merge into the entry before.
    have = {h[0] for h in heads}
    for j, l in enumerate(lines):
        mm = re.search(STATE + r'\s+UTC\s*[+-].*?\s(Y[A-Z0-9]{3})\s*$', l)
        if not mm or any(i in have for i in range(max(0, j - 13), j)): continue
        for i in range(j - 1, max(0, j - 12), -1):
            s = lines[i].strip()
            if not s or s.startswith(('FULL NOTAM', 'AVFAX')) or re.fullmatch(r'[A-Z0-9 ]{1,3}', s): continue
            if re.fullmatch(r"[A-Z][A-Z0-9 '()/&.-]{2,}", s): heads.append((i, s, None, mm.group(2)))
            break
    heads.sort()
    out = {}
    for k, (i, name, elev, icao) in enumerate(heads):
        end = heads[k + 1][0] if k + 1 < len(heads) else len(lines)
        body = lines[i:end]
        rec = dict(n=name, e=elev, fia=[], atis=[], atisnav=[], twr=[], smc=[], acd=[], app=[], dep=[], unicom=[], gnd=[], afis=[])
        for l in body[:40]:
            if l.strip().startswith(COMM_START): break
            m = re.search(r'(?<![\d.])(\d{5,6})S\s+(\d{6,7})E\b(.*)$', l)
            if m:
                rec['la'] = -round(dd(m.group(1), 2), 5); rec['lo'] = round(dd(m.group(2), 3), 5)
                v = re.search(r'VAR\s+(\d+)\s+DEG\s+([EW])', m.group(3))
                if v: rec['var'] = int(v.group(1)) * (1 if v.group(2) == 'E' else -1)
                c = re.search(r'\b(CERT|REG|UNCR|MIL)\s*$', m.group(3))
                if c: rec['cat'] = c.group(1)
                break
        if 'la' not in rec: continue
        for l in body[:14]:
            m = re.search(STATE + r'\s+UTC\s*\+(\d+)(?::(\d+))?', l)
            if m:
                rec['st'] = m.group(1); rec['utc'] = int(m.group(2)) + (int(m.group(3) or 0) / 60); break
        in_comm = False; last_comm = None
        sec = None; secs = {}; notes = []
        for l in body:
            s = l.strip()
            if HEAD_LINE.match(s) and not COMM.match(s) and not l.startswith(' '):
                sec = s if s in KEEP else None
                if sec: secs.setdefault(sec, [])
            elif sec and s and not s.startswith('Information may be continued'):
                secs[sec].append(s)
            if s.startswith(COMM_START): in_comm = True; continue
            # section headings start in column 0; an indented all-caps line is a wrapped service name
            # ("DEP  MELBOURNE  118.9" / "     DEPARTURES"), which must not end the COMM block
            if in_comm and HEAD_LINE.match(s) and not COMM.match(s) and not l.startswith(' '): in_comm = False
            if in_comm and s and not COMM.match(s) and l.startswith(' ') and CONT_LINE.match(s) and not FREQ.search(s) and last_comm:
                for e in last_comm: e[0] = (e[0] + ' ' + s).strip()
                continue
            if in_comm and s and not COMM.match(s): notes.append(s)
            m = CTAF.match(l)
            if m and 'ctaf' not in rec:
                rec['ctaf'] = fq(m.group(2)); rec['afru'] = 1 if m.group(1) else 0
            m = AWIS.search(l)
            if m and 'awis' not in rec and com(m.group(1)): rec['awis'] = fq(m.group(1))
            if not in_comm: continue
            m = COMM.match(s)
            if not m: continue
            typ, rest = m.group(1), m.group(2)
            fr = FREQ.findall(rest)
            if not fr: continue
            first = FREQ.search(rest)
            svc = re.sub(r'\s*\(\d+\)\s*$', '', rest[:first.start()]).strip()
            svc = re.sub(r'^[A-Z0-9]{1,2}\s{2,}', '', svc).strip()
            note = rest[FREQ.finditer(rest).__iter__().__next__().start():]
            note = re.sub(r'(?<![\d.])1[0-3]\d\.\d{1,3}[A-Z]?(?![\d.])', '', note)
            note = re.sub(r'(?<![\d.])\d{3}(?:\.\d{1,3})?[A-Z]?(?![\d.])', '', note)        # UHF, NDB kHz, '125.8S' sector suffix etc
            note = re.sub(r'\s+', ' ', note).strip(' ,')
            coms = [fq(f) for f in fr if com(f)]
            navs = [fq(f) for f in fr if not com(f)]
            key = {'APP/DEP': 'app', 'SMCV': 'smc'}.get(typ, typ.lower())
            if key not in rec: continue
            last_comm = None
            if key == 'atis':
                rec['atis'] += coms; rec['atisnav'] += navs
            else:
                last_comm = []
                for f in coms or navs:
                    rec[key].append([svc, f, note]); last_comm.append(rec[key][-1])
        if notes: rec['cnotes'] = clip(notes)
        # runways from PHYSICAL CHARACTERISTICS: designators, magnetic bearing, length (x100 ft), surface, width
        try:
            p0 = next(j for j, l in enumerate(body) if l.strip() == 'PHYSICAL CHARACTERISTICS')
            rws = []
            for l in body[p0 + 1:p0 + 16]:
                if HEAD_LINE.match(l.strip()) and rws: break
                m = re.match(r'^\s*(\d{2}[LRC]?)/(\d{2}[LRC]?)\b(.*)$', l)
                if not m: continue
                rest = m.group(3)
                b = re.match(r'\s+(\d{3})\s', rest)                   # bearing (deg MAG), certified ADs
                ln = re.search(r'(?<![\d,])(\d{1,3})\s*([abcABC])(?:/[abcABC])?\b', rest)   # length x100 FT + surface
                lm = re.search(r'RWY LEN\s+([\d,]+)\s*M', rest)       # ALAs: explicit metres
                w = re.search(r'\bWID\s+(\d+)', rest)
                length_m = int(lm.group(1).replace(',', '')) if lm else (round(int(ln.group(1)) * 30.48) if ln else None)
                rws.append([m.group(1), m.group(2), int(b.group(1)) if b else None, length_m,
                            ln.group(2).lower() if ln else None, int(w.group(1)) if w else None])
            if rws: rec['rw'] = rws
        except StopIteration:
            pass
        proc = {k: clip(v, 14000) for k, v in secs.items() if v}
        if proc:
            rec['proc'] = proc
            kt = ' '.join(' '.join(v) for v in proc.values())
            keys = {}
            m = re.search(r'CTR entry (?:altitude|ALT)\s*:?\s*([\d,]+\s?FT(?: AMSL)?)', kt, re.I)
            if m: keys['entry'] = m.group(1)
            m = re.search(r'Circuit (?:Altitude|ALT|height)\s*:?\s*([\d,]+\s?FT(?:\s*\((?:QNH|AMSL|AGL)\))?)', kt, re.I)
            if m: keys['cct'] = m.group(1)
            m = re.search(r'track via and report at ([A-Z0-9, ]+?(?: or [A-Z0-9]+)?)\.', kt)
            if m: keys['rpts'] = m.group(1)
            m = re.search(r'HEL[^.]{0,60}?(?:must be|at)\s+([\d,]+\s?FT(?: AMSL| AGL)?)', kt)
            if m: keys['hel'] = m.group(1)
            if keys: rec['keys'] = keys
            cct = {}
            for sent in re.split(r'(?<=\.)\s+(?=\(?[a-z0-9ivx]{1,4}[.)]\s|[A-Z])', kt):
                for m in re.finditer(r'RWY\s+(\d{2}[LRC]?)\s+HJ\s*-\s*(left|right)(?:\s*:\s*HN\s*-\s*([a-zA-Z ]+?))?(?=[.;(]|$)', sent, re.I):
                    ev = f"RWY {m.group(1)} day: {m.group(2).lower()}" + (f", night: {m.group(3).strip().lower()}" if m.group(3) else '')
                    cct.setdefault(m.group(1), [m.group(2)[0].upper(), ev])
                low = sent.lower()
                hasR = re.search(r'right[- ]hand', low); hasL = re.search(r'left[- ]hand', low)
                if not (hasR or hasL) or (hasR and hasL) or 'papi' in low: continue
                for m in re.finditer(r'RWY\s*((?:\d{2}[LRC]?)(?:\s*(?:,|and|or|&)\s*(?:RWY\s*)?\d{2}[LRC]?)*)', sent):
                    for d in re.findall(r'\d{2}[LRC]?', m.group(1)):
                        cct.setdefault(d, ['R' if hasR else 'L', sent.strip()[:140]])
            # "Daylight Operations all circuits to the WEST." -> left/right per runway (e.g. YLIL)
            side = {}
            for sent in re.split(r'(?<=\.)\s+', kt):
                m = re.search(r'\b(?:circuits|CCTS)\s+to\s+the\s+(NORTH|SOUTH|EAST|WEST|N|S|E|W)\b', sent, re.I)
                if not m or re.search(r'glider|ultra|other a', sent, re.I): continue
                b = {'N': 0, 'E': 90, 'S': 180, 'W': 270}[m.group(1)[0].upper()]
                when = 'night' if re.search(r'\bnight\b|\bHN\b', sent, re.I) else 'day' if re.search(r'\bday(light)?\b|\bHJ\b', sent, re.I) else 'all'
                side.setdefault(when, (b, {0: 'north', 90: 'east', 180: 'south', 270: 'west'}[b]))
            for r in rec.get('rw', []) if side else []:
                for d in r[:2]:
                    hdg = int(d[:2]) * 10
                    def lr(b): return 'R' if abs(((hdg + 90 - b) + 180) % 360 - 180) < 90 else 'L'
                    day = side.get('day') or side.get('all'); night = side.get('night') or side.get('all')
                    if not day: continue
                    w = {'R': 'right', 'L': 'left'}
                    ev = f"RWY {d} day: {w[lr(day[0])]} (circuits to the {day[1]})" + (f", night: {w[lr(night[0])]} (to the {night[1]})" if night and night != day else '')
                    cct.setdefault(d, [lr(day[0]), ev])
            if cct: rec['cct'] = cct
        for k2 in list(rec):
            if rec[k2] in ([], None): del rec[k2]
        out[icao] = rec
    return out

if __name__ == '__main__':
    import sys, json
    d = parse(open(sys.argv[1], encoding='utf-8', errors='replace').read())
    print(len(d))
    for i in sys.argv[2:]:
        print(i, json.dumps(d.get(i)))


def vfr_waypoints(text):
    """ERSA VFR-GEN 'VFR WAYPOINTS - ENCODED' -> [[code, name, state, lat, lon], ...]"""
    mi = re.search(r'^VFR WAYPOINTS - ENCODED\s*$', text, re.M)
    if not mi: return []
    mj = re.compile(r'^VFR WAYPOINTS - DECODED\s*$', re.M).search(text, mi.end())
    seg = text[mi.end():mj.start() if mj else None]
    out, seen = [], set()
    for m in re.finditer(r'^\s*([A-Z0-9][A-Z0-9 \'/().&-]*?)\s{2,}(NSW|VIC|QLD|SA|WA|TAS|NT|ACT|OTH)\s+([A-Z0-9]{2,5})\s+(\d{5,6})S\s+(\d{6,7})E', seg, re.M):
        code = m.group(3)
        if code in seen: continue
        seen.add(code)
        out.append([code, m.group(1).strip(), m.group(2), -round(dd(m.group(4), 2), 5), round(dd(m.group(5), 3), 5)])
    return out

def navaids(text):
    """Aerodrome navaids from ERSA RADIO NAVIGATION lines -> {(ident, type): [freq, lat, lon]}"""
    out = {}
    for m in re.finditer(r'^\s*(VOR|NDB|DME|TAC)\s+([A-Z]{1,3})\s+([\d.]+)(?:/\s*\w+)?.*?(\d{5,6}(?:\.\d+)?)S\s+(\d{6,7}(?:\.\d+)?)E', text, re.M):
        def c(v, w):
            a, _, f = v.partition('.'); a = a.zfill(w + 4)
            return int(a[:-4]) + int(a[-4:-2]) / 60 + float(a[-2:] + '.' + (f or '0')) / 3600
        out.setdefault((m.group(2), m.group(1)), [m.group(3), -round(c(m.group(4), 2), 5), round(c(m.group(5), 3), 5)])
    return out
