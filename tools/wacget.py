#!/usr/bin/env python3
"""Download every WAC (World Aeronautical Chart, 1:1,000,000) PDF from http://data.tmorris.net/aviation/wac/ into data/aip/.

    python tools/wacget.py [OUT_DIR]          (default: ../data/aip next to this script)

Files are saved with underscores for spaces ("WAC 3470 Melbourne Ed. 17.pdf" -> "WAC_3470_Melbourne_Ed._17.pdf"), the names
tools/wacref.py and tools/chartiles.py expect. A file already there with the same size is skipped, so it can be re-run.
Needs only the Python standard library. The sheets on that site are the 2009 editions; they're Airservices charts.
"""
import os, re, sys, time, urllib.parse, urllib.request

BASE = 'http://data.tmorris.net/aviation/wac/'
UA = {'User-Agent': 'radio-calls-au wacget.py'}


def get(url, tries=4):
    for k in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
                return r.read(), r.headers.get('Content-Length')
        except Exception as e:
            if k == tries - 1: raise
            print('  retrying after', e); time.sleep(3 * (k + 1))


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, '..', 'data', 'aip')
    os.makedirs(out, exist_ok=True)
    html = get(BASE)[0].decode('utf-8', 'replace')
    names = sorted({urllib.parse.unquote(h) for h in re.findall(r'href="([^"?/][^"]*\.pdf)"', html, re.I)})
    print(len(names), 'WAC PDFs listed')
    got = skip = 0
    for n in names:
        fn = re.sub(r'\s+', '_', n.strip()); path = os.path.join(out, fn)
        head = urllib.request.Request(BASE + urllib.parse.quote(n), headers=UA, method='HEAD')
        try:
            with urllib.request.urlopen(head, timeout=60) as r: size = int(r.headers.get('Content-Length') or 0)
        except Exception: size = 0
        if size and os.path.exists(path) and os.path.getsize(path) == size:
            skip += 1; continue
        data, _ = get(BASE + urllib.parse.quote(n))
        open(path, 'wb').write(data); got += 1
        print(f'{fn}  {len(data) / 1048576:.1f} MB')
    print(f'done: {got} downloaded, {skip} already there, in {os.path.abspath(out)}')


if __name__ == '__main__':
    main()
