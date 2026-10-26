"""Parse ERSA FAC entries from `pdftotext -layout` output of the complete ERSA PDF.

parse(text) -> {ICAO: dict(n, la, lo, e, cat, ctaf, afru, fia, atis, atisnav, twr, smc, acd, app, dep, unicom, awis, notes)}
Every list entry is [service name, freq, note].
"""
import re

HDR = re.compile(r'^(\S.*?)\s{3,}ELEV\s+(-?\d+)\s*$')
PAGE = re.compile(r'^\s*(AIP Australia\s+\d{1,2} [A-Z]{3} \d{4}\s+FAC.*|\d{1,2} [A-Z]{3} \d{4}(\s+Information may be continued.*)?|Information may be continued.*)\s*$')
COMM_START = 'ATS AND AERODROME COMMUNICATION FACILITIES'
TYPES = r'(FIA|APP/DEP|APP|DEP|ATIS|TWR|SMCV|SMC|ACD|UNICOM|GND|FSS|ARO)'
COMM = re.compile(r'^' + TYPES + r'\s+(.*)$')
FREQ = re.compile(r'(?<![\d.])(1[0-3]\d\.\d{1,3})(?![\d.])')
CTAF = re.compile(r'^\s*CTAF(\s*-\s*AFRU)?\s+(1\d\d\.\d{1,3})\b')
AWIS = re.compile(r'\bAWIS\s+(?:FREQ\s+)?(1\d\d\.\d{1,3})\b')
HEAD_LINE = re.compile(r'^[A-Z][A-Z ,/&()\'-]{8,}$')

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
        for j in range(i + 1, min(i + 6, len(lines))):
            mm = re.search(r'\bUTC\b.*?\s(Y[A-Z0-9]{3})\s*$', lines[j])
            if mm: icao = mm.group(1); break
        if icao: heads.append((i, m.group(1).strip(), int(m.group(2)), icao))
    out = {}
    for k, (i, name, elev, icao) in enumerate(heads):
        end = heads[k + 1][0] if k + 1 < len(heads) else len(lines)
        body = lines[i:end]
        rec = dict(n=name, e=elev, fia=[], atis=[], atisnav=[], twr=[], smc=[], acd=[], app=[], dep=[], unicom=[], gnd=[])
        for l in body[:14]:
            m = re.search(r'(?<![\d.])(\d{5,6})S\s+(\d{6,7})E\b(.*)$', l)
            if m:
                rec['la'] = -round(dd(m.group(1), 2), 5); rec['lo'] = round(dd(m.group(2), 3), 5)
                c = re.search(r'\b(CERT|REG|UNCR|MIL)\s*$', m.group(3))
                if c: rec['cat'] = c.group(1)
                break
        if 'la' not in rec: continue
        for l in body[:8]:
            m = re.search(r'\b(NSW|VIC|QLD|SA|WA|TAS|NT|ACT|OTH)\b\s+UTC\s*\+(\d+)(?::(\d+))?', l)
            if m:
                rec['st'] = m.group(1); rec['utc'] = int(m.group(2)) + (int(m.group(3) or 0) / 60); break
        in_comm = False
        sec = None; secs = {}; notes = []
        for l in body:
            s = l.strip()
            if HEAD_LINE.match(s) and not COMM.match(s):
                sec = s if s in KEEP else None
                if sec: secs.setdefault(sec, [])
            elif sec and s and not s.startswith('Information may be continued'):
                secs[sec].append(s)
            if s.startswith(COMM_START): in_comm = True; continue
            if in_comm and HEAD_LINE.match(s) and not COMM.match(s): in_comm = False
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
            note = re.sub(FREQ, '', note)
            note = re.sub(r'\b\d{3}(\.\d)?\b', '', note)        # NDB kHz etc
            note = re.sub(r'\s+', ' ', note).strip(' ,')
            coms = [fq(f) for f in fr if com(f)]
            navs = [fq(f) for f in fr if not com(f)]
            key = {'APP/DEP': 'app', 'SMCV': 'smc'}.get(typ, typ.lower())
            if key not in rec: continue
            if key == 'atis':
                rec['atis'] += coms; rec['atisnav'] += navs
            else:
                for f in coms or navs:
                    rec[key].append([svc, f, note])
        if notes: rec['cnotes'] = clip(notes)
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
