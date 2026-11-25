"""Find code swallowed by a // comment in tools/template.html.

26 Nov 2026: the flight computer's close button stopped working because a // comment added before it on the same line turned
its handler into comment text. assemble.py runs this and stops the build if anything is found; or on its own:
    python3 tools/cmtcheck.py tools/template.html
A line is flagged when, after a // that starts a comment (not inside a string, a URL or a regex), there is an event handler
($('x').onclick=, addEventListener, ...), a timer or a function declaration: code that was meant to run.
"""
import io, re, sys

PAT = re.compile(r"""\$\('[A-Za-z0-9_]+'\)\.(onclick|onchange|oninput|onkeydown|addEventListener)|\bsetTimeout\(|\bsetInterval\(|\bfunction\s+\w+\(""")

def check(path):
    s = io.open(path, encoding='utf-8').read()
    out, in_script = [], False
    for n, l in enumerate(s.split('\n'), 1):
        if '<script' in l: in_script = True
        if not in_script: continue
        for m in re.finditer(r'//', l):
            i = m.start(); pre = l[:i]
            if pre.count("'") % 2 or pre.count('"') % 2 or pre.count('`') % 2: continue
            if i > 0 and l[i - 1] in (':', '\\', '/'): continue
            if pre.rstrip().endswith(('/[', '(/')): continue
            if PAT.search(l[i + 2:]): out.append((n, l[max(0, i - 50):i + 180]))
            break
    return out

if __name__ == '__main__':
    hits = check(sys.argv[1] if len(sys.argv) > 1 else 'tools/template.html')
    for n, t in hits: print(n, '|', t)
    print(len(hits), 'line(s) with code after a // comment')
    sys.exit(1 if hits else 0)
