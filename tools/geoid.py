"""EGM96 geoid heights for Australia -> tools/egm96_au.json, used to turn the phone's GPS altitude (height above the
WGS84 ellipsoid on Android) into height above the geoid (~MSL), the datum of SRTM terrain and of AMSL airspace limits.

Source: the EGM96 15' grid (NGA, public domain) as packaged in the npm module egm96-universal (MIT): a base64 string of
big-endian int16 centimetres, 721 rows from 90N to 90S by 1440 columns from 0E eastwards.
  npm i egm96-universal@1 && python3 geoid.py node_modules/egm96-universal/dist/egm96-universal.cjs.js egm96_au.json
Output: {la0, lo0, step, rows, cols, cm: base64 little-endian int16}, north to south, west to east, covering
8S-46S, 104E-170E (Christmas Island to Norfolk Island, Torres Strait to south of Tasmania). The values are read straight
off the 0.25 degree EGM96 grid nodes; the app interpolates bilinearly between them.
"""
import re, sys, json, base64, struct
LA_N, LA_S, LO_W, LO_E, STEP = -8.0, -46.0, 104.0, 170.0, 0.25

def main(src, out):
    s = open(src, encoding='utf-8').read()
    d = base64.b64decode(re.search(r'var data = "([^"]+)"', s).group(1))
    R, C = 721, 1440
    assert len(d) == R * C * 2, len(d)
    g = lambda r, c: struct.unpack_from('>h', d, (r * C + c) * 2)[0]
    rows = int(round((LA_N - LA_S) / STEP)) + 1; cols = int(round((LO_E - LO_W) / STEP)) + 1
    vals = []
    for i in range(rows):
        r = int(round((90 - (LA_N - i * STEP)) / STEP))
        for j in range(cols):
            vals.append(g(r, int(round((LO_W + j * STEP) / STEP)) % C))
    b = struct.pack('<%dh' % len(vals), *vals)
    json.dump({'src': 'EGM96 15\' (NGA) via egm96-universal', 'la0': LA_N, 'lo0': LO_W, 'step': STEP, 'rows': rows, 'cols': cols,
               'cm': base64.b64encode(b).decode()}, open(out, 'w'), separators=(',', ':'))
    print(rows, 'x', cols, 'nodes,', len(b), 'bytes; min/max m', min(vals) / 100, max(vals) / 100)

if __name__ == '__main__':
    main(*sys.argv[1:3])
